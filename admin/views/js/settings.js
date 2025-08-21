class SettingsManager {
    constructor() {
        this.hash = window.location.pathname.split('/')[2];
        this.apiBase = `/admin/${this.hash}/api`;

        this.init();
    }

    // Добавить после constructor()
    saveSyncState(state) {
        localStorage.setItem('admin_sync_state', JSON.stringify({
            ...state,
            timestamp: Date.now()
        }));
    }

    loadSyncState() {
        try {
            const saved = localStorage.getItem('admin_sync_state');
            if (!saved) return null;

            const state = JSON.parse(saved);
            // Показываем состояние только если прошло меньше часа
            const hourAgo = Date.now() - (60 * 60 * 1000);

            if (state.timestamp > hourAgo) {
                return state;
            }
        } catch (e) {
            console.error('Ошибка загрузки состояния:', e);
        }
        return null;
    }

    clearSyncState() {
        localStorage.removeItem('admin_sync_state');
    }

    restoreSyncState() {
        const state = this.loadSyncState();
        if (!state) return;

        const progressContainer = document.getElementById('updateProgress');
        const statusText = document.getElementById('updateStatusText');
        const logsContainer = this.createLogsContainer();

        // Восстанавливаем UI
        progressContainer.style.display = 'block';
        statusText.textContent = state.statusText || 'Синхронизация завершена';
        this.updateProgress(state.progress || 100, state.statusText);

        // Восстанавливаем логи
        if (state.logs) {
            logsContainer.innerHTML = state.logs;
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        // Добавляем кнопку очистки
        this.addClearButton(progressContainer);
    }

    addClearButton(container) {
        let clearBtn = document.getElementById('clearLogsBtn');
        if (clearBtn) return;

        clearBtn = document.createElement('button');
        clearBtn.id = 'clearLogsBtn';
        clearBtn.textContent = '🗑️ Очистить логи';
        clearBtn.style.cssText = `
        margin-top: 16px;
        padding: 8px 16px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
    `;

        clearBtn.onclick = () => {
            container.style.display = 'none';
            this.clearSyncState();
        };

        container.appendChild(clearBtn);
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
            await this.checkAuth();
            await this.loadSettings();
            this.setupEventListeners();

            // ДОБАВИТЬ: Восстанавливаем состояние синхронизации
            setTimeout(() => {
                this.restoreSyncState();
            }, 500);

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

    // Добавь после метода loadNotificationEmail()
    async loadSMTPSettings() {
        try {
            const response = await fetch(`${this.apiBase}/settings/smtp`);
            if (!response.ok) throw new Error('Ошибка загрузки SMTP настроек');
            return await response.json();
        } catch (error) {
            console.error('Ошибка загрузки SMTP:', error);
            return null;
        }
    }

    // Добавь в метод loadSettings()
    async loadSettings() {
        try {
            // Загружаем все настройки
            const [contacts, markup, notificationEmail, smtpSettings] = await Promise.all([
                this.loadContacts(),
                this.loadMarkup(),
                this.loadNotificationEmail(),
                this.loadSMTPSettings() // ДОБАВИТЬ ЭТУ СТРОКУ
            ]);

            // Заполняем формы
            this.fillContactsForm(contacts);
            this.fillMarkupForm(markup);
            this.fillEmailForm(notificationEmail);
            this.fillSMTPForm(smtpSettings); // ДОБАВИТЬ ЭТУ СТРОКУ
            this.updateSMTPStatus(smtpSettings); // ДОБАВИТЬ ЭТУ СТРОКУ

        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    }

    // Добавь новые методы для SMTP
    fillSMTPForm(smtpSettings) {
        if (!smtpSettings) return;

        document.getElementById('smtpHost').value = smtpSettings.host || 'smtp.gmail.com';
        document.getElementById('smtpPort').value = smtpSettings.port || 587;
        document.getElementById('smtpSecure').checked = smtpSettings.secure || false;
        document.getElementById('smtpUser').value = smtpSettings.user || '';
        document.getElementById('smtpPassword').value = smtpSettings.password || '';
        document.getElementById('smtpEnabled').checked = smtpSettings.enabled || false;
    }

    updateSMTPStatus(smtpSettings) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');

        if (smtpSettings && smtpSettings.enabled && smtpSettings.user && smtpSettings.password) {
            statusDot.classList.add('active');
            statusText.textContent = `SMTP настроен (${smtpSettings.user})`;
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'SMTP не настроен';
        }
    }

    async saveSMTPSettings() {
        try {
            const formData = new FormData(document.getElementById('smtpForm'));
            const smtpData = {
                host: formData.get('host'),
                port: parseInt(formData.get('port')),
                secure: formData.has('secure'),
                user: formData.get('user'),
                password: formData.get('password'),
                enabled: formData.has('enabled')
            };

            // Валидация
            if (!smtpData.host || !smtpData.port || !smtpData.user) {
                this.showNotification('Заполните обязательные поля', 'error');
                return;
            }

            if (!smtpData.password || smtpData.password === '••••••••') {
                this.showNotification('Введите App Password', 'error');
                return;
            }

            const response = await fetch(`${this.apiBase}/settings/smtp`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(smtpData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка сохранения');
            }

            this.showNotification('SMTP настройки сохранены успешно', 'success');

            // Обновляем статус
            this.updateSMTPStatus(smtpData);

        } catch (error) {
            console.error('Ошибка сохранения SMTP:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async testSMTP() {
        try {
            const testBtn = document.getElementById('testSmtpBtn');
            testBtn.disabled = true;
            testBtn.textContent = '📤 Отправка...';

            const response = await fetch(`${this.apiBase}/settings/smtp/test`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.error, 'error');
            }

        } catch (error) {
            console.error('Ошибка тестирования SMTP:', error);
            this.showNotification('Ошибка отправки тестового письма', 'error');
        } finally {
            const testBtn = document.getElementById('testSmtpBtn');
            testBtn.disabled = false;
            testBtn.textContent = '📧 Отправить тест';
        }
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
                } else if (href === '#seo') {
                    window.location.href = `/admin/${this.hash}/seo`;
                } else if (href === '#orders') {
                    window.location.href = `/admin/${this.hash}/orders`;
                }
            });
        });

        // Форма SMTP настроек
        document.getElementById('smtpForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSMTPSettings();
        });

        // Тестирование SMTP
        document.getElementById('testSmtpBtn').addEventListener('click', () => {
            this.testSMTP();
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
        const button = document.getElementById('updateCatalogBtn');
        const statusText = document.getElementById('updateStatusText');
        const progressContainer = document.getElementById('updateProgress');
        const logsContainer = document.getElementById('sync-logs') || this.createLogsContainer();

        try {
            // Блокируем кнопку
            button.disabled = true;
            button.textContent = '⏳ Синхронизация запущена...';

            // Показываем статус и очищаем логи
            progressContainer.style.display = 'block';
            statusText.textContent = 'Запуск синхронизации товаров...';
            logsContainer.innerHTML = '';

            // Сбрасываем прогресс
            let progressValue = 0;
            this.updateProgress(progressValue, 'Подготовка к синхронизации...');

            // Запускаем синхронизацию
            const response = await fetch(`${this.apiBase}/sync-products`, {
                method: 'POST',
                headers: {
                    'Accept': 'text/plain'
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка запуска синхронизации');
            }

            // Читаем поток данных
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            this.handleSyncUpdate(data, logsContainer);

                            // Обновляем прогресс на основе логов
                            if (data.type === 'log') {
                                progressValue = this.updateProgressFromLog(data.message, progressValue);
                            }
                        } catch (e) {
                            console.error('Ошибка парсинга лога:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            this.addLogEntry(logsContainer, 'error', `Ошибка: ${error.message}`);
            this.updateProgress(0, 'Ошибка синхронизации');
            this.showNotification('Ошибка запуска синхронизации', 'error');
        } finally {
            // Разблокируем кнопку
            button.disabled = false;
            button.textContent = '🚀 Запустить синхронизацию товаров';
        }
    }

    createLogsContainer() {
        const container = document.createElement('div');
        container.id = 'sync-logs';
        container.style.cssText = `
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-top: 16px;
        max-height: 400px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
    `;

        document.getElementById('updateProgress').appendChild(container);
        return container;
    }

    handleSyncUpdate(data, logsContainer) {
        const { type, message, code } = data;

        switch (type) {
            case 'log':
                this.addLogEntry(logsContainer, 'info', message);
                break;
            case 'error':
                this.addLogEntry(logsContainer, 'error', message);
                break;
            case 'complete':
                const status = code === 0 ? 'success' : 'error';
                this.addLogEntry(logsContainer, status, message);
                this.updateProgress(100, message);
                this.showNotification(message, status);
                this.addClearButton(document.getElementById('updateProgress'));
                break;
        }

        // ДОБАВИТЬ: Сохраняем состояние
        this.saveSyncState({
            progress: this.currentProgress || 0,
            statusText: document.getElementById('updateStatusText').textContent,
            logs: logsContainer.innerHTML,
            isRunning: type !== 'complete'
        });
    }
    addLogEntry(container, type, message) {
        const entry = document.createElement('div');
        entry.style.cssText = `
        padding: 4px 0;
        border-bottom: 1px solid #f1f5f9;
        color: ${type === 'error' ? '#e53e3e' : type === 'success' ? '#38a169' : '#4a5568'};
    `;

        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message.trim()}`;

        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    updateProgressFromLog(message, currentProgress) {
        // Анализируем сообщения и обновляем прогресс
        if (message.includes('Загружено') && message.includes('товаров из всех категорий')) {
            return 10;
        } else if (message.includes('Синхронизация') && message.includes('/14:')) {
            const match = message.match(/(\d+)\/14/);
            if (match) {
                const category = parseInt(match[1]);
                return 10 + (category / 14) * 80; // 10% начальная загрузка + 80% на категории
            }
        } else if (message.includes('Результат синхронизации')) {
            return 95;
        } else if (message.includes('завершена')) {
            return 100;
        }

        return Math.min(currentProgress + 0.5, 90); // Медленное увеличение
    }

    updateProgress(value, text) {
        const progressBar = document.querySelector('.progress-fill');
        const statusText = document.getElementById('updateStatusText');

        if (progressBar) {
            progressBar.style.width = `${value}%`;
        }

        if (statusText && text) {
            statusText.textContent = text;
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