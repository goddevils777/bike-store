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

class ShopServer {
  constructor() {
    this.dataFile = path.join(__dirname, '../data/products.json');
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

  setupRoutes() {
    // API для получения товаров
    app.get('/api/products', async (req, res) => {
      try {
        const products = await this.loadProducts();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';

        let filteredProducts = products;

        // Поиск
        if (search) {
          filteredProducts = products.filter(product =>
            product.title.toLowerCase().includes(search.toLowerCase())
          );
        }

        // Пагинация
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        res.json({
          products: paginatedProducts,
          total: filteredProducts.length,
          page,
          totalPages: Math.ceil(filteredProducts.length / limit)
        });
      } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки товаров' });
      }
    });

    // API для получения одного товара
    app.get('/api/products/:id', async (req, res) => {
      try {
        const products = await this.loadProducts();
        const product = products.find(p => p.id === req.params.id);

        if (!product) {
          return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json(product);
      } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки товара' });
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
        const products = await this.loadProducts();
        const product = products.find(p => p.id === productId);

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
  }



  async sendOrderEmail(product, customerData, orderId) {
    try {
      // Получаем email для уведомлений из настроек БД
      let notificationEmail;
      try {
        notificationEmail = await Settings.getNotificationEmail();
      } catch (error) {
        console.log('Используем email из конфига, БД недоступна');
        notificationEmail = config.email.to;
      }

      if (!config.email.user || config.email.user === 'your-email@gmail.com') {
        console.log('Email не настроен, заказ не отправлен');
        return;
      }

      const transporter = nodemailer.createTransporter({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password
        }
      });

      const emailText = `
НОВЫЙ ЗАКАЗ #${orderId}

Товар: ${product.title}
Цена: ${product.priceRub}
Ссылка на оригинал: ${product.url}

Данные покупателя:
Имя: ${customerData.name}
Email: ${customerData.email}
Телефон: ${customerData.phone || 'не указан'}
Адрес доставки: ${customerData.address || 'не указан'}
Комментарий: ${customerData.comment || 'нет'}

Время заказа: ${new Date().toLocaleString('ru-RU')}

Заказ сохранен в системе под номером #${orderId}
      `;

      await transporter.sendMail({
        from: config.email.user,
        to: notificationEmail || config.email.to,
        subject: `Новый заказ #${orderId}: ${product.title}`,
        text: emailText
      });

      console.log('Заказ отправлен на email:', notificationEmail || config.email.to);
    } catch (error) {
      console.error('Ошибка отправки email:', error);
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