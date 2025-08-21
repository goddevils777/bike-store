const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config.json');

class ReBikeParser {
  constructor() {
    this.config = config.parser;
    this.pricing = config.pricing;
    this.browser = null;
    this.allProducts = [];
    this.dataFile = path.join(__dirname, '../data/products.json');
    this.changesFile = path.join(__dirname, '../data/changes.json');
  }

  getCategoryFilePath(categoryName) {
    return path.join(__dirname, `../data/products_${categoryName}.json`);
  }

  async loadCategoryProducts(categoryName) {
    try {
      const filePath = this.getCategoryFilePath(categoryName);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return []; // файл не существует
    }
  }

  async saveCategoryProducts(categoryName, products) {
    try {
      const filePath = this.getCategoryFilePath(categoryName);
      await fs.writeFile(filePath, JSON.stringify(products, null, 2));
      console.log(`💾 Сохранено ${products.length} товаров в ${filePath}`);
    } catch (error) {
      console.error(`❌ Ошибка сохранения категории ${categoryName}:`, error);
    }
  }

  async saveIncrementalCategoryProducts(categoryName, newProducts) {
    try {
      // Загружаем существующие товары категории
      const existingProducts = await this.loadCategoryProducts(categoryName);

      // Объединяем с новыми
      const allProducts = [...existingProducts, ...newProducts];

      // Сохраняем в файл категории
      await this.saveCategoryProducts(categoryName, allProducts);

      return allProducts;
    } catch (error) {
      console.error(`❌ Ошибка инкрементального сохранения ${categoryName}:`, error);
      return [];
    }
  }

  async init() {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',           // ДОБАВИТЬ
        '--disable-accelerated-2d-canvas',   // ДОБАВИТЬ  
        '--disable-gpu',                     // ДОБАВИТЬ
        '--window-size=1920,1080'            // ДОБАВИТЬ
      ],
      timeout: 60000  // ДОБАВИТЬ таймаут 60 секунд
    });
  }

  async loadExistingProducts() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return []; // файл не существует
    }
  }

  async saveProducts(products) {
    await fs.writeFile(this.dataFile, JSON.stringify(products, null, 2));
    console.log(`Сохранено ${products.length} товаров в ${this.dataFile}`);
  }

  async logChanges(changes) {
    const timestamp = new Date().toISOString();
    const changeLog = {
      timestamp,
      changes
    };

    try {
      const existingLogs = JSON.parse(await fs.readFile(this.changesFile, 'utf8'));
      existingLogs.push(changeLog);
      await fs.writeFile(this.changesFile, JSON.stringify(existingLogs, null, 2));
    } catch {
      await fs.writeFile(this.changesFile, JSON.stringify([changeLog], null, 2));
    }
  }

  compareProducts(oldProducts, newProducts) {
    const changes = {
      added: [],
      removed: [],
      updated: []
    };

    const oldMap = new Map(oldProducts.map(p => [p.url, p]));
    const newMap = new Map(newProducts.map(p => [p.url, p]));

    // Найти новые товары
    for (const [url, product] of newMap) {
      if (!oldMap.has(url)) {
        changes.added.push(product);
      }
    }

    // Найти удаленные товары
    for (const [url, product] of oldMap) {
      if (!newMap.has(url)) {
        changes.removed.push(product);
      }
    }

    // Найти измененные товары
    for (const [url, newProduct] of newMap) {
      const oldProduct = oldMap.get(url);
      if (oldProduct) {
        const hasChanges =
          oldProduct.price !== newProduct.price ||
          oldProduct.title !== newProduct.title ||
          oldProduct.originalPrice !== newProduct.originalPrice;

        if (hasChanges) {
          changes.updated.push({
            url,
            old: oldProduct,
            new: newProduct
          });
        }
      }
    }

    return changes;
  }


  async parseFullUpdate() {
    console.log('Начинаем полное обновление каталога...');

    if (!this.browser) await this.init();

    // НЕ загружаем старые товары - начинаем с чистого листа
    console.log('Начинаем парсинг с нуля...');

    // Очищаем массив товаров
    this.allProducts = [];

    // Парсим все товары заново
    const newProducts = await this.parseAllProducts();
    console.log(`Спарсено ${newProducts.length} товаров`);

    // Группируем товары по категориям для анализа
    const categoryGroups = {};
    newProducts.forEach(product => {
      if (!categoryGroups[product.category]) {
        categoryGroups[product.category] = [];
      }
      categoryGroups[product.category].push(product);
    });

    console.log('\n📂 Товары по категориям:');
    Object.entries(categoryGroups).forEach(([category, products]) => {
      console.log(`  ${category}: ${products.length} товаров`);
    });

    // ПОЛНОСТЬЮ перезаписываем файл с товарами
    await this.saveProducts(newProducts);

    // Логируем как "добавление" так как мы перезаписали весь каталог
    const changes = {
      added: newProducts,
      removed: [],
      updated: []
    };

    await this.logChanges({
      timestamp: new Date().toISOString(),
      action: 'full_reload',
      totalProducts: newProducts.length,
      categories: Object.keys(categoryGroups)
    });

    return {
      products: newProducts,
      changes
    };
  }

  async saveIncrementalProducts(newProducts) {
    try {
      // Загружаем существующие товары
      const existingProducts = await this.loadExistingProducts();

      // Объединяем с новыми (новые добавляются в конец)
      const allProducts = [...existingProducts, ...newProducts];

      // Сохраняем объединенный список
      await this.saveProducts(allProducts);
      console.log(`💾 Сохранено ${allProducts.length} товаров (добавлено ${newProducts.length} новых)`);

      return allProducts;
    } catch (error) {
      console.error(`❌ Ошибка сохранения товаров:`, error);
      return [];
    }
  }
  async parseAllProducts() {
    console.log('🔄 Запуск полной синхронизации с сайтом...');

    // Загружаем существующие товары из базы для сравнения
    const existingProducts = await this.loadAllProducts();
    console.log(`📦 В базе для сравнения: ${existingProducts.length} товаров`);

    // Список актуальных товаров с сайта
    const currentSiteProducts = [];
    const foundProductUrls = new Set(); // Для отслеживания найденных товаров

    const targetCategories = [
      { url: 'https://rebike.com/de/rebike1-sales-e-bike-angebote', type: 'sales' },
      { url: 'https://rebike.com/de/gebrauchte-e-bikes-und-pedelecs-kaufen', type: 'all' },
      { url: 'https://rebike.com/de/e-bike-kaufen/trekking-city', type: 'trekking-city' },
      { url: 'https://rebike.com/de/trekkingrad-touren-e-bike-kaufen', type: 'trekking' },
      { url: 'https://rebike.com/de/city-e-bikes', type: 'city' },
      { url: 'https://rebike.com/de/urban-e-bikes', type: 'urban' },
      { url: 'https://rebike.com/de/e-mountainbikes', type: 'mountain' },
      { url: 'https://rebike.com/de/e-mountainbikes/e-bike-hardtail', type: 'hardtail' },
      { url: 'https://rebike.com/de/e-mountainbikes/e-bike-fully', type: 'fully' },
      { url: 'https://rebike.com/de/e-lastenrad-e-bike-kaufen', type: 'cargo' },
      { url: 'https://rebike.com/de/s-pedelecs', type: 'speed' },
      { url: 'https://rebike.com/de/e-gravel-rennraeder', type: 'gravel' },
      { url: 'https://rebike.com/de/kinder-e-bikes', type: 'kids' },
      { url: 'https://rebike.com/de/fahrraeder', type: 'classic' }
    ];

    // Время начала
    const startTime = Date.now();
    let lastPauseTime = startTime;

    // ПАРСИМ ВСЕ категории с самого начала (БЕЗ resume)
    for (let i = 0; i < targetCategories.length; i++) {
      const category = targetCategories[i];
      console.log(`\n📂 Синхронизация ${i + 1}/${targetCategories.length}: ${category.type}`);

      try {
        // НЕ передаем lastProductUrl - начинаем с первой страницы
        const categoryProducts = await this.parseCategory(category.url, category.type, null, existingProducts);

        currentSiteProducts.push(...categoryProducts);

        // Отмечаем найденные товары
        categoryProducts.forEach(product => {
          if (product.url) foundProductUrls.add(product.url);
        });

        // Паузы каждые 20 минут
        const currentTime = Date.now();
        if (currentTime - lastPauseTime >= 20 * 60 * 1000) {
          const pauseMinutes = Math.floor(Math.random() * 7) + 1;
          console.log(`⏸️ Пауза ${pauseMinutes} минут...`);
          await this.delay(pauseMinutes * 60 * 1000);
          lastPauseTime = Date.now();
        }

        await this.delay(this.config.delay);
      } catch (error) {
        console.error(`❌ Ошибка синхронизации ${category.type}:`, error.message);
      }
    }

    console.log(`\n📊 Найдено на сайте: ${currentSiteProducts.length} товаров`);
    console.log(`🗑️ Проверяем устаревшие товары...`);

    // Находим товары для удаления (есть в базе, но нет на сайте)
    const toDelete = existingProducts.filter(product => !foundProductUrls.has(product.url));
    console.log(`❌ К удалению: ${toDelete.length} товаров`);

    this.allProducts = currentSiteProducts;
    return { products: currentSiteProducts, deleted: toDelete };
  }

  removeDuplicates(products) {
    const seen = new Set();
    return products.filter(product => {
      if (seen.has(product.url)) {
        return false;
      }
      seen.add(product.url);
      return true;
    });
  }

  removeDuplicatesInCategory(products) {
    const seen = new Set();
    return products.filter(product => {
      if (seen.has(product.url)) {
        return false;
      }
      seen.add(product.url);
      return true;
    });
  }

  checkProductExists(productUrl, existingProducts) {
    return existingProducts.some(product => product.url === productUrl);
  }

  determineCategoryType(url) {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('sales') || urlLower.includes('angebot')) {
      return 'sales';
    } else if (urlLower.includes('gebrauchte')) {
      return 'gebraucht';
    } else if (urlLower.includes('trekking-city') || (urlLower.includes('trekking') && urlLower.includes('city'))) {
      return 'trekking-city';
    } else if (urlLower.includes('trekkingrad') || urlLower.includes('touren')) {
      return 'trekking';
    } else if (urlLower.includes('city-e-bike') || urlLower.includes('city')) {
      return 'city';
    } else if (urlLower.includes('urban')) {
      return 'urban';
    } else if (urlLower.includes('mountainbike') && urlLower.includes('fully')) {
      return 'fully';
    } else if (urlLower.includes('mountainbike') && urlLower.includes('hardtail')) {
      return 'hardtail';
    } else if (urlLower.includes('mountainbike') || urlLower.includes('mtb')) {
      return 'mountain';
    } else if (urlLower.includes('lastenrad') || urlLower.includes('cargo')) {
      return 'cargo';
    } else if (urlLower.includes('s-pedelec') || urlLower.includes('speed')) {
      return 'speed';
    } else if (urlLower.includes('gravel') || urlLower.includes('rennr')) {
      return 'gravel';
    } else if (urlLower.includes('kinder') || urlLower.includes('kids')) {
      return 'kids';
    } else if (urlLower.includes('fahrraeder') || urlLower.includes('klassisch')) {
      return 'classic';
    } else {
      return 'electric';
    }
  }

  // ... остальные методы остаются такими же ...
  async findCategories() {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.config.userAgent);

    try {
      console.log('🔍 Загружаем главную страницу для поиска категорий...');
      await page.goto(this.config.baseUrl, { waitUntil: 'networkidle0' });

      console.log('📋 Ищем ссылки на категории...');
      const categories = await page.evaluate(() => {
        console.log('Текущий URL:', window.location.href);

        // Ищем разные варианты ссылок
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        console.log('Всего ссылок найдено:', allLinks.length);

        // Фильтруем ссылки на категории
        const categoryLinks = allLinks.filter(link => {
          const href = link.href;
          return href.includes('/de/') &&
            !href.includes('?') &&
            href !== window.location.href &&
            !href.includes('#') &&
            link.textContent.trim().length > 0;
        });

        console.log('Ссылок на категории:', categoryLinks.length);

        const categories = categoryLinks.map(link => ({
          name: link.textContent.trim(),
          url: link.href
        }));

        // Показываем первые 10 найденных категорий
        categories.slice(0, 10).forEach((cat, i) => {
          console.log(`${i + 1}. ${cat.name} -> ${cat.url}`);
        });

        return categories;
      });

      console.log(`✅ Найдено категорий: ${categories.length}`);
      if (categories.length === 0) {
        console.log('❌ Категории не найдены! Проверяем структуру страницы...');

        // Дополнительная диагностика
        await page.evaluate(() => {
          console.log('Заголовок страницы:', document.title);
          console.log('Есть ли меню?', !!document.querySelector('nav, .menu, .navigation'));
          console.log('Есть ли товары?', !!document.querySelector('.bike-card'));
        });
      }

      return categories;
    } finally {
      await page.close();
    }
  }
  async parseCategory(categoryUrl, categoryName = 'unknown', lastProductUrl = null, existingProducts = []) {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.config.userAgent);

    try {
      console.log(`Парсим категорию: ${categoryName} (${categoryUrl})`);
      if (lastProductUrl) {
        console.log(`🎯 Продолжаем с товара: ${lastProductUrl}`);
      }

      let pageNum = 1;
      let hasNextPage = true;
      const categoryProducts = [];

      while (hasNextPage) {
        const url = `${categoryUrl}${categoryUrl.includes('?') ? '&' : '?'}p=${pageNum}`;
        console.log(`  Страница ${pageNum}: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000  // ДОБАВИТЬ таймаут
        });
        await this.delay(this.config.delay);

        // ПРОВЕРЯЕМ ПАГИНАЦИЮ СНАЧАЛА
        console.log(`  🔍 Проверяем пагинацию на странице ${pageNum}...`);

        const paginationInfo = await page.evaluate(() => {
          const nextButton = document.querySelector('button[aria-label="Go to next page"]');
          const pagination = document.querySelector('.MuiPagination-root');
          const currentPageButton = document.querySelector('.MuiPaginationItem-page.Mui-selected');

          return {
            nextButtonExists: !!nextButton,
            nextButtonDisabled: nextButton ? nextButton.disabled : null,
            nextButtonClasses: nextButton ? nextButton.className : null,
            paginationExists: !!pagination,
            currentPage: currentPageButton ? currentPageButton.textContent : null,
            url: window.location.href,
            totalCards: document.querySelectorAll('.bike-card').length
          };
        });

        console.log(`    Пагинация найдена: ${paginationInfo.paginationExists}`);
        console.log(`    Кнопка "Далее" найдена: ${paginationInfo.nextButtonExists}`);
        console.log(`    Есть следующая страница: ${paginationInfo.nextButtonExists && !paginationInfo.nextButtonDisabled}`);

        const hasNextPageBefore = paginationInfo.nextButtonExists &&
          !paginationInfo.nextButtonDisabled &&
          !paginationInfo.nextButtonClasses?.includes('Mui-disabled');

        // ПАРСИМ ТОВАРЫ (передаем lastProductUrl только для первой страницы)
        const pageProducts = await this.parsePageProducts(page, categoryName, pageNum === 1 ? lastProductUrl : null, existingProducts);

        // Логируем результат страницы
        console.log(`  📊 На странице: ${paginationInfo.totalCards} товаров, обработано: ${pageProducts.length}`);

        if (pageProducts.length > 0) {
          categoryProducts.push(...pageProducts);
          console.log(`  ✅ Страница ${pageNum}: найдено ${pageProducts.length} новых товаров`);

          // АВТОСОХРАНЕНИЕ ПОСЛЕ КАЖДОЙ СТРАНИЦЫ
          try {
            // Устанавливаем категорию для товаров страницы
            const pageProductsWithCategory = pageProducts.map(product => ({
              ...product,
              category: categoryName
            }));

            // ОБРАБАТЫВАЕМ товары для добавления ID и цен
            const processedPageProducts = this.processProducts(pageProductsWithCategory);
            console.log(`  🔄 Обработано товаров страницы: ${processedPageProducts.length}`);
            console.log(`  🆔 Первые ID страницы: ${processedPageProducts.slice(0, 2).map(p => p.id).join(', ')}`);

            // Убираем дубликаты внутри страницы  
            const uniquePageProducts = this.removeDuplicatesInCategory(processedPageProducts);

            // Сохраняем в файл КАТЕГОРИИ
            await this.saveIncrementalCategoryProducts(categoryName, uniquePageProducts);
            console.log(`  💾 Страница ${pageNum} сохранена в файл категории ${categoryName} (${uniquePageProducts.length} товаров)`);
          } catch (saveError) {
            console.error(`  ❌ Ошибка автосохранения страницы ${pageNum}:`, saveError.message);
          }
        } else {
          console.log(`  ⏭️ Страница ${pageNum}: все товары уже существуют`);
        }

        // ВСЕГДА переходим к следующей странице, даже если новых товаров нет
        hasNextPage = hasNextPageBefore;
        console.log(`  ➡️ Переходим к странице ${pageNum + 1}: ${hasNextPage}`);

        if (hasNextPage) {
          pageNum++;
        }

        if (pageNum > 200) {
          console.log(`  ⚠️ Достигнут лимит в 100 страниц`);
          hasNextPage = false;
        }
      }

      console.log(`  Найдено товаров в категории ${categoryName}: ${categoryProducts.length}`);
      // Товары уже обработаны и сохранены по страницам
      return categoryProducts;
    } finally {
      await page.close();
    }
  }
async parsePageProducts(page, categoryName = 'unknown', lastProductUrl = null, existingProducts = []) {
    try {
      await page.waitForSelector('.bike-card', { timeout: 5000 });
    } catch {
      return [];
    }

    // Получаем основные данные карточек
    const cardData = await page.evaluate((category) => {
      return Array.from(document.querySelectorAll('.bike-card')).map(card => {
        const titleLink = card.querySelector('a[href*="/de/"]');
        const title = titleLink ? titleLink.textContent.trim() : null;
        const url = titleLink ? titleLink.href : null;

        const currentPriceEl = card.querySelector('p.css-1bw9inq');
        const currentPrice = currentPriceEl ? currentPriceEl.textContent.trim() : null;

        const originalPriceEl = card.querySelector('p.css-1rh6qqp');
        const originalPrice = originalPriceEl ? originalPriceEl.textContent.trim() : null;

        const image = card.querySelector('img');
        const imageUrl = image ? image.src : null;

        return {
          title,
          currentPrice,
          originalPrice,
          url,
          imageUrl,
          category: category,
          parsedAt: new Date().toISOString()
        };
      }).filter(product => product.title);
    }, categoryName);

    // Загружаем существующие товары ТОЛЬКО ТЕКУЩЕЙ категории
    const existingInCurrentCategory = await this.loadCategoryProducts(categoryName);

    let startParsing = lastProductUrl ? false : true;
    let foundLastProduct = false;

    const enhancedProducts = [];

    for (const product of cardData) {
      try {
        // Логика resume
        if (lastProductUrl && !startParsing) {
          if (product.url === lastProductUrl) {
            console.log(`    🎯 Найден последний товар: ${product.title}`);
            startParsing = true;
            foundLastProduct = true;
          } else {
            continue;
          }
        }

        if (!startParsing) {
          continue;
        }

        // ПРОСТАЯ ПРОВЕРКА: есть ли товар уже в категории
        const existsInCategory = this.checkProductExists(product.url, existingInCurrentCategory);

        if (!foundLastProduct && existsInCategory) {
          console.log(`    ⏭️ Товар уже существует в ${categoryName}: ${product.title}`);
          continue; // ПРОСТО ПРОПУСКАЕМ, НЕ ДОБАВЛЯЕМ
        }

        // Сбрасываем флаг
        if (foundLastProduct) {
          foundLastProduct = false;
        }

        // Парсим ТОЛЬКО новые товары
        console.log(`    🔥 Парсим новый товар: ${product.title}`);

        const productDetails = await this.getProductDetails(page, product.url);

        enhancedProducts.push({
          ...product,
          ...productDetails
        });

        await this.delay(1000);
      } catch (error) {
        console.log(`    ⚠️ Ошибка парсинга ${product.title}:`, error.message);
        // Добавляем товар даже с ошибкой
        enhancedProducts.push({
          ...product,
          images: [product.imageUrl].filter(Boolean),
          description: 'Описание загружается...',
          specifications: {}
        });
      }
    }

    console.log(`    📊 На странице: ${cardData.length} товаров, добавлено новых: ${enhancedProducts.length}`);
    return enhancedProducts;
}


  async getProductDetails(page, productUrl) {
    let retries = 3; // Количество попыток

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`    📄 Попытка ${attempt}/${retries}: загружаем детали...`);

        // Увеличенный тайм-аут до 30 секунд
        await page.goto(productUrl, {
          waitUntil: 'networkidle0',
          timeout: 45000
        });

        const details = await page.evaluate(() => {
          // Собираем все изображения
          const images = [];
          const imageElements = document.querySelectorAll('img[src*="rebike-photo-nas"]');
          imageElements.forEach(img => {
            if (img.src && !images.includes(img.src)) {
              images.push(img.src);
            }
          });

          // Берем лучшее описание
          let description = '';

          // Сначала пробуем найти специфичное описание для товара
          const specificDesc = document.querySelector('h1')?.textContent.trim();
          if (specificDesc && specificDesc.length > 20) {
            description = specificDesc;
          } else {
            // Если нет - берем из meta
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
              description = metaDesc.content;
            }
          }

          // Дополняем полезной информацией
          const usageDesc = Array.from(document.querySelectorAll('p')).find(p =>
            p.textContent.includes('Für den Alltag') ||
            p.textContent.includes('eignet sich für') ||
            p.textContent.includes('Körpergröße')
          );
          if (usageDesc && description) {
            description += '. ' + usageDesc.textContent.trim();
          }

          // Парсим характеристики с проверкой наличия
          const specs = {};
          const specTables = document.querySelectorAll('table');

          // Ищем таблицу с характеристиками (проверяем все таблицы)
          let foundSpecTable = null;
          for (let i = 0; i < specTables.length; i++) {
            const tableText = specTables[i].textContent;
            if (tableText.includes('Artikel-Nr') || tableText.includes('Motor') || tableText.includes('Akku')) {
              foundSpecTable = specTables[i];
              break;
            }
          }

          if (foundSpecTable) {
            const rows = foundSpecTable.querySelectorAll('tr');
            rows.forEach(row => {
              const th = row.querySelector('th');
              const td = row.querySelector('td');
              if (th && td) {
                const key = th.textContent.trim();
                const value = td.textContent.trim();
                if (key && value && key.length < 50 && value.length < 100) {
                  specs[key] = value;
                }
              }
            });
          }

          return {
            images: images.slice(0, 8),
            description: description || 'Detaillierte Beschreibung wird geladen...',
            specifications: specs
          };
        });

        console.log(`    ✅ Детали получены успешно`);
        return details;

      } catch (error) {
        console.log(`    ⚠️ Попытка ${attempt} неудачна: ${error.message}`);

        if (attempt < retries) {
          // Пауза между попытками: 2, 4, 6 секунд
          const pauseSeconds = attempt * 4;
          console.log(`    ⏸️ Пауза ${pauseSeconds} секунд перед повтором...`);
          await this.delay(pauseSeconds * 1000);
        }
      }
    }

    // Если все попытки неудачны - возвращаем базовые данные
    console.log(`    ❌ Все попытки неудачны, используем базовые данные`);
    return {
      images: [],
      description: 'Beschreibung wird geladen...',
      specifications: {}
    };
  }
  async findResumePosition(targetCategories) {
    try {
      // Ищем последнюю непустую категорию
      for (let i = targetCategories.length - 1; i >= 0; i--) {
        const category = targetCategories[i];
        const categoryProducts = await this.loadCategoryProducts(category.type);

        if (categoryProducts.length > 0) {
          const lastProduct = categoryProducts[categoryProducts.length - 1];
          console.log(`🔍 Последний товар найден в категории ${category.type}: ${lastProduct.title}`);
          console.log(`🔄 Продолжаем с категории ${category.type}, перезапишем последний товар`);

          return {
            categoryIndex: i,
            lastProductUrl: lastProduct.url,
            shouldOverwriteLast: true
          };
        }
      }

      console.log(`🆕 Все файлы категорий пусты, начинаем с начала`);
      return { categoryIndex: 0, lastProductUrl: null, shouldOverwriteLast: false };
    } catch (error) {
      console.log(`⚠️ Ошибка определения позиции: ${error.message}, начинаем сначала`);
      return { categoryIndex: 0, lastProductUrl: null, shouldOverwriteLast: false };
    }
  }

  async removeLastProduct() {
    try {
      // Находим последнюю категорию с товарами
      const targetCategories = [
        { type: 'sales' }, { type: 'all' }, { type: 'trekking-city' },
        { type: 'trekking' }, { type: 'city' }, { type: 'urban' },
        { type: 'mountain' }, { type: 'hardtail' }, { type: 'fully' },
        { type: 'cargo' }, { type: 'speed' }, { type: 'gravel' },
        { type: 'kids' }, { type: 'classic' }
      ];

      for (let i = targetCategories.length - 1; i >= 0; i--) {
        const category = targetCategories[i];
        const categoryProducts = await this.loadCategoryProducts(category.type);

        if (categoryProducts.length > 0) {
          const removedProduct = categoryProducts.pop(); // Удаляем последний
          await this.saveCategoryProducts(category.type, categoryProducts);
          console.log(`🗑️ Удален последний товар из ${category.type}: ${removedProduct.title}`);
          return categoryProducts;
        }
      }

      return [];
    } catch (error) {
      console.error(`❌ Ошибка удаления последнего товара:`, error);
      return [];
    }
  }

  async combineAllCategories() {
    const targetCategories = [
      'sales', 'all', 'trekking-city', 'trekking', 'city', 'urban',
      'mountain', 'hardtail', 'fully', 'cargo', 'speed', 'gravel', 'kids', 'classic'
    ];

    let allProducts = [];

    for (const categoryName of targetCategories) {
      const categoryProducts = await this.loadCategoryProducts(categoryName);
      if (categoryProducts.length > 0) {
        console.log(`📂 Категория ${categoryName}: ${categoryProducts.length} товаров`);
        allProducts.push(...categoryProducts);
      }
    }

    console.log(`📊 Всего товаров: ${allProducts.length}`);

    // Сохраняем объединенный файл для совместимости
    await this.saveProducts(allProducts);

    return allProducts;
  }


  // НАЙТИ И ЗАМЕНИТЬ ВЕСЬ МЕТОД processProducts:
  processProducts(products) {
    const categoryStats = {};

    const processedProducts = products.map(product => {
      // Подсчитываем статистику категорий
      if (!categoryStats[product.category]) {
        categoryStats[product.category] = 0;
      }
      categoryStats[product.category]++;

      // Извлекаем числовые значения цен БЕЗ ДОБАВЛЕНИЯ НАЦЕНКИ
      const currentPriceNum = this.extractPrice(product.currentPrice);
      const originalPriceNum = this.extractPrice(product.originalPrice);

      // СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ ЦЕНЫ как есть
      let ourCurrentPrice = null;
      let ourOriginalPrice = null;
      let ourDiscount = 0;

      if (currentPriceNum) {
        ourCurrentPrice = currentPriceNum; // БЕЗ НАЦЕНКИ
      }

      if (originalPriceNum) {
        ourOriginalPrice = originalPriceNum; // БЕЗ НАЦЕНКИ
      }

      // Рассчитываем проценты скидки между оригинальными ценами
      if (ourCurrentPrice && ourOriginalPrice && ourOriginalPrice > ourCurrentPrice) {
        ourDiscount = Math.round((1 - ourCurrentPrice / ourOriginalPrice) * 100);
      }

      return {
        ...product,
        // Сохраняем оригинальные цены для применения наценки на фронте
        originalBasePriceEur: ourOriginalPrice, // ДОБАВЛЯЕМ базовую цену
        currentBasePriceEur: ourCurrentPrice,   // ДОБАВЛЯЕМ базовую цену
        priceRub: ourCurrentPrice ? `${ourCurrentPrice} €` : (product.currentPrice || 'Цена не указана'),
        originalPriceRub: ourOriginalPrice ? `${ourOriginalPrice} €` : null,
        originalPriceEur: product.originalPrice,
        currentPriceEur: product.currentPrice,
        discountPercent: ourDiscount,
        id: this.generateId(product.url)
      };
    });

    // Выводим статистику по категориям
    console.log('\n📊 Статистика по категориям:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} товаров`);
    });

    return processedProducts;
  }

  generateId(url) {
    // Извлекаем number из URL - это и есть ID товара
    const numberMatch = url.match(/number=(\d+)/);
    if (numberMatch) {
      return numberMatch[1]; // возвращаем число как строку
    }

    // Fallback - берем последнюю часть URL
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    const cleanId = lastPart.split('?')[0];

    // Убираем лишние символы
    return cleanId.replace(/[^a-zA-Z0-9-]/g, '') || 'unknown';
  }

  extractPrice(priceStr) {
    if (!priceStr) return null;

    // Убираем символ валюты и пробелы
    const cleanPrice = priceStr.replace(/[€$£¥₽]/g, '').trim();

    // Обрабатываем европейский формат (1.939 = 1939, 1.939,50 = 1939.50)
    let numberStr = cleanPrice;

    // Если есть запятая - это десятичная часть
    if (numberStr.includes(',')) {
      const parts = numberStr.split(',');
      // Убираем точки из целой части (разделители тысяч)
      const wholePart = parts[0].replace(/\./g, '');
      const decimalPart = parts[1];
      numberStr = wholePart + '.' + decimalPart;
    } else {
      // Если нет запятой, точки - это разделители тысяч
      numberStr = numberStr.replace(/\./g, '');
    }

    const result = parseFloat(numberStr);

    return isNaN(result) ? null : result;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
async syncWithWebsite() {
    console.log('🔄 Запуск синхронизации товаров...');
    
    if (!this.browser) await this.init();
    
    const existingProducts = await this.loadAllProducts();
    console.log(`📦 В базе сейчас: ${existingProducts.length} товаров`);
    
    const result = await this.parseAllProducts();
    
    console.log(`\n📊 Результат синхронизации:`);
    console.log(`✅ Найдено новых товаров: ${result.products.length}`);
    console.log(`📦 Добавлено в базу: ${result.products.length}`);
    
    // УДАЛЕНИЕ ТОВАРОВ УБИРАЕМ ПОЛНОСТЬЮ
    
    return {
        found: result.products,
        deleted: [], // Больше не удаляем
        changes: result.changes || { added: result.products, removed: [], updated: [] }
    };
}

  async removeObsoleteProducts(toDelete) {
    console.log('🗑️ Удаляем устаревшие товары...');

    const targetCategories = [
      'sales', 'all', 'trekking-city', 'trekking', 'city', 'urban',
      'mountain', 'hardtail', 'fully', 'cargo', 'speed', 'gravel', 'kids', 'classic'
    ];

    for (const categoryName of targetCategories) {
      try {
        const categoryProducts = await this.loadCategoryProducts(categoryName);
        const deleteUrls = new Set(toDelete.map(p => p.url));

        const filteredProducts = categoryProducts.filter(product => !deleteUrls.has(product.url));

        if (filteredProducts.length !== categoryProducts.length) {
          await this.saveCategoryProducts(categoryName, filteredProducts);
          const deletedCount = categoryProducts.length - filteredProducts.length;
          console.log(`🗑️ Из ${categoryName} удалено ${deletedCount} товаров`);
        }
      } catch (error) {
        console.error(`❌ Ошибка очистки категории ${categoryName}:`, error);
      }
    }
  }

  async loadAllProducts() {
    const targetCategories = [
      'sales', 'all', 'trekking-city', 'trekking', 'city', 'urban',
      'mountain', 'hardtail', 'fully', 'cargo', 'speed', 'gravel', 'kids', 'classic'
    ];

    let allProducts = [];

    for (const categoryName of targetCategories) {
      try {
        const categoryProducts = await this.loadCategoryProducts(categoryName);
        if (categoryProducts.length > 0) {
          console.log(`📂 Загружена категория ${categoryName}: ${categoryProducts.length} товаров`);
          allProducts.push(...categoryProducts);
        }
      } catch (error) {
        console.error(`❌ Ошибка загрузки категории ${categoryName}:`, error.message);
      }
    }

    console.log(`📦 Загружено ${allProducts.length} товаров из всех категорий`);
    return allProducts;
  }


}

module.exports = ReBikeParser;