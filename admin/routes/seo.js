const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

const seoConfigPath = path.join(__dirname, '../../config/seo-config.json');

// Страница SEO настроек
router.get('/:hash/seo', adminAuth.checkSecretHash, adminAuth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/seo.html'));
});

// API для получения SEO настроек
router.get('/:hash/api/seo', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const seoConfig = await loadSeoConfig();
        res.json(seoConfig);
    } catch (error) {
        console.error('Ошибка загрузки SEO конфига:', error);
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    }
});

// API для сохранения SEO настроек
router.put('/:hash/api/seo', adminAuth.checkSecretHash, adminAuth.requireAuth, async (req, res) => {
    try {
        const seoData = req.body;
        
        // Валидация
        if (!seoData.title || !seoData.description) {
            return res.status(400).json({ error: 'Title и Description обязательны' });
        }
        
        await saveSeoConfig(seoData);
        res.json({ success: true, message: 'SEO настройки сохранены' });
    } catch (error) {
        console.error('Ошибка сохранения SEO:', error);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

async function loadSeoConfig() {
    try {
        const data = await fs.readFile(seoConfigPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Возвращаем дефолтные настройки если файл не существует
        return {
            title: "Электровелосипеды - Купить E-Bike | ReBike Store",
            description: "Широкий выбор электровелосипедов по выгодным ценам. Городские, горные, грузовые e-bike. Гарантия качества. Быстрая доставка.",
            keywords: "электровелосипед, e-bike, купить электровелосипед, электрический велосипед, pedelec",
            siteName: "ReBike Store",
            author: "ReBike Store",
            robots: "index, follow",
            language: "ru",
            ogTitle: "Электровелосипеды - Купить E-Bike | ReBike Store",
            ogDescription: "Широкий выбор электровелосипедов по выгодным ценам. Городские, горные, грузовые e-bike.",
            ogImage: "/images/og-image.jpg",
            ogUrl: "https://yoursite.com",
            twitterCard: "summary_large_image",
            twitterTitle: "Электровелосипеды - Купить E-Bike | ReBike Store",
            twitterDescription: "Широкий выбор электровелосипедов по выгодным ценам.",
            twitterImage: "/images/twitter-image.jpg",
            schema: {
                organizationName: "ReBike Store",
                organizationUrl: "https://yoursite.com",
                organizationLogo: "/images/logo.png",
                contactPhone: "+7 (999) 123-45-67",
                contactEmail: "info@rebikestore.com",
                address: {
                    streetAddress: "ул. Примерная, 123",
                    city: "Москва", 
                    region: "Московская область",
                    postalCode: "123456",
                    country: "Россия"
                }
            }
        };
    }
}

async function saveSeoConfig(config) {
    await fs.writeFile(seoConfigPath, JSON.stringify(config, null, 2));
}

module.exports = router;