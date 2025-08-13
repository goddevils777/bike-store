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

  async init() {
    // Создаем папку data если её нет
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

  async parseAllProducts() {
    // Очищаем массив в начале
    this.allProducts = [];

    const targetCategories = [
      { url: 'https://rebike.com/de/rebike1-sales-e-bike-angebote', type: 'sales' },
      { url: 'https://rebike.com/de/gebrauchte-e-bikes-und-pedelecs-kaufen', type: 'gebraucht' },
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

    console.log(`🎯 Будем парсить ${targetCategories.length} целевых категорий`);

    // Парсим каждую целевую категорию
    for (const category of targetCategories.slice(0, 5)) {
      console.log(`\n📂 Парсим категорию: ${category.type}`);
      console.log(`🔗 URL: ${category.url}`);

      try {
        const categoryProducts = await this.parseCategory(category.url, category.type);

        // Принудительно устанавливаем правильную категорию
        categoryProducts.forEach(product => {
          product.category = category.type;
        });

        // Убираем дубликаты ВНУТРИ этой категории по URL
        const uniqueCategoryProducts = this.removeDuplicatesInCategory(categoryProducts);

        this.allProducts.push(...uniqueCategoryProducts);
        console.log(`✅ Добавлено ${uniqueCategoryProducts.length} уникальных товаров в категорию ${category.type}`);
        if (categoryProducts.length !== uniqueCategoryProducts.length) {
          console.log(`   Убрано ${categoryProducts.length - uniqueCategoryProducts.length} дубликатов в категории`);
        }

        await this.delay(this.config.delay);
      } catch (error) {
        console.error(`❌ Ошибка парсинга категории ${category.type}:`, error.message);
      }
    }

    console.log(`\n📊 Всего товаров собрано: ${this.allProducts.length}`);

    return this.processProducts(this.allProducts);
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

  async parseCategory(categoryUrl, categoryName = 'unknown') {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.config.userAgent);

    try {
      console.log(`Парсим категорию: ${categoryName} (${categoryUrl})`);
      let pageNum = 1;
      let hasNextPage = true;
      const categoryProducts = [];

      while (hasNextPage) {
        const url = `${categoryUrl}${categoryUrl.includes('?') ? '&' : '?'}page=${pageNum}`;
        console.log(`  Страница ${pageNum}: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle0' });
        await this.delay(this.config.delay);

        const pageProducts = await this.parsePageProducts(page, categoryName);

        if (pageProducts.length === 0) {
          hasNextPage = false;
        } else {
          categoryProducts.push(...pageProducts);
          pageNum++;

          hasNextPage = await page.evaluate(() => {
            return !!document.querySelector('[aria-label="Next page"], .pagination-next, [class*="next"]');
          });
        }

        // ИЗМЕНЯЕМ: парсим 2 страницы вместо 1
        if (pageNum > 2) break;
      }

      console.log(`  Найдено товаров в категории ${categoryName}: ${categoryProducts.length}`);
      return categoryProducts;
    } finally {
      await page.close();
    }
  }

  async parsePageProducts(page, categoryName = 'unknown') {
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

    // Для каждого товара получаем дополнительные данные
    const enhancedProducts = [];

    for (const product of cardData.slice(0, 2)) { // Ограничиваем для теста до 2 товаров
      try {
        console.log(`    📄 Получаем детали для: ${product.title}`);

        const productDetails = await this.getProductDetails(page, product.url);

        enhancedProducts.push({
          ...product,
          ...productDetails
        });

        await this.delay(1000); // Задержка между запросами
      } catch (error) {
        console.log(`    ⚠️ Не удалось получить детали для ${product.title}`);
        enhancedProducts.push({
          ...product,
          images: [product.imageUrl].filter(Boolean),
          description: 'Beschreibung wird geladen...',
          specifications: {}
        });
      }
    }

    return enhancedProducts;
  }



  async getProductDetails(page, productUrl) {
    try {
      await page.goto(productUrl, { waitUntil: 'networkidle0', timeout: 15000 });

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

      return details;
    } catch (error) {
      console.log(`    ❌ Ошибка получения деталей: ${error.message}`);
      return {
        images: [],
        description: 'Beschreibung wird geladen...',
        specifications: {}
      };
    }
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
        priceRub: ourCurrentPrice ? `${ourCurrentPrice} €` : product.currentPrice,
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
    return url.split('/').pop().split('?')[0];
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
}

module.exports = ReBikeParser;