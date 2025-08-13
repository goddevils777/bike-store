class ProductPage {
    constructor() {
        this.productId = this.getProductIdFromUrl();
        this.product = null;
        this.currentImageIndex = 0;
        this.autoSlideInterval = null; // ДОБАВИТЬ ЭТО
        this.userInteracted = false;   // ДОБАВИТЬ ЭТО
        this.init();
    }

    getProductIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async init() {
        if (!this.productId) {
            this.showError('Товар не найден');
            return;
        }

        await this.loadMarkup(); // ДОБАВИТЬ ЭТУ СТРОКУ
        await this.loadProduct();
        this.setupEventListeners();

        // Делаем функции доступными глобально для header
        window.handleCategoryClick = (category) => {
            window.location.href = `/?category=${category}`;
        };

        window.handleSearchClick = () => {
            const searchInput = document.getElementById('searchInput');
            const searchValue = searchInput.value.trim();
            window.location.href = `/?search=${encodeURIComponent(searchValue)}`;
        };

        window.handleHomeClick = (event) => {
            window.location.href = '/';
            return false;
        };
    }

    async loadMarkup() {
        try {
            const response = await fetch('/api/markup');
            if (response.ok) {
                const data = await response.json();
                this.currentMarkup = parseFloat(data.markup) || 0;
                console.log(`💰 ОТЛАДКА товара: Загружена наценка: ${this.currentMarkup}%`);
            }
        } catch (error) {
            console.log('Не удалось загрузить наценку для товара');
            this.currentMarkup = 0;
        }
    }

    recalculateProductPrices() {
        if (!this.product) return;

        console.log(`🔧 ОТЛАДКА товара: Пересчет с наценкой ${this.currentMarkup}%`);

        // Используем базовые цены если есть
        let originalBasePrice = this.product.originalBasePriceEur;
        let currentBasePrice = this.product.currentBasePriceEur;

        // Если базовых цен нет, извлекаем из строк
        if (!originalBasePrice && this.product.originalPriceEur) {
            originalBasePrice = this.extractPrice(this.product.originalPriceEur);
        }
        if (!currentBasePrice && this.product.currentPriceEur) {
            currentBasePrice = this.extractPrice(this.product.currentPriceEur);
        }

        console.log(`💰 ОТЛАДКА товара: Базовые цены:`, {
            originalBasePrice,
            currentBasePrice,
            markup: this.currentMarkup
        });

        if (currentBasePrice) {
            // ПРОВЕРЯЕМ: если наценка 0% - используем оригинальные цены
            if (this.currentMarkup === 0) {
                this.product.priceRub = `${currentBasePrice} €`;
                if (originalBasePrice) {
                    this.product.originalPriceRub = `${originalBasePrice} €`;
                }
                console.log(`✅ ОТЛАДКА товара: наценка 0%, цена:`, this.product.priceRub);
            } else {
                // Применяем наценку только если она больше 0
                const newCurrentPrice = Math.round(currentBasePrice * (1 + this.currentMarkup / 100));
                this.product.priceRub = `${newCurrentPrice} €`;

                if (originalBasePrice) {
                    const newOriginalPrice = Math.round(originalBasePrice * (1 + this.currentMarkup / 100));
                    this.product.originalPriceRub = `${newOriginalPrice} €`;
                }
                console.log(`💸 ОТЛАДКА товара: наценка ${this.currentMarkup}%, новая цена:`, this.product.priceRub);
            }

            // Пересчитываем скидку между БАЗОВЫМИ ценами
            if (originalBasePrice && originalBasePrice > currentBasePrice) {
                this.product.discountPercent = Math.round((1 - currentBasePrice / originalBasePrice) * 100);
            } else {
                this.product.discountPercent = 0;
            }
        }
    }

    async loadProduct() {
        try {
            const response = await fetch(`/api/products/${this.productId}`);

            if (!response.ok) {
                throw new Error('Товар не найден');
            }

            this.product = await response.json();
            this.recalculateProductPrices(); // ДОБАВИТЬ ЭТУ СТРОКУ
            this.renderProduct();
            this.hideLoading();

        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
            this.showError('Не удалось загрузить товар');
        }
    }



    renderProduct() {
        const container = document.getElementById('productDetail');
        const breadcrumb = document.getElementById('breadcrumbTitle');

        breadcrumb.textContent = this.product.title;
        document.title = `${this.product.title} - ReBike Store`;

        const images = this.product.images && this.product.images.length > 0
            ? this.product.images
            : [this.product.imageUrl].filter(Boolean);

        const savings = this.calculateSavings(this.product.originalPriceRub, this.product.priceRub);

        container.innerHTML = `
        <div class="product-main">
            <div class="product-gallery">
                <img src="${this.sanitizeImageUrl(images[0])}" 
                     alt="${this.escapeHtml(this.product.title)}" 
                     class="main-image" 
                     id="mainImage">
                
                ${images.length > 1 ? `
                    <div class="image-carousel">
                        ${images.map((img, index) => `
                            <img src="${this.sanitizeImageUrl(img)}" 
                                 alt="Фото ${index + 1}" 
                                 class="thumbnail ${index === 0 ? 'active' : ''}"
                                 data-index="${index}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="product-info">
                <a href="/" class="back-link">← Назад к каталогу</a>
                
                <h1 class="product-title">${this.escapeHtml(this.product.title)}</h1>
                
                <div class="price-section">
                    <span class="current-price">${this.escapeHtml(this.product.priceRub)}</span>
                    ${this.product.originalPriceRub ? `
                        <div>
                            <span class="original-price">${this.escapeHtml(this.product.originalPriceRub)}</span>
                        </div>
                        <div class="savings-info">
                            ${this.product.discountPercent > 0 ? `<span class="discount-badge">-${this.product.discountPercent}%</span>` : ''}
                            ${savings ? `<span class="savings-amount">Экономия: ${savings}</span>` : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="order-section">
                    <button class="btn-order-large" onclick="productPage.openOrderModal()">
                        Заказать велосипед
                    </button>
                </div>
            </div>
        </div>

        <div class="product-bottom">
            ${this.product.description ? `
                <div class="description-section">
                    <h3>Описание</h3>
                    <p class="description-text">${this.escapeHtml(this.product.description)}</p>
                </div>
            ` : ''}

            ${this.product.specifications && Object.keys(this.product.specifications).length > 0 ? `
                <div class="specifications">
                    <h3>Характеристики</h3>
                    <div class="spec-list">
                        ${Object.entries(this.product.specifications).map(([key, value]) => `
                            <div class="spec-item">
                                <span class="spec-key">${this.escapeHtml(key)}</span>
                                <span class="spec-value">${this.escapeHtml(value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

        setTimeout(() => {
            this.startAutoSlide();
        }, 1500);
    }

    changeImage(index) {
        const images = this.product.images && this.product.images.length > 0
            ? this.product.images
            : [this.product.imageUrl].filter(Boolean);

        this.currentImageIndex = index;

        document.getElementById('mainImage').src = this.sanitizeImageUrl(images[index]);

        document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }

    calculateSavings(originalPriceStr, currentPriceStr) {
        const originalPrice = this.extractPrice(originalPriceStr);
        const currentPrice = this.extractPrice(currentPriceStr);

        if (!originalPrice || !currentPrice || originalPrice <= currentPrice) {
            return null;
        }

        const savings = originalPrice - currentPrice;
        return `${savings} €`;
    }

    extractPrice(priceStr) {
        if (!priceStr) return null;
        const match = priceStr.match(/(\d+[\d\s,\.]*)/);
        return match ? parseFloat(match[1].replace(/[\s,]/g, '')) : null;
    }

    openOrderModal() {
        const modalProductInfo = document.getElementById('modalProductInfo');
        modalProductInfo.innerHTML = `
        <div style="display: flex; gap: 20px; margin-bottom: 24px; align-items: center; padding: 16px; background: #f7fafc; border-radius: 12px;">
            <img src="${this.sanitizeImageUrl(this.product.imageUrl)}" 
                 alt="${this.escapeHtml(this.product.title)}" 
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" />
            <div>
                <h4 style="margin-bottom: 8px; color: #2d3748;">${this.escapeHtml(this.product.title)}</h4>
                <p style="color: #38a169; font-size: 1.3rem; font-weight: 700;">
                    ${this.escapeHtml(this.product.priceRub)}
                </p>
                ${this.product.originalPriceRub ? `<p style="color: #a0aec0; font-size: 0.9rem;">Цена в оригинале: ${this.escapeHtml(this.product.originalPriceRub)}</p>` : ''}
            </div>
        </div>
    `;

        this.clearOrderForm();
        document.getElementById('orderModal').style.display = 'block';
    }

    setupEventListeners() {
        // Карусель изображений - клик по миниатюрам
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                this.stopAutoSlide();
                const index = parseInt(e.target.getAttribute('data-index'));
                this.changeImage(index);
            });
        });

        // Навигация по основному изображению
        const mainImage = document.getElementById('mainImage');
        if (mainImage) {
            mainImage.addEventListener('click', (e) => {
                this.stopAutoSlide();
                const rect = mainImage.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const imageWidth = rect.width;
                const images = this.product.images && this.product.images.length > 0
                    ? this.product.images
                    : [this.product.imageUrl].filter(Boolean);

                if (clickX > imageWidth / 2) {
                    const nextIndex = (this.currentImageIndex + 1) % images.length;
                    this.changeImage(nextIndex);
                } else {
                    const prevIndex = this.currentImageIndex === 0 ? images.length - 1 : this.currentImageIndex - 1;
                    this.changeImage(prevIndex);
                }
            });
        }

        // ДОБАВИТЬ: Обработчик кнопки заказа
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-order-large')) {
                this.openOrderModal();
            }
        });

        // Отправка формы заказа
        const orderForm = document.getElementById('orderForm');
        orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitOrder();
        });

        // Закрытие модального окна
        const modal = document.getElementById('orderModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    async submitOrder() {
        const customerData = {
            name: document.getElementById('customerName').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            address: document.getElementById('customerAddress').value.trim(), // ДОБАВИТЬ ЭТО
            comment: document.getElementById('customerComment').value.trim()
        };

        if (!customerData.name || !customerData.email) {
            alert('Пожалуйста, заполните обязательные поля');
            return;
        }

        try {
            const response = await fetch('/api/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: this.productId,
                    customerData: customerData
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                this.closeModal();
            } else {
                alert(result.error || 'Ошибка при отправке заказа');
            }

        } catch (error) {
            alert('Не удалось отправить заказ. Попробуйте позже.');
        }
    }

    clearOrderForm() {
        document.getElementById('customerName').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerAddress').value = ''; // ДОБАВИТЬ ЭТО
        document.getElementById('customerComment').value = '';
    }

    closeModal() {
        document.getElementById('orderModal').style.display = 'none';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('productDetail').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('productDetail').style.display = 'block';
    }

    showError(message) {
        const loading = document.getElementById('loading');
        loading.textContent = message;
        loading.style.color = '#e53e3e';
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

    sanitizeImageUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                return url;
            }
        } catch (e) {
            console.warn('Небезопасный URL изображения:', url);
        }
        return '';
    }

    startAutoSlide() {
        if (this.userInteracted) return;

        const images = this.product?.images && this.product.images.length > 0
            ? this.product.images
            : [this.product?.imageUrl].filter(Boolean);

        if (images.length <= 1) return;

        this.autoSlideInterval = setInterval(() => {
            if (!this.userInteracted) {
                const nextIndex = (this.currentImageIndex + 1) % images.length;
                this.changeImage(nextIndex);
            }
        }, 1000);
    }

    stopAutoSlide() {
        if (this.autoSlideInterval) {
            clearInterval(this.autoSlideInterval);
            this.autoSlideInterval = null;
        }
        this.userInteracted = true;
    }
}

// Глобальные функции
function closeModal() {
    productPage.closeModal();
}

// Инициализация
const productPage = new ProductPage();