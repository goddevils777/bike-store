const express = require('express');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

// Страница входа в админку (по секретной ссылке)
router.get('/:hash', adminAuth.checkSecretHash, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

// API для проверки пин-кода
router.post('/:hash/login', adminAuth.checkSecretHash, adminAuth.verifyPin, (req, res) => {
    res.json({ 
        success: true, 
        message: 'Авторизация успешна',
        redirectUrl: `/admin/${req.params.hash}/dashboard`
    });
});

// Главная страница админки (дашборд)
router.get('/:hash/dashboard', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Страница управления заказами
router.get('/:hash/orders', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/orders.html'));
});

// Страница настроек
router.get('/:hash/settings', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// Проверка статуса сессии
router.get('/:hash/check-auth', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    res.json({ 
        authenticated: true, 
        session: {
            id: req.session.id,
            createdAt: req.session.createdAt,
            expiresAt: req.session.expiresAt
        }
    });
});

// Выход из системы
router.post('/:hash/logout', adminAuth.checkSecretHash, (req, res) => {
    adminAuth.logout(req, res);
});

// API для получения информации об админке
router.get('/:hash/info', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    const adminConfig = require('../../config/admin-config.json');
    res.json({
        title: adminConfig.ui.title,
        orderStatuses: adminConfig.orderStatuses,
        itemsPerPage: adminConfig.ui.itemsPerPage
    });
});

module.exports = router;