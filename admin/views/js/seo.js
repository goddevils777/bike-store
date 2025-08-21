class SeoManager {
    constructor() {
        this.hash = window.location.pathname.split('/')[2];
        this.apiBase = `/admin/${this.hash}/api`;
        this.init();
    }

    setupGlobalErrorHandler() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            if (response.status === 401 && args[0].includes('/admin/')) {
                console.log('🔐 Получена 401 ошибка, перенаправляем на вход');
                window.location.href = `/admin/${this.hash}`;
                return response;
            }
            return response;
        };
    }

    async init() {
        try {
            this.setupGlobalErrorHandler();
            await this.checkAuth();
            await this.loadSeoSettings();
            this.setupEventListeners();
            this.setupPreview();
            console.log('✅ Страница SEO настроек инициализирована');
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.redirectToLogin();
        }
    }

    async checkAuth() {
        try {
            const response = await fetch(`/admin/${this.hash}/check-auth`);
            if (!response.ok) {
                throw new Error('Не авторизован');
            }
            return await response.json();
        } catch (error) {
            throw new Error('Ошибка проверки авторизации');
        }
    }

    async loadSeoSettings() {
        try {
            const response = await fetch(`${this.apiBase}/seo`);
            if (!response.ok) throw new Error('Ошибка загрузки SEO настроек');
            
            const seoData = await response.json();
            this.fillForms(seoData);
            this.updatePreview(seoData);
        } catch (error) {
            console.error('Ошибка загрузки SEO настроек:', error);
            this.showNotification('Ошибка загрузки SEO настроек', 'error');
        }
    }

    fillForms(data) {
        // Основные SEO поля
        document.getElementById('title').value = data.title || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('keywords').value = data.keywords || '';
        document.getElementById('siteName').value = data.siteName || '';
        document.getElementById('author').value = data.author || '';
        document.getElementById('robots').value = data.robots || 'index, follow';
        document.getElementById('language').value = data.language || 'ru';

        // Open Graph
        document.getElementById('ogTitle').value = data.ogTitle || '';
        document.getElementById('ogDescription').value = data.ogDescription || '';
        document.getElementById('ogImage').value = data.ogImage || '';
        document.getElementById('ogUrl').value = data.ogUrl || '';

        // Twitter
        document.getElementById('twitterCard').value = data.twitterCard || 'summary_large_image';
        document.getElementById('twitterTitle').value = data.twitterTitle || '';
        document.getElementById('twitterDescription').value = data.twitterDescription || '';
        document.getElementById('twitterImage').value = data.twitterImage || '';

        // Schema.org
        if (data.schema) {
            document.getElementById('organizationName').value = data.schema.organizationName || '';
            document.getElementById('organizationUrl').value = data.schema.organizationUrl || '';
            document.getElementById('organizationLogo').value = data.schema.organizationLogo || '';
            document.getElementById('contactPhone').value = data.schema.contactPhone || '';
            document.getElementById('contactEmail').value = data.schema.contactEmail || '';
            
            if (data.schema.address) {
                document.getElementById('streetAddress').value = data.schema.address.streetAddress || '';
                document.getElementById('city').value = data.schema.address.city || '';
                document.getElementById('region').value = data.schema.address.region || '';
                document.getElementById('postalCode').value = data.schema.address.postalCode || '';
                document.getElementById('country').value = data.schema.address.country || '';
            }
        }
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');

                if (href === '#logout') {
                    this.logout();
                } else if (href === '#dashboard') {
                    window.location.href = `/admin/${this.hash}/dashboard`;
                } else if (href === '#orders') {
                    window.location.href = `/admin/${this.hash}/orders`;
                } else if (href === '#settings') {
                    window.location.href = `/admin/${this.hash}/settings`;
                }
            });
        });

        // Формы
        document.getElementById('basicSeoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSeoSettings();
        });

        document.getElementById('ogForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSeoSettings();
        });

        document.getElementById('twitterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSeoSettings();
        });

        document.getElementById('schemaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSeoSettings();
        });

        // Обновление превью при изменении полей
        document.getElementById('title').addEventListener('input', () => this.updatePreviewFromForm());
        document.getElementById('description').addEventListener('input', () => this.updatePreviewFromForm());
        document.getElementById('ogUrl').addEventListener('input', () => this.updatePreviewFromForm());

        // Закрытие уведомлений
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('notification-close')) {
                this.hideNotification();
            }
        });
    }

    setupPreview() {
        this.updatePreviewFromForm();
    }

    updatePreviewFromForm() {
        const title = document.getElementById('title').value || 'Заголовок страницы';
        const description = document.getElementById('description').value || 'Описание страницы для поисковых систем...';
        const url = document.getElementById('ogUrl').value || 'https://yoursite.com';

        this.updatePreview({ title, description, ogUrl: url });
    }

    updatePreview(data) {
        const preview = document.getElementById('seoPreview');
        const urlEl = preview.querySelector('.preview-url');
        const titleEl = preview.querySelector('.preview-title');
        const descEl = preview.querySelector('.preview-description');

        urlEl.textContent = data.ogUrl || 'https://yoursite.com';
        titleEl.textContent = data.title || 'Заголовок страницы';
        descEl.textContent = data.description || 'Описание страницы для поисковых систем...';
    }

    async saveSeoSettings() {
        try {
            const seoData = this.collectFormData();
            
            const response = await fetch(`${this.apiBase}/seo`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(seoData)
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения SEO настроек');
            }

            this.showNotification('SEO настройки успешно сохранены', 'success');
            this.updatePreview(seoData);

        } catch (error) {
            console.error('Ошибка сохранения SEO настроек:', error);
            this.showNotification('Ошибка сохранения SEO настроек', 'error');
        }
    }

    collectFormData() {
        return {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            keywords: document.getElementById('keywords').value,
            siteName: document.getElementById('siteName').value,
            author: document.getElementById('author').value,
            robots: document.getElementById('robots').value,
            language: document.getElementById('language').value,
            ogTitle: document.getElementById('ogTitle').value,
            ogDescription: document.getElementById('ogDescription').value,
            ogImage: document.getElementById('ogImage').value,
            ogUrl: document.getElementById('ogUrl').value,
            twitterCard: document.getElementById('twitterCard').value,
            twitterTitle: document.getElementById('twitterTitle').value,
            twitterDescription: document.getElementById('twitterDescription').value,
            twitterImage: document.getElementById('twitterImage').value,
            schema: {
                organizationName: document.getElementById('organizationName').value,
                organizationUrl: document.getElementById('organizationUrl').value,
                organizationLogo: document.getElementById('organizationLogo').value,
                contactPhone: document.getElementById('contactPhone').value,
                contactEmail: document.getElementById('contactEmail').value,
                address: {
                    streetAddress: document.getElementById('streetAddress').value,
                    city: document.getElementById('city').value,
                    region: document.getElementById('region').value,
                    postalCode: document.getElementById('postalCode').value,
                    country: document.getElementById('country').value
                }
            }
        };
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = notification.querySelector('.notification-text');

        notification.classList.remove('success', 'error', 'info');
        notification.classList.add(type);
        text.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        notification.classList.remove('show');
    }

    async logout() {
        try {
            await fetch(`/admin/${this.hash}/logout`, { method: 'POST' });
            this.redirectToLogin();
        } catch (error) {
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        window.location.href = `/admin/${this.hash}`;
    }
}

// Инициализация
let seoManager;
document.addEventListener('DOMContentLoaded', () => {
    seoManager = new SeoManager();
});