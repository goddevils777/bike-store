const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const Order = require('../models/Order');
const router = express.Router();

// Получить все заказы с фильтрами
router.get('/:hash/api/orders', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

        const filters = {};
        if (status) filters.status = status;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const orders = await Order.getAll(filters);

        // Пагинация
        const offset = (page - 1) * limit;
        const paginatedOrders = orders.slice(offset, offset + parseInt(limit));

        res.json({
            orders: paginatedOrders,
            pagination: {
                total: orders.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(orders.length / limit)
            }
        });
    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка получения заказов' });
    }
});


// Получить статистику заказов
router.get('/:hash/api/orders/stats/summary', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const stats = await Order.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// НАЙТИ И ЗАМЕНИТЬ МАРШРУТ /export НА:
router.get('/:hash/api/orders/export', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { status, dateFrom, dateTo } = req.query;

        const filters = {};
        if (status) filters.status = status;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const orders = await Order.getAll(filters);

        // Создаем CSV с правильной кодировкой
        const csvHeader = 'ID,Дата,Товар,Клиент,Email,Телефон,Адрес,Цена,Статус\n';

        const csvRows = orders.map(order => {
            const date = new Date(order.created_at).toLocaleDateString('ru-RU');
            return [
                order.id,
                `"${date}"`,
                `"${order.product_title.replace(/"/g, '""')}"`, // Экранируем кавычки
                `"${order.customer_name.replace(/"/g, '""')}"`,
                order.customer_email,
                `"${order.customer_phone || ''}"`,
                `"${order.customer_address || ''}"`,
                `"${order.product_price}"`,
                order.status
            ].join(',');
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        // Устанавливаем правильные заголовки
        const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Добавляем BOM для корректного отображения в Excel
        res.send('\uFEFF' + csvContent);

        console.log(`📥 Экспорт заказов: ${orders.length} записей в файл ${filename}`);

    } catch (error) {
        console.error('Ошибка экспорта заказов:', error);
        res.status(500).json({ error: 'Ошибка экспорта заказов' });
    }
});

// Получить заказ по ID
router.get('/:hash/api/orders/:id', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const order = await Order.getById(req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json(order);
    } catch (error) {
        console.error('Ошибка получения заказа:', error);
        res.status(500).json({ error: 'Ошибка получения заказа' });
    }
});

// Обновить статус заказа
router.put('/:hash/api/orders/:id/status', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Статус обязателен' });
        }

        // Проверяем валидность статуса
        const adminConfig = require('../../config/admin-config.json');
        const validStatuses = adminConfig.orderStatuses.map(s => s.value);

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Неверный статус' });
        }

        const result = await Order.updateStatus(req.params.id, status);

        if (!result.updated) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json({
            success: true,
            message: 'Статус обновлен',
            order: result
        });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка обновления статуса' });
    }
});


module.exports = router;