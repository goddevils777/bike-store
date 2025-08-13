class SettingsManager {
    constructor() {
        this.hash = window.location.pathname.split('/')[2];
        this.apiBase = `/admin/${this.hash}/api`;

        this.init();
    }

    // ДОБАВИТЬ МЕТОД ПОСЛЕ constructor() В КАЖДОМ ФАЙЛЕ:
    setupGlobalErrorHandler() {
        // Перехватываем все fetch запросы на 401 ошибки
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
            // Проверяем авторизацию
            await this.checkAuth();

            // Загружаем настройки
            await this.loadSettings();

            this.setupEventListeners();

            console.log('✅ Страница настроек инициализирована');
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

    async loadSettings() {
        try {
            // Загружаем все настройки
            const [contacts, markup, notificationEmail] = await Promise.all([
                this.loadContacts(),
                this.loadMarkup(),
                this.loadNotificationEmail()
            ]);

            // Заполняем формы
            this.fillContactsForm(contacts);
            this.fillMarkupForm(markup);
            this.fillEmailForm(notificationEmail);

        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    }

    async loadContacts() {
        const response = await fetch(`${this.apiBase}/settings/contacts`);
        if (!response.ok) throw new Error('Ошибка загрузки контактов');
        return await response.json();
    }

    async loadMarkup() {
        const response = await fetch(`${this.apiBase}/settings/markup`);
        if (!response.ok) throw new Error('Ошибка загрузки наценки');
        return await response.json();
    }

    async loadNotificationEmail() {
        const response = await fetch(`${this.apiBase}/settings/notification-email`);
        if (!response.ok) throw new Error('Ошибка загрузки email');
        return await response.json();
    }

    fillContactsForm(contacts) {
        document.getElementById('contactEmail').value = contacts.email || '';
        document.getElementById('contactPhone').value = contacts.phone || '';
        document.getElementById('contactHours').value = contacts.hours || '';
    }

    fillMarkupForm(markup) {
        const markupValue = markup.markup || 10;
        document.getElementById('markupPercent').value = markupValue;
        this.updateMarkupPreview(markupValue);
    }

    fillEmailForm(email) {
        document.getElementById('notificationEmail').value = email.email || '';
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
                }
            });
        });

        // Формы
        document.getElementById('contactsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveContacts();
        });

        document.getElementById('pricingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMarkup();
        });

        document.getElementById('emailForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNotificationEmail();
        });

        // Обновление превью наценки
        document.getElementById('markupPercent').addEventListener('input', (e) => {
            this.updateMarkupPreview(parseFloat(e.target.value) || 0);
        });

        // Обновление каталога
        document.getElementById('updateCatalogBtn').addEventListener('click', () => {
            this.updateCatalog();
        });

        // Обновление страницы
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadSettings();
        });

        // Закрытие уведомлений
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('notification-close')) {
                this.hideNotification();
            }
        });
    }

    async saveContacts() {
        try {
            const formData = new FormData(document.getElementById('contactsForm'));
            const contacts = {
                email: formData.get('email'),
                phone: formData.get('phone'),
                hours: formData.get('hours')
            };

            // Валидация
            if (!contacts.email || !contacts.phone || !contacts.hours) {
                this.showNotification('Заполните все поля контактов', 'error');
                return;
            }

            const response = await fetch(`${this.apiBase}/settings/contacts`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contacts)
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения контактов');
            }

            this.showNotification('Контакты успешно сохранены', 'success');

        } catch (error) {
            console.error('Ошибка сохранения контактов:', error);
            this.showNotification('Ошибка сохранения контактов', 'error');
        }
    }

    async saveMarkup() {
        try {
            const markup = parseFloat(document.getElementById('markupPercent').value);

            if (isNaN(markup) || markup < 0 || markup > 1000) {
                this.showNotification('Наценка должна быть числом от 0 до 1000', 'error');
                return;
            }

            const response = await fetch(`${this.apiBase}/settings/markup`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ markup })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения наценки');
            }

            this.showNotification('Наценка успешно сохранена', 'success');

        } catch (error) {
            console.error('Ошибка сохранения наценки:', error);
            this.showNotification('Ошибка сохранения наценки', 'error');
        }
    }

    async saveNotificationEmail() {
        try {
            const email = document.getElementById('notificationEmail').value.trim();

            if (!email) {
                this.showNotification('Введите email для уведомлений', 'error');
                return;
            }

            // Простая валидация email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.showNotification('Неверный формат email', 'error');
                return;
            }

            const response = await fetch(`${this.apiBase}/settings/notification-email`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения email');
            }

            this.showNotification('Email для уведомлений сохранен', 'success');

        } catch (error) {
            console.error('Ошибка сохранения email:', error);
            this.showNotification('Ошибка сохранения email', 'error');
        }
    }

    updateMarkupPreview(markup) {
        const originalPrice = 1000;
        const markupAmount = Math.round(originalPrice * markup / 100);
        const finalPrice = originalPrice + markupAmount;

        document.querySelector('.calculation .original').textContent = `${originalPrice} €`;
        document.querySelector('.calculation .markup').textContent = `+${markupAmount} €`;
        document.querySelector('.calculation .final').textContent = `${finalPrice} €`;
    }

    async updateCatalog() {
        try {
            const btn = document.getElementById('updateCatalogBtn');
            const statusText = document.getElementById('updateStatusText');
            const progress = document.getElementById('updateProgress');

            // Блокируем кнопку
            btn.disabled = true;
            btn.textContent = '⏳ Запуск обновления...';

            // Показываем прогресс
            statusText.textContent = 'Запуск парсинга...';
            progress.style.display = 'block';

            // Запускаем обновление (создадим отдельный API endpoint)
            const response = await fetch('/api/parse-now', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Ошибка запуска парсинга');
            }

            // Имитируем прогресс (в реальности можно использовать WebSocket или polling)
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                progressValue += Math.random() * 10;
                if (progressValue > 90) progressValue = 90;

                document.querySelector('.progress-fill').style.width = `${progressValue}%`;

                if (progressValue > 30) statusText.textContent = 'Парсинг товаров...';
                if (progressValue > 60) statusText.textContent = 'Обработка данных...';
                if (progressValue > 80) statusText.textContent = 'Сохранение в базу...';
            }, 500);

            // Ждем завершения (можно заменить на реальную проверку статуса)
            setTimeout(() => {
                clearInterval(progressInterval);
                document.querySelector('.progress-fill').style.width = '100%';
                statusText.textContent = 'Обновление завершено успешно!';

                setTimeout(() => {
                    progress.style.display = 'none';
                    statusText.textContent = 'Готов к обновлению';
                    btn.disabled = false;
                    btn.textContent = '🚀 Запустить обновление каталога';
                }, 2000);
            }, 5000);

            this.showNotification('Обновление каталога запущено', 'success');

        } catch (error) {
            console.error('Ошибка обновления каталога:', error);
            this.showNotification('Ошибка запуска обновления', 'error');

            // Возвращаем кнопку в исходное состояние
            const btn = document.getElementById('updateCatalogBtn');
            btn.disabled = false;
            btn.textContent = '🚀 Запустить обновление каталога';

            document.getElementById('updateProgress').style.display = 'none';
            document.getElementById('updateStatusText').textContent = 'Готов к обновлению';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = notification.querySelector('.notification-text');

        // Убираем старые классы типов
        notification.classList.remove('success', 'error', 'info');

        // Добавляем новый тип
        notification.classList.add(type);

        text.textContent = message;
        notification.classList.add('show');

        // Автоскрытие через 5 секунд
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
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});