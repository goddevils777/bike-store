class OrdersManager {
    constructor() {
        this.hash = window.location.pathname.split('/')[2];
        this.apiBase = `/admin/${this.hash}/api`;
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {};
        this.orders = [];

        this.init();
    }

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

            // Загружаем заказы
            await this.loadOrders();

            this.setupEventListeners();

            console.log('✅ Страница заказов инициализирована');
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

    async loadOrders(page = 1) {
        try {
            this.showLoading();

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...this.filters
            });

            const response = await fetch(`${this.apiBase}/orders?${params}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки заказов');
            }

            const data = await response.json();
            this.orders = data.orders;
            this.currentPage = data.pagination.page;
            this.totalPages = data.pagination.totalPages;

            this.renderOrders();
            this.renderPagination();
            this.updateOrdersCount(data.pagination.total);

        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            this.showError('Ошибка загрузки заказов');
        }
    }

    renderOrders() {
        const tbody = document.getElementById('ordersTableBody');

        if (!this.orders || this.orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-row">
                        Заказов не найдено
                    </td>
                </tr>
            `;
            return;
        }

        const ordersHTML = this.orders.map(order => {
            const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusClass = `status-${order.status}`;
            const statusText = this.getStatusText(order.status);

            // В МЕТОДЕ renderOrders НАЙТИ И ЗАМЕНИТЬ:
            return `
                <tr>
                    <td data-label="ID">
                        <span class="order-id">#${order.id}</span>
                    </td>
                    <td data-label="Дата">${date}</td>
                    <td data-label="Товар" class="order-product">
                        <div class="product-title">${this.escapeHtml(order.product_title)}</div>
                        <div class="product-price">${this.escapeHtml(order.product_price)}</div>
                    </td>
                    <td data-label="Клиент" class="customer-info">
                        <div class="customer-name">${this.escapeHtml(order.customer_name)}</div>
                        <div class="customer-email">${this.escapeHtml(order.customer_email)}</div>
                    </td>
                    <td data-label="Сумма">
                        <strong>${this.escapeHtml(order.product_price)}</strong>
                    </td>
                    <td data-label="Статус">
                        <select class="status-badge ${statusClass}" 
                                onchange="ordersManager.updateOrderStatus(${order.id}, this.value)"
                                data-original="${order.status}">
                            <option value="new" ${order.status === 'new' ? 'selected' : ''}>Новый</option>
                            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>В обработке</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Выполнен</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменен</option>
                        </select>
                    </td>
                    <td data-label="Действия">
                        <div class="action-buttons">
                            <button class="btn-view" onclick="ordersManager.viewOrder(${order.id})">
                                👁️ Просмотр
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = ordersHTML;
    }

    renderPagination() {
        const container = document.getElementById('pagination');

        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let buttons = [];

        // Кнопка "Назад"
        if (this.currentPage > 1) {
            buttons.push(`<button onclick="ordersManager.goToPage(${this.currentPage - 1})">← Назад</button>`);
        }

        // Номера страниц
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            buttons.push(`<button class="${activeClass}" onclick="ordersManager.goToPage(${i})">${i}</button>`);
        }

        // Кнопка "Вперед"
        if (this.currentPage < this.totalPages) {
            buttons.push(`<button onclick="ordersManager.goToPage(${this.currentPage + 1})">Вперед →</button>`);
        }

        container.innerHTML = buttons.join('');
    }

    // ЗАМЕНИТЬ МЕТОД updateOrderStatus НА:
    async updateOrderStatus(orderId, newStatus) {
        const selectElement = document.querySelector(`select[onchange*="${orderId}"]`);
        const originalStatus = selectElement.getAttribute('data-original');

        try {
            const response = await fetch(`${this.apiBase}/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Ошибка обновления статуса');
            }

            // Обновляем локальные данные
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                order.status = newStatus;
            }

            // МГНОВЕННО обновляем UI - меняем класс и сохраняем новый статус
            selectElement.setAttribute('data-original', newStatus);

            // Убираем все старые классы статусов
            selectElement.classList.remove('status-new', 'status-processing', 'status-completed', 'status-cancelled');

            // Добавляем новый класс
            selectElement.classList.add(`status-${newStatus}`);

            // Показываем уведомление
            this.showNotification(`Статус заказа #${orderId} изменен на "${this.getStatusText(newStatus)}"`, 'success');

        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            this.showNotification('Ошибка обновления статуса', 'error');

            // Возвращаем старое значение при ошибке
            selectElement.value = originalStatus;
        }
    }

    async viewOrder(orderId) {
        try {
            const response = await fetch(`${this.apiBase}/orders/${orderId}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки заказа');
            }

            const order = await response.json();
            this.showOrderModal(order);

        } catch (error) {
            console.error('Ошибка загрузки заказа:', error);
            this.showNotification('Ошибка загрузки заказа', 'error');
        }
    }

    // ЗАМЕНИТЬ МЕТОД showOrderModal НА:
    // ЗАМЕНИТЬ МЕТОД showOrderModal НА:
    showOrderModal(order) {
        const date = new Date(order.created_at).toLocaleString('ru-RU');

        const content = `
        <div class="order-details">
            <div class="detail-row">
                <strong>Дата заказа:</strong> ${date}
            </div>
            <div class="detail-row">
                <strong>Статус:</strong> ${this.getStatusText(order.status)}
            </div>
            
            <h4 style="margin: 20px 0 10px 0;">Товар</h4>
            
            <!-- Фото товара -->
            <div class="product-image-section">
                <img src="${this.getProductImageUrl(order.product_id)}" 
                     alt="${this.escapeHtml(order.product_title)}"
                     class="order-product-image-large"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="image-placeholder-large" style="display: none;">
                    <span>📦</span>
                    <small>Фото недоступно</small>
                </div>
            </div>
            
            <div class="detail-row">
                <strong>Название:</strong> ${this.escapeHtml(order.product_title)}
            </div>
            <div class="detail-row">
                <strong>Цена:</strong> ${this.escapeHtml(order.product_price)}
            </div>
            <div class="detail-row">
                <strong>Ссылка:</strong> <a href="${this.escapeHtml(order.product_url)}" target="_blank" class="product-link">Открыть товар →</a>
            </div>
            
            <h4 style="margin: 20px 0 10px 0;">Данные клиента</h4>
            <div class="detail-row">
                <strong>Имя:</strong> ${this.escapeHtml(order.customer_name)}
            </div>
            <div class="detail-row">
                <strong>Email:</strong> <a href="mailto:${this.escapeHtml(order.customer_email)}" class="email-link">${this.escapeHtml(order.customer_email)}</a>
            </div>
            <div class="detail-row">
                <strong>Телефон:</strong> ${this.escapeHtml(order.customer_phone || 'не указан')}
            </div>
            <div class="detail-row">
                <strong>Адрес доставки:</strong> ${this.escapeHtml(order.customer_address || 'не указан')}
            </div>
            ${order.customer_comment ? `
                <div class="detail-row">
                    <strong>Комментарий:</strong> ${this.escapeHtml(order.customer_comment)}
                </div>
            ` : ''}
        </div>
    `;

        // Используем компонент модального окна
        window.adminModal.show(`Заказ #${order.id}`, content);
    }

    // ЗАМЕНИТЬ МЕТОД getProductImageUrl НА:
    getProductImageUrl(productId) {
        console.log(`🖼️ Подготовка изображения для товара ${productId}`);

        // Запускаем загрузку в фоне (без await)
        this.loadProductImage(productId);

        // Сразу возвращаем красивый placeholder
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDI4MCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGQUZDIiByeD0iMTIiLz4KPHN2ZyB4PSI2NCIgeT0iNDAiIHdpZHRoPSIxNTIiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNDQkQ1RTAiPgo8cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6bS02LTljMCAxIDEuMjQgMiAzIDJzMy0xIDMtMi0xLjI0LTItMy0yLTMgMS0zIDJ6bTEyIDBjMCAxIDEuMjQgMiAzIDJzMy0xIDMtMi0xLjI0LTItMy0yLTMgMS0zIDJ6bS02IDZjMi4yMSAwIDQtMS43OSA0LTRIOGMwIDIuMjEgMS43OSA0IDQgNHoiLz4KPC9zdmc+Cjx0ZXh0IHg9IjE0MCIgeT0iMTc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNzE4MDk2IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSI1MDAiPtCk0L7RgtC+INCT0YDRg9C30LjRgtGB0Y88L3RleHQ+Cjwvc3ZnPgo=';
    }

    // ДОБАВИТЬ НОВЫЙ МЕТОД loadProductImage:
    async loadProductImage(productId) {
        try {
            console.log(`🔍 Запрос изображения для товара ${productId}`);

            const response = await fetch(`/api/products/${productId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const productData = await response.json();
            let imageUrl = productData.imageUrl;

            // Если нет imageUrl, пробуем images массив
            if (!imageUrl && productData.images && productData.images.length > 0) {
                imageUrl = productData.images[0];
            }

            if (imageUrl) {
                console.log(`✅ Найдено изображение: ${imageUrl.substring(0, 50)}...`);

                // Ждем немного чтобы модальное окно успело отрендериться
                setTimeout(() => {
                    const img = document.querySelector('.order-product-image-large');
                    if (img) {
                        // Проверяем что изображение еще placeholder
                        if (img.src.includes('data:image/svg+xml')) {
                            console.log(`🔄 Обновляем изображение в модальном окне`);
                            img.src = imageUrl;

                            // Добавляем обработчик ошибки загрузки
                            img.onerror = () => {
                                console.log(`❌ Ошибка загрузки изображения: ${imageUrl}`);
                                img.style.display = 'none';
                                const placeholder = img.nextElementSibling;
                                if (placeholder) {
                                    placeholder.style.display = 'flex';
                                }
                            };
                        }
                    }
                }, 200);
            } else {
                console.log(`⚠️ Изображение не найдено для товара ${productId}`);
            }

        } catch (error) {
            console.error(`❌ Ошибка загрузки изображения для товара ${productId}:`, error);

            // Показываем placeholder при ошибке
            setTimeout(() => {
                const img = document.querySelector('.order-product-image-large');
                if (img) {
                    img.style.display = 'none';
                    const placeholder = img.nextElementSibling;
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                }
            }, 200);
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
                } else if (href === '#settings') {
                    window.location.href = `/admin/${this.hash}/settings`;
                }
            });
        });

        // Фильтры
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Обновление
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadOrders(this.currentPage);
        });

        // Экспорт
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportOrders();
        });

        // Модальное окно
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalCancel').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('orderModal').addEventListener('click', (e) => {
            if (e.target.id === 'orderModal') {
                this.closeModal();
            }
        });
    }

    applyFilters() {
        this.filters = {};

        const status = document.getElementById('statusFilter').value;
        if (status) this.filters.status = status;

        const dateFrom = document.getElementById('dateFrom').value;
        if (dateFrom) this.filters.dateFrom = dateFrom;

        const dateTo = document.getElementById('dateTo').value;
        if (dateTo) this.filters.dateTo = dateTo;

        this.loadOrders(1);
    }

    clearFilters() {
        this.filters = {};
        document.getElementById('statusFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        this.loadOrders(1);
    }

    async exportOrders() {
        try {
            const params = new URLSearchParams(this.filters);
            window.open(`${this.apiBase}/orders/export?${params}`, '_blank');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    goToPage(page) {
        this.loadOrders(page);
    }

    closeModal() {
        document.getElementById('orderModal').style.display = 'none';
    }

    getStatusText(status) {
        const statusMap = {
            'new': 'Новый',
            'processing': 'В обработке',
            'completed': 'Выполнен',
            'cancelled': 'Отменен'
        };
        return statusMap[status] || status;
    }

    showLoading() {
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <div class="loading-spinner"></div>
                    Загрузка заказов...
                </td>
            </tr>
        `;
    }

    showError(message) {
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    ❌ ${message}
                </td>
            </tr>
        `;
    }

    updateOrdersCount(total) {
        document.getElementById('ordersCount').textContent = `Всего: ${total} заказов`;
    }

    // НАЙТИ И ЗАМЕНИТЬ МЕТОД showNotification НА:
    showNotification(message, type = 'info') {
        // Создаем уведомление если его нет
        let notification = document.getElementById('orderNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'orderNotification';
            notification.className = 'notification';
            notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon"></span>
                <span class="notification-text"></span>
                <button class="notification-close">&times;</button>
            </div>
        `;
            document.body.appendChild(notification);

            // Обработчик закрытия
            notification.querySelector('.notification-close').addEventListener('click', () => {
                this.hideNotification();
            });
        }

        const text = notification.querySelector('.notification-text');

        // Убираем старые классы типов
        notification.classList.remove('success', 'error', 'info', 'show');

        // Добавляем новый тип
        notification.classList.add(type);

        text.textContent = message;
        notification.classList.add('show');

        // Автоскрытие через 4 секунды
        setTimeout(() => {
            this.hideNotification();
        }, 4000);
    }

    hideNotification() {
        const notification = document.getElementById('orderNotification');
        if (notification) {
            notification.classList.remove('show');
        }
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

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Инициализация
let ordersManager;
document.addEventListener('DOMContentLoaded', () => {
    ordersManager = new OrdersManager();
});