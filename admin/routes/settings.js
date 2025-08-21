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
// Запуск синхронизации товаров с логами
router.post('/:hash/api/sync-products', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
        const syncProcess = spawn('node', [path.join(__dirname, '../../src/sync.js')], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.join(__dirname, '../../')
        });

        // ДОБАВИТЬ: Таймаут для процесса (30 минут)
        const timeout = setTimeout(() => {
            console.log('🕐 Процесс синхронизации превысил лимит времени, завершаем...');
            syncProcess.kill('SIGTERM');
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Превышен лимит времени синхронизации (30 мин)' })}\n\n`);
            res.end();
        }, 30 * 60 * 1000); // 30 минут

        syncProcess.stdout.on('data', (data) => {
            const output = data.toString();
            res.write(`data: ${JSON.stringify({ type: 'log', message: output })}\n\n`);
        });

        syncProcess.stderr.on('data', (data) => {
            const output = data.toString();
            res.write(`data: ${JSON.stringify({ type: 'error', message: output })}\n\n`);
        });

        syncProcess.on('close', (code) => {
            clearTimeout(timeout); // ДОБАВИТЬ: Очищаем таймаут
            const message = code === 0 ? 'Синхронизация завершена успешно!' : 'Синхронизация завершилась с ошибкой';
            res.write(`data: ${JSON.stringify({ type: 'complete', code, message })}\n\n`);
            res.end();
        });

        syncProcess.on('error', (error) => {
            clearTimeout(timeout); // ДОБАВИТЬ: Очищаем таймаут
            res.write(`data: ${JSON.stringify({ type: 'error', message: `Ошибка запуска: ${error.message}` })}\n\n`);
            res.end();
        });

    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: `Ошибка: ${error.message}` })}\n\n`);
        res.end();
    }
});

// API для получения SMTP настроек
router.get('/:hash/api/settings/smtp', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const smtpSettings = await Settings.getSMTPSettings();
        // НЕ отправляем пароль на фронтенд
        const safeSettings = {
            ...smtpSettings,
            password: smtpSettings.password ? '••••••••' : ''
        };
        res.json(safeSettings);
    } catch (error) {
        console.error('Ошибка загрузки SMTP настроек:', error);
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    }
});

// API для сохранения SMTP настроек
router.put('/:hash/api/settings/smtp', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const { host, port, secure, user, password, enabled } = req.body;
        
        // Валидация
        if (!host || !port || !user) {
            return res.status(400).json({ error: 'Заполните обязательные поля' });
        }
        
        // Проверяем формат email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user)) {
            return res.status(400).json({ error: 'Неверный формат email' });
        }
        
        const smtpData = {
            host: host.trim(),
            port: parseInt(port),
            secure: Boolean(secure),
            user: user.trim(),
            password: password === '••••••••' ? (await Settings.getSMTPSettings()).password : password.trim(),
            enabled: Boolean(enabled)
        };
        
        await Settings.saveSMTPSettings(smtpData);
        
        res.json({ success: true, message: 'SMTP настройки сохранены' });
    } catch (error) {
        console.error('Ошибка сохранения SMTP настроек:', error);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

// API для тестирования SMTP
router.post('/:hash/api/settings/smtp/test', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const smtpSettings = await Settings.getSMTPSettings();
        
        if (!smtpSettings.enabled) {
            return res.status(400).json({ error: 'SMTP не настроен' });
        }
        
        // Тестируем отправку письма
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransporter({
            host: smtpSettings.host,
            port: smtpSettings.port,
            secure: smtpSettings.secure,
            auth: {
                user: smtpSettings.user,
                pass: smtpSettings.password
            }
        });
        
        await transporter.sendMail({
            from: smtpSettings.user,
            to: smtpSettings.user,
            subject: 'Тест SMTP настроек - ReBike Store',
            text: 'Если вы получили это письмо, значит SMTP настройки работают корректно!'
        });
        
        res.json({ success: true, message: 'Тестовое письмо отправлено успешно!' });
    } catch (error) {
        console.error('Ошибка тестирования SMTP:', error);
        res.status(500).json({ error: `Ошибка отправки: ${error.message}` });
    }
});

module.exports = router;