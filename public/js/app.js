class ShopApp {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentSearch = '';
        this.selectedProduct = null;
        this.allProducts = [];
        this.filteredProducts = [];
        this.currentSort = 'price-asc'; // ИЗМЕНЯЕМ: по умолчанию самая низкая цена
        this.activeCategory = 'all';
        this.init();
    }

async init() {
    await this.loadAllProducts();
    this.setupEventListeners();
    this.setDefaultActiveCategory(); // Добавляем это
    this.applyFilters();
}

setDefaultActiveCategory() {
    // Убираем active у всех категорий
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Устанавливаем active для "Alle E-Bikes"
    const alleEBikesCategory = document.querySelector('[data-category="all"]');
    if (alleEBikesCategory) {
        alleEBikesCategory.classList.add('active');
    }
    
    this.activeCategory = 'all';
}

setupEventListeners() {
    // Поиск по Enter
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.searchProducts();
        }
    });

    // Фильтры
    const filterInputs = document.querySelectorAll('.filter-item input, .price-input');
    filterInputs.forEach(input => {
        input.addEventListener('change', () => this.applyFilters());
        if (input.type === 'number') {
            input.addEventListener('input', () => this.debounceFilter());
        }
    });

    // Категории - ДОБАВЛЯЕМ ЭТО
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.getAttribute('data-category');
            this.selectCategory(category);
        });
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

    debounceFilter() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => this.applyFilters(), 500);
    }

selectCategory(category) {
    // Обновляем активную категорию
    this.activeCategory = category;
    this.currentPage = 1;
    
    // Обновляем UI категорий
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Применяем фильтры
    this.applyFilters();
}
async loadAllProducts() {
    try {
        this.showLoading();
        
        const response = await fetch('/api/products?limit=1000');
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки товаров');
        }

        const data = await response.json();
        this.allProducts = data.products;
        
        // Диагностика дублей
        console.log('🔍 Диагностика дублей:');
        console.log(`Всего товаров загружено: ${this.allProducts.length}`);
        
        // Проверяем дубли по URL
        const urlCounts = {};
        this.allProducts.forEach(product => {
            urlCounts[product.url] = (urlCounts[product.url] || 0) + 1;
        });
        
        const duplicates = Object.entries(urlCounts).filter(([url, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`❌ Найдено ${duplicates.length} дублированных URL:`);
            duplicates.slice(0, 5).forEach(([url, count]) => {
                console.log(`  ${count}x: ${url}`);
            });
        } else {
            console.log('✅ Дублей по URL не найдено');
        }
        
        // Проверяем дубли по ID
        const idCounts = {};
        this.allProducts.forEach(product => {
            idCounts[product.id] = (idCounts[product.id] || 0) + 1;
        });
        
        const idDuplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
        if (idDuplicates.length > 0) {
            console.log(`❌ Найдено ${idDuplicates.length} дублированных ID:`);
            idDuplicates.slice(0, 5).forEach(([id, count]) => {
                console.log(`  ${count}x: ${id}`);
            });
        } else {
            console.log('✅ Дублей по ID не найдено');
        }
        
        this.hideLoading();

    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        this.showError('Не удалось загрузить товары. Попробуйте позже.');
    }
}

applyFilters() {
    let filtered = [...this.allProducts];

    // Сначала убираем дубли по ID из исходного массива
    const seenIds = new Set();
    filtered = filtered.filter(product => {
        if (seenIds.has(product.id)) {
            console.log(`🔄 Убираем дубль: ${product.title} (${product.id})`);
            return false;
        }
        seenIds.add(product.id);
        return true;
    });

    console.log(`После удаления дублей: ${filtered.length} товаров`);

    // Фильтр по категории
    if (this.activeCategory !== 'all') {
        filtered = filtered.filter(product => {
            if (!product.category) return false;
            
            const category = product.category;
            const title = product.title ? product.title.toLowerCase() : '';
            
            switch(this.activeCategory) {
                case 'sales':
                    return product.discountPercent > 0 || category === 'sales';
                case 'gebraucht':
                    return category === 'gebraucht' || title.includes('gebraucht') || title.includes('used');
                case 'trekking-city':
                    return category === 'trekking-city' || category === 'trekking' || category === 'city';
                case 'trekking':
                    return category === 'trekking' || title.includes('trekking') || title.includes('touren');
                case 'city':
                    return category === 'city' || title.includes('city');
                case 'urban':
                    return category === 'urban' || title.includes('urban');
                case 'mountain':
                    return category === 'mountain' || category === 'hardtail' || category === 'fully' || 
                        title.includes('mountain') || title.includes('mtb');
                case 'hardtail':
                    return category === 'hardtail' || title.includes('hardtail');
                case 'fully':
                    return category === 'fully' || title.includes('fully');
                case 'cargo':
                    return category === 'cargo' || title.includes('lastenrad') || title.includes('cargo');
                case 'speed':
                    return category === 'speed' || title.includes('s-pedelec') || title.includes('speed');
                case 'gravel':
                    return category === 'gravel' || title.includes('gravel') || title.includes('renn');
                case 'kids':
                    return category === 'kids' || title.includes('kinder') || title.includes('kids');
                case 'classic':
                    return category === 'classic' || (!title.includes('e-bike') && !title.includes('electric'));
                default:
                    return category === this.activeCategory;
            }
        });
    }

    // Поиск
    if (this.currentSearch) {
        filtered = filtered.filter(product =>
            product.title.toLowerCase().includes(this.currentSearch.toLowerCase())
        );
    }

    // Фильтр по цене
    const priceMin = document.getElementById('priceMin').value;
    const priceMax = document.getElementById('priceMax').value;
    
    if (priceMin || priceMax) {
        filtered = filtered.filter(product => {
            const price = this.extractPrice(product.priceRub);
            if (!price) return true;
            
            const min = priceMin ? parseFloat(priceMin) : 0;
            const max = priceMax ? parseFloat(priceMax) : Infinity;
            
            return price >= min && price <= max;
        });
    }

    // Остальные фильтры остаются прежними...
    const conditionFilters = this.getCheckedFilters(['conditionNew', 'conditionRefurb', 'conditionUsed']);
    if (conditionFilters.length > 0) {
        filtered = filtered.filter(product => {
            const title = product.title.toLowerCase();
            return conditionFilters.some(condition => {
                switch(condition) {
                    case 'new': return !title.includes('refurbished') && !title.includes('gebraucht');
                    case 'refurbished': return title.includes('refurbished') || title.includes('premium');
                    case 'used': return title.includes('gebraucht') || title.includes('used');
                    default: return false;
                }
            });
        });
    }

    // Фильтр по типу велосипеда
    const typeFilters = this.getCheckedFilters(['typeCity', 'typeMountain', 'typeElectric', 'typeRoad', 'typeFolding']);
    if (typeFilters.length > 0) {
        filtered = filtered.filter(product => {
            const title = product.title.toLowerCase();
            return typeFilters.some(type => {
                switch(type) {
                    case 'city': return title.includes('city') || title.includes('urban') || title.includes('comfort');
                    case 'mountain': return title.includes('mountain') || title.includes('mtb') || title.includes('trail');
                    case 'electric': return title.includes('e-bike') || title.includes('electric') || title.includes('ebike');
                    case 'road': return title.includes('road') || title.includes('race') || title.includes('racing');
                    case 'folding': return title.includes('folding') || title.includes('falt') || title.includes('klapp');
                    default: return false;
                }
            });
        });
    }

    // Фильтр по бренду
    const brandFilters = this.getCheckedFilters(['brandBrompton', 'brandCube', 'brandTrek', 'brandGiant']);
    if (brandFilters.length > 0) {
        filtered = filtered.filter(product => {
            const title = product.title.toLowerCase();
            return brandFilters.some(brand => title.includes(brand));
        });
    }

    this.filteredProducts = filtered;
    this.applySorting();
    this.renderProducts();
    this.updateProductsCount(filtered.length);
}

    getCheckedFilters(filterIds) {
        return filterIds
            .filter(id => document.getElementById(id).checked)
            .map(id => document.getElementById(id).value);
    }

    applySorting() {
        const sortValue = this.currentSort;
        
        switch(sortValue) {
            case 'price-asc':
                this.filteredProducts.sort((a, b) => {
                    const priceA = this.extractPrice(a.priceRub) || 0;
                    const priceB = this.extractPrice(b.priceRub) || 0;
                    return priceA - priceB;
                });
                break;
            case 'price-desc':
                this.filteredProducts.sort((a, b) => {
                    const priceA = this.extractPrice(a.priceRub) || 0;
                    const priceB = this.extractPrice(b.priceRub) || 0;
                    return priceB - priceA;
                });
                break;
            case 'name-asc':
                this.filteredProducts.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'name-desc':
                this.filteredProducts.sort((a, b) => b.title.localeCompare(a.title));
                break;
            default:
                // По умолчанию оставляем исходный порядок
                break;
        }
    }

 renderProducts() {
    const grid = document.getElementById('productsGrid');
    const productsPerPage = 12;
    const startIndex = (this.currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const pageProducts = this.filteredProducts.slice(startIndex, endIndex);
    
    this.totalPages = Math.ceil(this.filteredProducts.length / productsPerPage);
    
    if (pageProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #718096;">
                <h3 style="margin-bottom: 12px; color: #4a5568;">Товары не найдены</h3>
                <p>Попробуйте изменить фильтры или поисковый запрос</p>
            </div>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = pageProducts.map(product => {
        return `
            <div class="product-card" data-product-id="${product.id}">
                <img src="${this.sanitizeImageUrl(product.imageUrl)}" 
                    alt="${this.escapeHtml(product.title)}" 
                    class="product-image"
                    onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDI4MCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjdGQUZDIi8+Cjx0ZXh0IHg9IjE0MCIgeT0iMTA1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNzE4MDk2IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4='" />
                
                <div class="product-info">
                    <div class="product-content">
                        <h3 class="product-title">${this.escapeHtml(product.title)}</h3>
                        
                        <div class="product-prices">
                            <span class="current-price">${this.escapeHtml(product.priceRub || 'Цена не указана')}</span>
                            ${product.originalPriceRub && product.originalPriceRub !== product.priceRub ? `<span class="original-price">${this.escapeHtml(product.originalPriceRub)}</span>` : ''}
                        </div>

                        ${product.discountPercent > 0 ? `
                            <div class="discount-info">
                                <span class="discount-badge">-${product.discountPercent}%</span>
                                ${this.calculateSavings(product.originalPriceRub, product.priceRub) ? `<span class="savings-amount">-${this.calculateSavings(product.originalPriceRub, product.priceRub)}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    
                    <button class="btn-order" data-product-id="${product.id}">
                        Заказать
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Добавляем обработчики событий для карточек товаров
    document.querySelectorAll('.product-card').forEach(card => {
        const productId = card.getAttribute('data-product-id');
        
        // Клик по карточке - переход на страницу товара
        card.addEventListener('click', (e) => {
            // Проверяем что клик НЕ по кнопке заказа
            if (!e.target.classList.contains('btn-order')) {
                window.location.href = `product.html?id=${productId}`;
            }
        });
    });
    
    // Добавляем обработчики событий для кнопок заказа
    document.querySelectorAll('.btn-order').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = button.getAttribute('data-product-id');
            this.openOrderModal(productId);
        });
    });
    
    this.renderPagination();
}

   renderPagination() {
    const pagination = document.getElementById('pagination');
    
    if (this.totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let buttons = [];

    // Кнопка "Первая страница"
    if (this.currentPage > 1) {
        buttons.push(`<button type="button" data-page="1" title="Первая страница">1</button>`);
        
        if (this.currentPage > 3) {
            buttons.push(`<span style="padding: 10px 8px; color: #a0aec0;">...</span>`);
        }
    }

    // Кнопка "Назад"
    if (this.currentPage > 1) {
        buttons.push(`<button type="button" data-page="${this.currentPage - 1}">← Назад</button>`);
    }

    // Текущие страницы вокруг активной
    const startPage = Math.max(2, this.currentPage - 1);
    const endPage = Math.min(this.totalPages - 1, this.currentPage + 1);

    // Показываем страницы вокруг текущей (кроме первой и последней)
    for (let i = startPage; i <= endPage; i++) {
        // Пропускаем первую страницу если она уже добавлена
        if (i === 1 && this.currentPage > 1) continue;
        // Пропускаем последнюю страницу - она будет добавлена отдельно
        if (i === this.totalPages && this.totalPages > 1) continue;
        
        const activeClass = i === this.currentPage ? 'active' : '';
        buttons.push(`<button type="button" class="${activeClass}" data-page="${i}">${i}</button>`);
    }

    // Если текущая страница - первая, показываем её как активную
    if (this.currentPage === 1) {
        buttons.unshift(`<button type="button" class="active" data-page="1">1</button>`);
    }

    // Кнопка "Вперед"
    if (this.currentPage < this.totalPages) {
        buttons.push(`<button type="button" data-page="${this.currentPage + 1}">Вперед →</button>`);
    }

    // Кнопка "Последняя страница"
    if (this.currentPage < this.totalPages) {
        if (this.currentPage < this.totalPages - 2) {
            buttons.push(`<span style="padding: 10px 8px; color: #a0aec0;">...</span>`);
        }
        
        const lastPageClass = this.currentPage === this.totalPages ? 'active' : '';
        buttons.push(`<button type="button" class="${lastPageClass}" data-page="${this.totalPages}" title="Последняя страница">${this.totalPages}</button>`);
    }

    // Если текущая страница - последняя, показываем её как активную
    if (this.currentPage === this.totalPages && this.totalPages > 1) {
        buttons.pop(); // Удаляем дублирующую последнюю страницу
        buttons.push(`<button type="button" class="active" data-page="${this.totalPages}">${this.totalPages}</button>`);
    }

    pagination.innerHTML = buttons.join('');
    
    // Добавляем обработчики событий для кнопок пагинации
    pagination.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(button.getAttribute('data-page'));
            if (!isNaN(page)) {
                this.goToPage(page);
            }
        });
    });
}

goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    this.renderProducts();
    
    // Плавная прокрутка вверх
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        mainLayout.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

    searchProducts() {
        const searchInput = document.getElementById('searchInput');
        this.currentSearch = searchInput.value.trim();
        this.currentPage = 1;
        this.applyFilters();
    }

    sortProducts() {
        const sortSelect = document.getElementById('sortSelect');
        this.currentSort = sortSelect.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    clearAllFilters() {
        // Очищаем все чекбоксы
        document.querySelectorAll('.filter-item input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
        
        // Очищаем поля цены
        document.getElementById('priceMin').value = '';
        document.getElementById('priceMax').value = '';
        
        // Очищаем поиск
        document.getElementById('searchInput').value = '';
        this.currentSearch = '';
        
        // Сброс сортировки
        document.getElementById('sortSelect').value = 'default';
        this.currentSort = 'default';
        
        this.currentPage = 1;
        this.applyFilters();
    }

    async openOrderModal(productId) {
        try {
            this.selectedProduct = this.allProducts.find(p => p.id === productId);
            
            if (!this.selectedProduct) {
                throw new Error('Товар не найден');
            }
            
            const modalProductInfo = document.getElementById('modalProductInfo');
            modalProductInfo.innerHTML = `
                <div style="display: flex; gap: 20px; margin-bottom: 24px; align-items: center; padding: 16px; background: #f7fafc; border-radius: 12px;">
                    <img src="${this.sanitizeImageUrl(this.selectedProduct.imageUrl)}" 
                         alt="${this.escapeHtml(this.selectedProduct.title)}" 
                         style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" />
                    <div>
                        <h4 style="margin-bottom: 8px; color: #2d3748;">${this.escapeHtml(this.selectedProduct.title)}</h4>
                        <p style="color: #38a169; font-size: 1.3rem; font-weight: 700;">
                            ${this.escapeHtml(this.selectedProduct.priceRub)}
                        </p>
                        ${this.selectedProduct.originalPriceEur ? `<p style="color: #a0aec0; font-size: 0.9rem;">Цена в оригинале: ${this.escapeHtml(this.selectedProduct.originalPriceEur)}</p>` : ''}
                    </div>
                </div>
            `;

            this.clearOrderForm();
            document.getElementById('orderModal').style.display = 'block';
            
        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
            alert('Не удалось загрузить информацию о товаре');
        }
    }

    closeModal() {
        document.getElementById('orderModal').style.display = 'none';
        this.selectedProduct = null;
    }

    clearOrderForm() {
        document.getElementById('customerName').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerComment').value = '';
    }

    async submitOrder() {
        if (!this.selectedProduct) {
            alert('Товар не выбран');
            return;
        }

        const customerData = {
            name: document.getElementById('customerName').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            comment: document.getElementById('customerComment').value.trim()
        };

        if (!customerData.name || !customerData.email) {
            alert('Пожалуйста, заполните обязательные поля (Имя и Email)');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerData.email)) {
            alert('Пожалуйста, введите корректный email');
            return;
        }

        try {
            const response = await fetch('/api/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: this.selectedProduct.id,
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
            console.error('Ошибка отправки заказа:', error);
            alert('Не удалось отправить заказ. Попробуйте позже.');
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('mainLayout').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mainLayout').style.display = 'grid';
    }

    showError(message) {
        const loading = document.getElementById('loading');
        loading.textContent = message;
        loading.style.color = '#e53e3e';
    }

    updateProductsCount(total) {
        document.getElementById('totalProducts').textContent = total;
    }

    extractPrice(priceStr) {
        if (!priceStr) return null;
        const match = priceStr.match(/(\d+[\d\s,\.]*)/);
        return match ? parseFloat(match[1].replace(/[\s,]/g, '')) : null;
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
}

// Глобальные функции
function searchProducts() {
    app.searchProducts();
}

function sortProducts() {
    app.sortProducts();
}

function clearAllFilters() {
    app.clearAllFilters();
}

function closeModal() {
    app.closeModal();
}

// Инициализация
const app = new ShopApp();