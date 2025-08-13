const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const Settings = require('../models/Settings');
const router = express.Router();

// Получить все настройки
router.get('/:hash/api/settings', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const settings = await Settings.getAll();
        res.json(settings);
    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
});

// Получить контактную информацию
router.get('/:hash/api/settings/contacts', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const contacts = await Settings.getContacts();
        res.json(contacts);
    } catch (error) {
        console.error('Ошибка получения контактов:', error);
        res.status(500).json({ error: 'Ошибка получения контактов' });
    }
});

// Обновить контактную информацию
router.put('/:hash/api/settings/contacts', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { email, phone, hours } = req.body;
        
        // Валидация
        if (!email || !phone || !hours) {
            return res.status(400).json({ error: 'Все поля контактов обязательны' });
        }
        
        // Простая валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Неверный формат email' });
        }
        
        await Settings.updateContacts({ email, phone, hours });
        
        res.json({ 
            success: true, 
            message: 'Контакты обновлены',
            contacts: { email, phone, hours }
        });
    } catch (error) {
        console.error('Ошибка обновления контактов:', error);
        res.status(500).json({ error: 'Ошибка обновления контактов' });
    }
});

// Получить процент наценки
router.get('/:hash/api/settings/markup', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const markup = await Settings.getMarkupPercent();
        res.json({ markup });
    } catch (error) {
        console.error('Ошибка получения наценки:', error);
        res.status(500).json({ error: 'Ошибка получения наценки' });
    }
});

// Обновить процент наценки
// НАЙТИ И ЗАМЕНИТЬ:
router.put('/:hash/api/settings/markup', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { markup } = req.body;
        
        console.log('📝 ОТЛАДКА: Получен запрос на сохранение наценки:', markup);
        
        // Валидация
        if (markup === undefined || markup === null) {
            console.log('❌ ОТЛАДКА: Наценка не передана');
            return res.status(400).json({ error: 'Наценка обязательна' });
        }
        
        const markupNum = parseFloat(markup);
        console.log('📝 ОТЛАДКА: Обработанная наценка:', markupNum);
        
        if (isNaN(markupNum) || markupNum < 0 || markupNum > 1000) {
            console.log('❌ ОТЛАДКА: Неверное значение наценки');
            return res.status(400).json({ error: 'Наценка должна быть числом от 0 до 1000' });
        }
        
        console.log('💾 ОТЛАДКА: Сохраняем наценку в БД:', markupNum);
        await Settings.setMarkupPercent(markupNum);
        
        // Проверяем что сохранилось
        const savedMarkup = await Settings.getMarkupPercent();
        console.log('✅ ОТЛАДКА: Наценка сохранена и проверена:', savedMarkup);
        
        res.json({ 
            success: true, 
            message: 'Наценка обновлена',
            markup: savedMarkup
        });
    } catch (error) {
        console.error('❌ ОТЛАДКА: Ошибка обновления наценки:', error);
        res.status(500).json({ error: 'Ошибка обновления наценки' });
    }
});

// Получить email для уведомлений
router.get('/:hash/api/settings/notification-email', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const email = await Settings.getNotificationEmail();
        res.json({ email });
    } catch (error) {
        console.error('Ошибка получения email уведомлений:', error);
        res.status(500).json({ error: 'Ошибка получения email уведомлений' });
    }
});

// Обновить email для уведомлений
router.put('/:hash/api/settings/notification-email', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Валидация
        if (!email) {
            return res.status(400).json({ error: 'Email обязателен' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Неверный формат email' });
        }
        
        await Settings.setNotificationEmail(email);
        
        res.json({ 
            success: true, 
            message: 'Email для уведомлений обновлен',
            email
        });
    } catch (error) {
        console.error('Ошибка обновления email уведомлений:', error);
        res.status(500).json({ error: 'Ошибка обновления email уведомлений' });
    }
});

// Обновить несколько настроек одновременно
router.put('/:hash/api/settings/bulk', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const settings = req.body;
        
        if (!settings || Object.keys(settings).length === 0) {
            return res.status(400).json({ error: 'Настройки не переданы' });
        }
        
        const result = await Settings.updateMultiple(settings);
        
        res.json({ 
            success: true, 
            message: 'Настройки обновлены',
            updated: result
        });
    } catch (error) {
        console.error('Ошибка массового обновления настроек:', error);
        res.status(500).json({ error: 'Ошибка обновления настроек' });
    }
});

// Получить конфигурацию email
router.get('/:hash/api/settings/email-config', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const emailConfig = await Settings.getEmailConfig();
        res.json(emailConfig);
    } catch (error) {
        console.error('Ошибка получения конфигурации email:', error);
        res.status(500).json({ error: 'Ошибка получения конфигурации email' });
    }
});

module.exports = router;