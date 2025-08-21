class AdminDashboard {
    constructor() {
        this.hash = window.location.pathname.split('/')[2];
        this.apiBase = `/admin/${this.hash}/api`;

        this.init();
    }

    async init() {
        try {
            // Проверяем авторизацию
            await this.checkAuth();

            // Загружаем данные
            await this.loadStats();
            await this.loadRecentOrders();

            this.setupEventListeners();

            console.log('✅ Дашборд инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации дашборда:', error);
            this.redirectToLogin();
        }
    }

    async checkAuth() {
        try {
            const response = await fetch(`/admin/${this.hash}/check-auth`);
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('Сессия истекла, перенаправляем на вход');
                    this.redirectToLogin();
                    return;
                }
                throw new Error('Не авторизован');
            }
            return await response.json();
        } catch (error) {
            console.log('Ошибка авторизации, перенаправляем на вход');
            this.redirectToLogin();
            throw error;
        }
    }

    handleApiError(error, response) {
        if (response && response.status === 401) {
            console.log('Сессия истекла во время запроса');
            this.redirectToLogin();
            return true; // Обработано
        }
        return false; // Не обработано
    }

    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/orders/stats/summary`);

            if (!response.ok) {
                if (this.handleApiError(null, response)) return;
                throw new Error('Ошибка загрузки статистики');
            }

            const stats = await response.json();
            this.updateStatsUI(stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            this.showStatsError();
        }
    }


    updateStatsUI(stats) {
        document.getElementById('totalOrders').textContent = stats.total || 0;
        document.getElementById('todayOrders').textContent = stats.today || 0;
        document.getElementById('weekOrders').textContent = stats.week || 0;

        // Подсчитываем заказы в обработке
        const processingCount = stats.byStatus
            ? stats.byStatus.find(s => s.status === 'processing')?.count || 0
            : 0;
        document.getElementById('processingOrders').textContent = processingCount;
    }

    showStatsError() {
        document.getElementById('totalOrders').textContent = 'Ошибка';
        document.getElementById('todayOrders').textContent = 'Ошибка';
        document.getElementById('weekOrders').textContent = 'Ошибка';
        document.getElementById('processingOrders').textContent = 'Ошибка';
    }


    async loadRecentOrders() {
        try {
            const response = await fetch(`${this.apiBase}/orders?limit=5`);

            if (!response.ok) {
                if (this.handleApiError(null, response)) return;
                throw new Error('Ошибка загрузки заказов');
            }

            const data = await response.json();
            this.updateOrdersUI(data.orders);
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            this.showOrdersError();
        }
    }

    updateOrdersUI(orders) {
        const container = document.getElementById('recentOrdersTable');

        if (!orders || orders.length === 0) {
            container.innerHTML = '<div class="loading">Заказов пока нет</div>';
            return;
        }

        const ordersHTML = orders.map(order => {
            const date = new Date(order.created_at).toLocaleDateString('ru-RU');
            const statusClass = `status-${order.status}`;
            const statusText = this.getStatusText(order.status);

            return `
                <div class="order-row">
                    <div class="order-info">
                        <div class="order-details">
                            <h4>#${order.id}</h4>
                            <p>${date}</p>
                        </div>
                    </div>
                    <div class="order-details">
                        <h4>${this.escapeHtml(order.product_title)}</h4>
                        <p>${this.escapeHtml(order.customer_name)} • ${this.escapeHtml(order.customer_email)}</p>
                    </div>
                    <div>
                        <strong>${this.escapeHtml(order.product_price)}</strong>
                    </div>
                    <div>
                        <span class="order-status ${statusClass}">${statusText}</span>
                    </div>
                    <div>
                        <button class="btn-view" onclick="dashboard.viewOrder(${order.id})">
                            👁️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = ordersHTML;
    }

    showOrdersError() {
        const container = document.getElementById('recentOrdersTable');
        container.innerHTML = '<div class="loading">Ошибка загрузки заказов</div>';
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

    setupEventListeners() {
        // Навигация по меню
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');

                if (href === '#logout') {
                    this.logout();
                } else if (href === '#orders') {
                    this.navigateToOrders();
                } else if (href === '#settings') {
                    this.navigateToSettings();
                } else if (href === '#seo') {
                    window.location.href = `/admin/${this.hash}/seo`;
                } else if (href === '#dashboard') {
                    // Обновляем дашборд
                    this.loadStats();
                    this.loadRecentOrders();
                }

            });
        });

        // Автообновление каждые 30 секунд
        setInterval(() => {
            this.loadStats();
            this.loadRecentOrders();
        }, 30000);
    }

    async logout() {
        try {
            const response = await fetch(`/admin/${this.hash}/logout`, {
                method: 'POST'
            });

            if (response.ok) {
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Ошибка выхода:', error);
            this.redirectToLogin();
        }
    }

    navigateToOrders() {
        window.location.href = `/admin/${this.hash}/orders`;
    }

    navigateToSettings() {
        window.location.href = `/admin/${this.hash}/settings`;
    }

    // ЗАМЕНИТЬ МЕТОД viewOrder НА:
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
            alert('Ошибка загрузки заказа');
        }
    }

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
                <strong>Адрес:</strong> ${this.escapeHtml(order.customer_address || 'не указан')}
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

// Инициализация дашборда
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AdminDashboard();
});