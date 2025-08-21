const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const config = require('../config/config.json');

// Импорт админки
const Order = require('../admin/models/Order');
const Settings = require('../admin/models/Settings');
const adminAuthRoutes = require('../admin/routes/auth');
const adminOrdersRoutes = require('../admin/routes/orders');
const adminSettingsRoutes = require('../admin/routes/settings');


const app = express();

// Безопасность
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "script-src-attr": ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: config.security.allowedOrigins
}));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.security.maxRequestsPerMinute,
  message: 'Слишком много запросов, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// ДОБАВИТЬ ПОСЛЕ app.use(express.static(...))
app.use('/admin/css', express.static(path.join(__dirname, '../admin/views/css')));
app.use('/admin/js', express.static(path.join(__dirname, '../admin/views/js')));

// Подключение маршрутов админки
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminOrdersRoutes);
app.use('/admin', adminSettingsRoutes);

// Подключение маршрутов админки
const adminSeoRoutes = require('../admin/routes/seo');
app.use('/admin', adminSeoRoutes);  // ДОБАВИТЬ ЭТУ СТРОКУ

class ShopServer {
  constructor() {
    this.dataFile = path.join(__dirname, '../data/products.json');
    this.allProductsCache = null; // ДОБАВИТЬ ЭТУ СТРОКУ
    this.setupRoutes();
  }

  async loadProducts() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }


  async loadCategoryProducts(categoryName) {
    try {
      const filePath = path.join(__dirname, `../data/products_${categoryName}.json`);
      console.log(`🔍 Пытаемся загрузить: ${filePath}`);

      const data = await fs.readFile(filePath, 'utf8');
      const products = JSON.parse(data);

      console.log(`✅ Загружено ${products.length} товаров из ${categoryName}`);
      return products;
    } catch (error) {
      console.log(`❌ Не удалось загрузить ${categoryName}: ${error.message}`);
      return [];
    }
  }

  async loadAllProducts() {
    const targetCategories = [
      'sales', 'all', 'trekking', 'city', 'urban', 'mountain', 'hardtail',
      'fully', 'cargo', 'speed', 'gravel', 'kids', 'classic'
    ];

    let allProducts = [];

    for (const categoryName of targetCategories) {
      try {
        const categoryProducts = await this.loadCategoryProducts(categoryName);
        if (categoryProducts.length > 0) {
          console.log(`📂 Загружена категория ${categoryName}: ${categoryProducts.length} товаров`);
          allProducts.push(...categoryProducts);
        } else {
          console.log(`⚠️ Категория ${categoryName}: файл пустой или не найден`);
        }
      } catch (error) {
        console.error(`❌ Ошибка загрузки категории ${categoryName}:`, error.message);
      }
    }

    console.log(`📦 Загружено ${allProducts.length} товаров из всех категорий`);
    return allProducts;
  }


  async loadSeoConfig() {
    const path = require('path');
    const fs = require('fs').promises;

    try {
      const seoConfigPath = path.join(__dirname, '../config/seo-config.json');
      const data = await fs.readFile(seoConfigPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Возвращаем дефолтные SEO настройки если файл не найден
      return {
        title: "Электровелосипеды - Купить E-Bike | ReBike Store",
        description: "Широкий выбор электровелосипедов по выгодным ценам. Городские, горные, грузовые e-bike.",
        keywords: "электровелосипед, e-bike, купить электровелосипед",
        siteName: "ReBike Store",
        author: "ReBike Store",
        robots: "index, follow",
        language: "ru",
        ogTitle: "Электровелосипеды - Купить E-Bike | ReBike Store",
        ogDescription: "Широкий выбор электровелосипедов по выгодным ценам.",
        ogImage: "/images/og-image.jpg",
        ogUrl: "https://yoursite.com"
      };
    }
  }

  setupRoutes() {

    // API для получения одного товара




    app.get('/api/products', async (req, res) => {
      try {
        const { category, page = 1, limit = 24, search = '', sort = 'default' } = req.query;
        console.log(`🔍 API запрос: категория="${category}", страница=${page}, лимит=${limit}, сортировка="${sort}"`);

        let allProducts;

        if (!category || category === 'undefined') {
          console.log(`📦 Категория не указана, загружаем 'all'...`);
          allProducts = await this.loadCategoryProducts('all');
        } else {
          allProducts = await this.loadCategoryProducts(category);
          console.log(`📂 Загружена категория ${category}: ${allProducts.length} товаров`);
        }

        // Применяем поиск КО ВСЕМ товарам
        let filteredProducts = allProducts;
        if (search) {
          filteredProducts = allProducts.filter(product =>
            product.title.toLowerCase().includes(search.toLowerCase())
          );
          console.log(`🔍 После поиска "${search}": ${filteredProducts.length} из ${allProducts.length} товаров`);
        }

        // ПРИМЕНЯЕМ СОРТИРОВКУ ПЕРЕД ПАГИНАЦИЕЙ
        if (sort && sort !== 'default') {
          console.log(`📊 Применяем сортировку: ${sort}`);

          switch (sort) {
            case 'price-asc':
              filteredProducts.sort((a, b) => {
                const priceA = a.currentBasePriceEur || this.extractPrice(a.priceRub) || 0;
                const priceB = b.currentBasePriceEur || this.extractPrice(b.priceRub) || 0;
                return priceA - priceB;
              });
              break;
            case 'price-desc':
              filteredProducts.sort((a, b) => {
                const priceA = a.currentBasePriceEur || this.extractPrice(a.priceRub) || 0;
                const priceB = b.currentBasePriceEur || this.extractPrice(b.priceRub) || 0;
                return priceB - priceA;
              });
              break;
            case 'name-asc':
              filteredProducts.sort((a, b) => a.title.localeCompare(b.title));
              break;
            case 'name-desc':
              filteredProducts.sort((a, b) => b.title.localeCompare(a.title));
              break;
          }
          console.log(`✅ Сортировка ${sort} применена к ${filteredProducts.length} товарам`);
        }

        // СЕРВЕРНАЯ ПАГИНАЦИЯ - берем только нужную страницу
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / limitNum);

        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const pageProducts = filteredProducts.slice(startIndex, endIndex);

        console.log(`📄 Страница ${pageNum}/${totalPages}: товары ${startIndex + 1}-${Math.min(endIndex, totalProducts)} из ${totalProducts}`);

        res.json({
          products: pageProducts, // Только 24 товара текущей страницы
          pagination: {
            currentPage: pageNum,
            totalPages: totalPages, // Все страницы (например 52 для 1250 товаров)
            totalProducts: totalProducts, // Общее количество товаров в категории
            productsPerPage: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            startIndex: startIndex + 1,
            endIndex: Math.min(endIndex, totalProducts)
          }
        });
      } catch (error) {
        console.error('Ошибка API товаров:', error);
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
      }
    });

    app.get('/api/products/:id', async (req, res) => {
      try {
        console.log(`🔍 Ищем товар с ID: "${req.params.id}"`);

        // Кешируем все товары при первом запросе
        if (!this.allProductsCache) {
          console.log(`📦 Загружаем кеш всех товаров...`);
          this.allProductsCache = await this.loadAllProducts();
          console.log(`✅ Загружено в кеш: ${this.allProductsCache.length} товаров`);
        }

        const product = this.allProductsCache.find(p => p.id === req.params.id);

        if (!product) {
          console.log(`❌ Товар с ID "${req.params.id}" не найден`);
          // Сбрасываем кеш и пробуем еще раз
          this.allProductsCache = null;
          return res.status(404).json({ error: 'Товар не найден' });
        }

        console.log(`✅ Товар найден: ${product.title}`);
        res.json(product);
      } catch (error) {
        console.error('Ошибка поиска товара:', error);
        res.status(500).json({ error: 'Ошибка загрузки товара' });
      }
    });


    app.get('/api/categories', async (req, res) => {
      try {
        const targetCategories = [
          'sales', 'all', 'trekking-city', 'trekking', 'city', 'urban',
          'mountain', 'hardtail', 'fully', 'cargo', 'speed', 'gravel', 'kids', 'classic'
        ];

        const categoriesWithCount = [];

        for (const categoryName of targetCategories) {
          const products = await this.loadCategoryProducts(categoryName);
          categoriesWithCount.push({
            name: categoryName,
            count: products.length,
            available: products.length > 0
          });
        }

        res.json(categoriesWithCount);
      } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        res.status(500).json({ error: 'Ошибка загрузки категорий' });
      }
    });

    app.get('/api/contacts', async (req, res) => {
      try {
        const Settings = require('../admin/models/Settings');
        const contacts = await Settings.getContacts();
        res.json(contacts);
      } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
        // Возвращаем дефолтные контакты если БД недоступна
        res.json({
          email: 'info@rebike-store.ru',
          phone: '+7 (999) 123-45-67',
          hours: 'Пн-Пт 9:00-18:00'
        });
      }
    });

    app.get('/api/markup', async (req, res) => {
      try {
        const Settings = require('../admin/models/Settings');
        const markup = await Settings.getMarkupPercent();
        res.json({ markup });
      } catch (error) {
        console.error('Ошибка загрузки наценки:', error);
        // Возвращаем дефолтную наценку 10%
        res.json({ markup: 10 });
      }
    });

    // Обновленный API для отправки заказа
    app.post('/api/order', async (req, res) => {
      try {
        const { productId, customerData } = req.body;

        // Валидация
        if (!productId || !customerData || !customerData.name || !customerData.email) {
          return res.status(400).json({ error: 'Не все поля заполнены' });
        }

        // Проверяем email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerData.email)) {
          return res.status(400).json({ error: 'Неверный формат email' });
        }

        // Находим товар
        if (!this.allProductsCache) {
          this.allProductsCache = await this.loadAllProducts();
        }
        const product = this.allProductsCache.find(p => p.id === productId);

        if (!product) {
          return res.status(404).json({ error: 'Товар не найден' });
        }

        // Сохраняем заказ в БД
        const orderData = {
          productId: product.id,
          productTitle: product.title,
          productPrice: product.priceRub,
          productUrl: product.url,
          customerName: customerData.name,
          customerEmail: customerData.email,
          customerPhone: customerData.phone,
          customerAddress: customerData.address,
          customerComment: customerData.comment
        };

        const savedOrder = await Order.create(orderData);

        // Отправляем заказ на email
        await this.sendOrderEmail(product, customerData, savedOrder.id);

        res.json({
          success: true,
          message: 'Заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.',
          orderId: savedOrder.id
        });

      } catch (error) {
        console.error('Ошибка при обработке заказа:', error);
        res.status(500).json({ error: 'Ошибка при отправке заказа' });
      }
    });

    // Главная страница
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // ДОБАВИТЬ ПОСЛЕ app.post('/api/order', ...)

    // API для запуска парсинга из админки
    app.post('/api/parse-now', async (req, res) => {
      try {
        // Импортируем парсер
        const UpdateScheduler = require('./scheduler');

        console.log('🚀 Запуск ручного обновления каталога из админки');

        // Создаем экземпляр планировщика и запускаем разовое обновление
        const scheduler = new UpdateScheduler();

        // Запускаем в фоне, не ждем завершения
        scheduler.runUpdate().then(() => {
          console.log('✅ Ручное обновление каталога завершено');
        }).catch((error) => {
          console.error('❌ Ошибка ручного обновления:', error);
        });

        // Сразу отвечаем что запустили
        res.json({
          success: true,
          message: 'Обновление каталога запущено в фоновом режиме'
        });

      } catch (error) {
        console.error('Ошибка запуска парсинга:', error);
        res.status(500).json({ error: 'Ошибка запуска обновления каталога' });
      }
    });


    // API для получения SEO данных
    app.get('/api/seo', async (req, res) => {
      try {
        const seoConfig = await this.loadSeoConfig();
        res.json(seoConfig);
      } catch (error) {
        console.error('Ошибка загрузки SEO конфига:', error);
        res.status(500).json({ error: 'Ошибка загрузки SEO данных' });
      }
    });

  }

  extractPrice(priceStr) {
    if (!priceStr) return null;
    const match = priceStr.match(/(\d+[\d\s,\.]*)/);
    return match ? parseFloat(match[1].replace(/[\s,]/g, '')) : null;
  }

  async sendOrderEmail(product, customerData, orderId) {
    try {
      // Загружаем SMTP настройки из админки
      const smtpSettings = await this.loadSMTPSettings();

      if (!smtpSettings || !smtpSettings.enabled) {
        console.log('📧 SMTP не настроен или отключен, письмо не отправлено');
        return;
      }

      // Загружаем email получателя из админки
      const emailSettings = await this.loadEmailSettings();
      const recipientEmail = emailSettings?.email || smtpSettings.user;

      console.log(`📧 Отправляем заказ на email: ${recipientEmail}`);

      const nodemailer = require('nodemailer');

      // Создаем транспорт с настройками из админки
      const transporter = nodemailer.createTransporter({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure,
        auth: {
          user: smtpSettings.user,
          pass: smtpSettings.password
        }
      });

      // Формируем красивое HTML письмо
      const emailHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px;">🚴‍♂️ Новый заказ!</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">ReBike Store</p>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
                    <h2 style="color: #2d3748; margin-bottom: 20px;">Заказ #${orderId}</h2>
                    
                    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #2d3748; margin-top: 0;">🚲 Товар:</h3>
                        <p style="font-size: 18px; font-weight: 600; color: #2d3748; margin: 10px 0;">${product.title}</p>
                        <p style="font-size: 24px; font-weight: 700; color: #38a169; margin: 10px 0;">${product.priceRub}</p>
                        ${product.originalPriceRub ? `<p style="color: #a0aec0; text-decoration: line-through;">Цена в оригинале: ${product.originalPriceRub}</p>` : ''}
                        <p style="color: #4a5568; margin: 15px 0 0 0;">
                            <a href="${product.url}" style="color: #4299e1; text-decoration: none;">🔗 Ссылка на оригинал</a>
                        </p>
                    </div>

                    <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #22543d; margin-top: 0;">👤 Данные покупателя:</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #4a5568; font-weight: 600;">Имя:</td><td style="padding: 8px 0;">${customerData.name}</td></tr>
                            <tr><td style="padding: 8px 0; color: #4a5568; font-weight: 600;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${customerData.email}" style="color: #4299e1;">${customerData.email}</a></td></tr>
                            <tr><td style="padding: 8px 0; color: #4a5568; font-weight: 600;">Телефон:</td><td style="padding: 8px 0;">${customerData.phone || 'не указан'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #4a5568; font-weight: 600;">Адрес:</td><td style="padding: 8px 0;">${customerData.address || 'не указан'}</td></tr>
                            ${customerData.comment ? `<tr><td style="padding: 8px 0; color: #4a5568; font-weight: 600;">Комментарий:</td><td style="padding: 8px 0;">${customerData.comment}</td></tr>` : ''}
                        </table>
                    </div>

                    <div style="background: #ebf8ff; padding: 20px; border-radius: 8px;">
                        <p style="color: #2c5282; margin: 0; text-align: center;">
                            ⏰ Время заказа: ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                </div>
                
                <div style="background: #f7fafc; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; color: #4a5568; font-size: 14px;">
                    Автоматическое уведомление от ReBike Store
                </div>
            </div>
        `;

      const emailText = `
🚴‍♂️ НОВЫЙ ЗАКАЗ #${orderId} - ReBike Store

ТОВАР:
${product.title}
Цена: ${product.priceRub}
${product.originalPriceRub ? `Цена в оригинале: ${product.originalPriceRub}` : ''}
Ссылка: ${product.url}

ПОКУПАТЕЛЬ:
Имя: ${customerData.name}
Email: ${customerData.email}  
Телефон: ${customerData.phone || 'не указан'}
Адрес: ${customerData.address || 'не указан'}
${customerData.comment ? `Комментарий: ${customerData.comment}` : ''}

Время заказа: ${new Date().toLocaleString('ru-RU')}

---
Автоматическое уведомление от ReBike Store
        `;

      await transporter.sendMail({
        from: `"ReBike Store" <${smtpSettings.user}>`,
        to: recipientEmail,
        subject: `🚴‍♂️ Новый заказ #${orderId}: ${product.title}`,
        text: emailText,
        html: emailHTML
      });

      console.log(`✅ Заказ #${orderId} отправлен на email: ${recipientEmail}`);

    } catch (error) {
      console.error('❌ Ошибка отправки email:', error);
    }
  }

async loadSMTPSettings() {
    try {
        const Settings = require('../admin/models/Settings');
        return await Settings.getSMTPSettings();
    } catch (error) {
        console.error('Ошибка загрузки SMTP настроек:', error);
        return null;
    }
}

async loadEmailSettings() {
    try {
        const Settings = require('../admin/models/Settings');
        const notificationEmail = await Settings.getNotificationEmail();
        return { email: notificationEmail };
    } catch (error) {
        console.error('Ошибка загрузки email настроек:', error);
        return null;
    }
}

  start() {
    const port = config.server.port;
    app.listen(port, () => {
      console.log(`Сервер запущен на http://localhost:${port}`);
      console.log(`API товаров: http://localhost:${port}/api/products`);
      console.log(`Админка: http://localhost:${port}/admin/a8f5f167f44f4964e6c998dee827110c`);
    });
  }
}



const server = new ShopServer();
server.start();

module.exports = ShopServer;