const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const config = require('../config/config.json');

const app = express();

// Безопасность
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
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
  message: 'Слишком много запросов, попробуйте позже'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

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

    // API для отправки заказа
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

        // Отправляем заказ на email
        await this.sendOrderEmail(product, customerData);

        res.json({ 
          success: true, 
          message: 'Заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.' 
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
  }

  async sendOrderEmail(product, customerData) {
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
НОВЫЙ ЗАКАЗ

Товар: ${product.title}
Цена: ${product.priceRub}
Ссылка на оригинал: ${product.url}

Данные покупателя:
Имя: ${customerData.name}
Email: ${customerData.email}
Телефон: ${customerData.phone || 'не указан'}
Комментарий: ${customerData.comment || 'нет'}

Время заказа: ${new Date().toLocaleString('ru-RU')}
    `;

    await transporter.sendMail({
      from: config.email.user,
      to: config.email.to,
      subject: `Новый заказ: ${product.title}`,
      text: emailText
    });

    console.log('Заказ отправлен на email:', config.email.to);
  }

  start() {
    const port = config.server.port;
    app.listen(port, () => {
      console.log(`Сервер запущен на http://localhost:${port}`);
      console.log(`API товаров: http://localhost:${port}/api/products`);
    });
  }
}

const server = new ShopServer();
server.start();

module.exports = ShopServer;