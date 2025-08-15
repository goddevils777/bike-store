class ShopApp {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentSearch = '';
        this.selectedProduct = null;
        this.allProducts = [];
        this.filteredProducts = [];
        this.currentSort = 'price-asc';
        this.activeCategory = 'all';
        this.filterTimeout = null; // ЗАМЕНИТЬ на это
        this.init();
    }

    // ОБНОВИТЬ МЕТОД init()
    async init() {
        await this.loadAllProducts();
        await this.loadContacts();
        await this.loadMarkup(); // ДОБАВИТЬ ЭТУ СТРОКУ
        this.setupEventListeners();
        this.setDefaultActiveCategory();
        this.applyFilters();
    }

    async loadContacts() {
        try {
            const response = await fetch('/api/contacts');
            if (response.ok) {
                const contacts = await response.json();
                this.updateContactsUI(contacts);
            }
        } catch (error) {
            console.log('Не удалось загрузить контакты');
        }
    }

    // ЗАМЕНИТЬ МЕТОД loadMarkup НА:
    async loadMarkup() {
        try {
            const response = await fetch('/api/markup');
            if (response.ok) {
                const data = await response.json();
                this.currentMarkup = parseFloat(data.markup) || 0;
                console.log(`💰 ОТЛАДКА: Загружена наценка из API: ${data.markup}% (тип: ${typeof data.markup})`);
                console.log(`💰 ОТЛАДКА: Обработанная наценка: ${this.currentMarkup}% (тип: ${typeof this.currentMarkup})`);
                this.recalculatePrices();
            }
        } catch (error) {
            console.log('Не удалось загрузить наценку');
            this.currentMarkup = 0;
            this.recalculatePrices();
        }
    }


    // ЗАМЕНИТЬ МЕТОД recalculatePrices НА:
    recalculatePrices() {
        console.log(`🔧 ОТЛАДКА: Пересчет цен с наценкой ${this.currentMarkup}%`);

        // Берем первый товар для примера
        if (this.allProducts.length > 0) {
            const firstProduct = this.allProducts[0];
            console.log(`📦 ОТЛАДКА первого товара ПЕРЕД пересчетом:`, {
                title: firstProduct.title?.substring(0, 30),
                originalPriceEur: firstProduct.originalPriceEur,
                currentPriceEur: firstProduct.currentPriceEur,
                originalBasePriceEur: firstProduct.originalBasePriceEur,
                currentBasePriceEur: firstProduct.currentBasePriceEur,
                priceRub: firstProduct.priceRub
            });
        }

        // Пересчитываем цены для всех товаров
        this.allProducts.forEach((product, index) => {
            // Логируем только первые 3 товара для примера
            if (index < 3) {
                console.log(`🔧 ОТЛАДКА товара ${index + 1} - обработка...`);
            }

            // Используем базовые цены если они есть
            let originalBasePrice = product.originalBasePriceEur;
            let currentBasePrice = product.currentBasePriceEur;

            // Если базовых цен нет, пытаемся извлечь из строк
            if (!originalBasePrice && product.originalPriceEur) {
                originalBasePrice = this.extractPrice(product.originalPriceEur);
            }
            if (!currentBasePrice && product.currentPriceEur) {
                currentBasePrice = this.extractPrice(product.currentPriceEur);
            }

            if (index < 3) {
                console.log(`💰 ОТЛАДКА товара ${index + 1} - базовые цены:`, {
                    originalBasePrice,
                    currentBasePrice,
                    markup: this.currentMarkup
                });
            }

            if (currentBasePrice) {
                // ПРОВЕРЯЕМ: если наценка 0% - используем оригинальные цены
                if (this.currentMarkup === 0) {
                    product.priceRub = `${currentBasePrice} €`;
                    if (originalBasePrice) {
                        product.originalPriceRub = `${originalBasePrice} €`;
                    }
                    if (index < 3) {
                        console.log(`✅ ОТЛАДКА товара ${index + 1} - наценка 0%, цена:`, product.priceRub);
                    }
                } else {
                    // Применяем наценку только если она больше 0
                    const newCurrentPrice = Math.round(currentBasePrice * (1 + this.currentMarkup / 100));
                    product.priceRub = `${newCurrentPrice} €`;

                    if (originalBasePrice) {
                        const newOriginalPrice = Math.round(originalBasePrice * (1 + this.currentMarkup / 100));
                        product.originalPriceRub = `${newOriginalPrice} €`;
                    }
                    if (index < 3) {
                        console.log(`💸 ОТЛАДКА товара ${index + 1} - наценка ${this.currentMarkup}%, новая цена:`, product.priceRub);
                    }
                }

                // Пересчитываем скидку между БАЗОВЫМИ ценами (всегда одинаково)
                if (originalBasePrice && originalBasePrice > currentBasePrice) {
                    product.discountPercent = Math.round((1 - currentBasePrice / originalBasePrice) * 100);
                } else {
                    product.discountPercent = 0;
                }
            }
        });

        console.log(`🏁 ОТЛАДКА: Пересчет завершен, перерендериваем товары...`);

        // Перерендериваем товары если они уже загружены
        if (this.filteredProducts && this.filteredProducts.length > 0) {
            this.renderProducts();
        }
    }

    updateContactsUI(contacts) {
        // Обновляем контакты в шапке
        const emailElement = document.querySelector('.contact-item:nth-child(1)');
        const phoneElement = document.querySelector('.contact-item:nth-child(2)');
        const hoursElement = document.querySelector('.contact-item:nth-child(3)');

        if (emailElement) {
            emailElement.innerHTML = `<strong>📧</strong> ${contacts.email}`;
        }
        if (phoneElement) {
            phoneElement.innerHTML = `<strong>📞</strong> ${contacts.phone}`;
        }
        if (hoursElement) {
            hoursElement.innerHTML = `<strong>⏰</strong> ${contacts.hours}`;
        }
    }


    setDefaultActiveCategory() {
        // Ждем загрузки компонентов
        setTimeout(() => {
            const categoryItems = document.querySelectorAll('.category-item');
            if (categoryItems.length > 0) {
                // Убираем active у всех категорий
                categoryItems.forEach(item => {
                    item.classList.remove('active');
                });

                // Устанавливаем active для "Alle E-Bikes"
                const alleEBikesCategory = document.querySelector('[data-category="all"]');
                if (alleEBikesCategory) {
                    alleEBikesCategory.classList.add('active');
                }
            }

            this.activeCategory = 'all';
        }, 100);
    }

    setupEventListeners() {
        // Поиск по Enter
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchProducts();
                }
            });
        }

        // Фильтры
        const filterInputs = document.querySelectorAll('.filter-item input, .price-input');
        filterInputs.forEach(input => {
            input.addEventListener('change', () => this.applyFilters());
            if (input.type === 'number') {
                input.addEventListener('input', () => this.debounceFilter());
            }
        });

        // Категории - простые обработчики без блокировок
        setTimeout(() => {
            const categoryItems = document.querySelectorAll('.category-item');
            categoryItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();

                    const category = item.getAttribute('data-category');
                    if (category) {
                        this.selectCategory(category);
                    }
                });
            });

            console.log(`Навешаны обработчики на ${categoryItems.length} категорий`);
        }, 200);

        // Остальные обработчики остаются без изменений
        const orderForm = document.getElementById('orderForm');
        if (orderForm) {
            orderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitOrder();
            });
        }

        const modal = document.getElementById('orderModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        this.setupSearchSuggestions();
        this.setupFiltersToggle();
    }





    debounceFilter() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => this.applyFilters(), 500);
    }

    selectCategory(category) {
        console.log(`Переключение на категорию: ${category}`);

        // Просто обновляем состояние без блокировок
        this.activeCategory = category;
        this.currentPage = 1;

        // Сбрасываем поиск при смене категории
        this.currentSearch = '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        // Обновляем UI немедленно
        this.updateCategoryUI(category);

        // Отменяем предыдущий запрос фильтрации если он есть
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }

        // Применяем фильтры с небольшой задержкой для группировки
        this.filterTimeout = setTimeout(() => {
            this.applyFilters();
        }, 100);
    }

    updateCategoryUI(activeCategory) {
        // Используем requestAnimationFrame для плавного обновления UI
        requestAnimationFrame(() => {
            try {
                const categoryItems = document.querySelectorAll('.category-item');

                categoryItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    if (itemCategory === activeCategory) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });

                console.log(`UI обновлен для категории: ${activeCategory}`);
            } catch (error) {
                console.error('Ошибка обновления UI категорий:', error);
            }
        });
    }



    async loadAllProducts(page = 1) {
        try {
            this.showLoading();

            const category = this.activeCategory || 'all';
            const searchQuery = this.currentSearch || '';

            console.log(`🔍 ОТЛАДКА фронтенд: загружаем категорию "${category}", страница ${page}`);

            const params = new URLSearchParams({
                category: category,
                page: page,
                limit: 24
            });

            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const response = await fetch(`/api/products?${params}`);

            if (!response.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const data = await response.json();
            console.log('🔍 Полученные данные от сервера:', data);
            console.log('🔍 Пагинация от сервера:', data.pagination);

            // Теперь получаем только товары текущей страницы
            this.allProducts = data.products || [];
            this.filteredProducts = data.products || [];

            // Обновляем информацию о пагинации с проверкой
            if (data.pagination) {
                this.currentPage = data.pagination.currentPage;
                this.totalPages = data.pagination.totalPages;
                console.log(`📄 Пагинация: страница ${this.currentPage}/${this.totalPages}`);
            } else {
                // Fallback для старого формата ответа
                this.currentPage = page;
                this.totalPages = data.totalPages || 1;
                console.log(`📄 Fallback пагинация: страница ${this.currentPage}/${this.totalPages}`);
            }

            console.log(`📄 Загружена страница ${this.currentPage}/${this.totalPages} (${this.allProducts.length} товаров)`);

            this.renderProducts();
            this.renderPagination();
            this.updateProductsCount(data.pagination ? data.pagination.totalProducts : (data.total || this.allProducts.length));
            this.hideLoading();

        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            this.showError('Не удалось загрузить товары. Попробуйте позже.');
        }
    }



    applyFilters() {
        let filtered = [...this.allProducts];

        console.log(`Применяем фильтры к ${filtered.length} товарам`);

        // Фильтр по категории
        // Фильтр по категории
        filtered = filtered.filter(product => {
            if (!product.category) return false;

            const category = product.category;
            const title = product.title ? product.title.toLowerCase() : '';

            switch (this.activeCategory) {
                case 'sales':
                    return category === 'sales';
                case 'all':
                    return category === 'all';
                case 'trekking-city':
                    return category === 'trekking-city';
                case 'trekking':
                    return category === 'trekking';
                case 'city':
                    return category === 'city';
                case 'urban':
                    return category === 'urban';
                case 'mountain':
                    return category === 'mountain';
                case 'hardtail':
                    return category === 'hardtail';
                case 'fully':
                    return category === 'fully';
                case 'cargo':
                    return category === 'cargo';
                case 'speed':
                    return category === 'speed';
                case 'gravel':
                    return category === 'gravel';
                case 'kids':
                    return category === 'kids';
                case 'classic':
                    return category === 'classic';
                default:
                    return category === this.activeCategory;
            }
        });

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
                    switch (condition) {
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
                    switch (type) {
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
    }

    getCheckedFilters(filterIds) {
        return filterIds
            .filter(id => {
                const element = document.getElementById(id);
                return element && element.checked; // ДОБАВИТЬ ПРОВЕРКУ НА СУЩЕСТВОВАНИЕ
            })
            .map(id => document.getElementById(id).value);
    }

    applySorting() {
        const sortValue = this.currentSort;

        switch (sortValue) {
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

        // Используем ВСЕ товары (уже только 24 со страницы)
        const pageProducts = this.allProducts;

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
            card.addEventListener('click', (e) => {
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

        // ВАЖНО: рендерим пагинацию ПОСЛЕ товаров
        this.renderPagination();
    }

    renderPagination() {
        console.log(`🔢 Рендерим пагинацию: страница ${this.currentPage} из ${this.totalPages}`);

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

        console.log(`📄 Переход на страницу ${page}`);
        this.loadAllProducts(page);

        // Прокрутка вверх
        const mainLayout = document.getElementById('mainLayout');
        if (mainLayout) {
            mainLayout.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    searchProducts() {
        const searchInput = document.getElementById('searchInput');
        this.currentSearch = searchInput.value.trim();
        this.currentPage = 1; // Сбрасываем на первую страницу при поиске
        this.loadAllProducts(1);
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
                        ${this.selectedProduct.originalPriceRub ? `<p style="color: #a0aec0; font-size: 0.9rem;">Цена в оригинале: ${this.escapeHtml(this.selectedProduct.originalPriceRub)}</p>` : ''}
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
        document.getElementById('customerAddress').value = ''; // ДОБАВИТЬ ЭТО
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
            address: document.getElementById('customerAddress').value.trim(), // ДОБАВИТЬ ЭТО
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


    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        const search = urlParams.get('search');

        if (category) {
            // Ждем загрузки компонентов перед применением категории
            setTimeout(() => {
                this.selectCategory(category);
            }, 100);
        }

        if (search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = search;
                this.currentSearch = search;
            }
        }
    }


    // ДОБАВИТЬ НОВЫЕ МЕТОДЫ в класс ShopApp

    setupSearchSuggestions() {
        const searchInput = document.getElementById('searchInput');
        const suggestions = document.getElementById('searchSuggestions');

        if (!searchInput || !suggestions) return;

        // Показываем подсказки при вводе
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                this.showSearchSuggestions(query);
            } else {
                this.hideSearchSuggestions();
            }
        });

        // Скрываем подсказки при клике вне
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
                this.hideSearchSuggestions();
            }
        });
    }

    showSearchSuggestions(query) {
        const suggestions = document.getElementById('searchSuggestions');
        if (!suggestions) return;

        // Фильтруем товары по запросу
        const filtered = this.allProducts.filter(product =>
            product.title.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5); // Показываем максимум 5 подсказок

        if (filtered.length === 0) {
            this.hideSearchSuggestions();
            return;
        }

        suggestions.innerHTML = filtered.map(product => `
        <div class="suggestion-item" data-product-id="${product.id}">
            <img src="${this.sanitizeImageUrl(product.imageUrl)}" 
                 alt="${this.escapeHtml(product.title)}" 
                 class="suggestion-image"
                 onerror="this.style.display='none'">
            <div class="suggestion-text">
                <div class="suggestion-title">${this.escapeHtml(product.title)}</div>
                <div class="suggestion-price">${this.escapeHtml(product.priceRub)}</div>
            </div>
        </div>
    `).join('');

        // Добавляем обработчики кликов
        suggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const productId = item.getAttribute('data-product-id');
                window.location.href = `product.html?id=${productId}`;
            });
        });

        suggestions.style.display = 'block';
    }

    hideSearchSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.style.display = 'none';
        }
    }


    setupFiltersToggle() {
        const toggleButton = document.getElementById('filtersToggle');
        const filtersContent = document.getElementById('filtersContent');

        if (!toggleButton || !filtersContent) return;

        // Начальное состояние для мобильных устройств
        if (window.innerWidth <= 700) {
            filtersContent.classList.add('collapsed');
            toggleButton.textContent = 'Показать фильтры';
        }

        toggleButton.addEventListener('click', () => {
            const isCollapsed = filtersContent.classList.contains('collapsed');

            if (isCollapsed) {
                filtersContent.classList.remove('collapsed');
                toggleButton.classList.add('active');
                toggleButton.textContent = 'Скрыть фильтры';
            } else {
                filtersContent.classList.add('collapsed');
                toggleButton.classList.remove('active');
                toggleButton.textContent = 'Показать фильтры';
            }
        });

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            if (window.innerWidth > 700) {
                filtersContent.classList.remove('collapsed');
                toggleButton.classList.remove('active');
            } else if (!toggleButton.classList.contains('active')) {
                filtersContent.classList.add('collapsed');
            }
        });
    }



    buildDynamicFilters() {
        const brands = new Set();
        const conditions = new Set();
        const types = new Set();

        // Собираем уникальные значения из всех товаров
        this.allProducts.forEach(product => {
            // Бренды - первое слово из названия
            const brand = product.title.split(' ')[0].toLowerCase();
            brands.add(brand);

            // Состояние по category и title
            if (product.category === 'gebraucht' || product.title.toLowerCase().includes('gebraucht')) {
                conditions.add('used');
            } else if (product.title.toLowerCase().includes('refurbished') || product.title.toLowerCase().includes('premium')) {
                conditions.add('refurbished');
            } else {
                conditions.add('new');
            }

            // Типы по title
            const title = product.title.toLowerCase();
            if (title.includes('city') || title.includes('urban')) types.add('city');
            if (title.includes('mountain') || title.includes('mtb')) types.add('mountain');
            if (title.includes('e-bike') || title.includes('electric')) types.add('electric');
            if (title.includes('road') || title.includes('renn')) types.add('road');
            if (title.includes('folding') || title.includes('falt')) types.add('folding');
            if (title.includes('trekking')) types.add('trekking');
        });

        this.updateFilterOptions('condition', conditions);
        this.updateFilterOptions('type', types);
        this.updateFilterOptions('brand', brands);
    }

    updateFilterOptions(filterType, availableOptions) {
        const filterMappings = {
            condition: [
                { value: 'new', id: 'conditionNew', label: 'Новые' },
                { value: 'refurbished', id: 'conditionRefurb', label: 'Восстановленные' },
                { value: 'used', id: 'conditionUsed', label: 'Б/У' }
            ],
            type: [
                { value: 'city', id: 'typeCity', label: 'Городские' },
                { value: 'mountain', id: 'typeMountain', label: 'Горные' },
                { value: 'electric', id: 'typeElectric', label: 'Электровелосипеды' },
                { value: 'road', id: 'typeRoad', label: 'Шоссейные' },
                { value: 'folding', id: 'typeFolding', label: 'Складные' },
                { value: 'trekking', id: 'typeTrekking', label: 'Треккинговые' }
            ],
            brand: [
                { value: 'pegasus', id: 'brandPegasus', label: 'Pegasus' },
                { value: 'westland', id: 'brandWestland', label: 'Westland' },
                { value: 'triumph', id: 'brandTriumph', label: 'Triumph' },
                { value: 'cube', id: 'brandCube', label: 'Cube' },
                { value: 'trek', id: 'brandTrek', label: 'Trek' },
                { value: 'giant', id: 'brandGiant', label: 'Giant' }
            ]
        };

        const mapping = filterMappings[filterType];
        if (!mapping) return;

        mapping.forEach(item => {
            const element = document.getElementById(item.id);
            const filterItem = element?.closest('.filter-item');

            if (filterItem) {
                if (availableOptions.has(item.value)) {
                    filterItem.style.display = 'flex';
                } else {
                    filterItem.style.display = 'none';
                    element.checked = false; // Снимаем галочку если опция недоступна
                }
            }
        });
    }

    handleCategoryClick(category) {
        console.log(`🎯 ОТЛАДКА: выбрана категория "${category}"`);
        this.activeCategory = category;
        this.currentPage = 1; // Сбрасываем на первую страницу
        this.currentSearch = ''; // Сбрасываем поиск

        // Очищаем поле поиска
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        this.loadAllProducts(1); // Загружаем первую страницу новой категории
    }


}

// Глобальные функции
function searchProducts() {
    if (window.app) window.app.searchProducts();
}

function sortProducts() {
    if (window.app) window.app.sortProducts();
}

function clearAllFilters() {
    if (window.app) window.app.clearAllFilters();
}

function closeModal() {
    if (window.app) window.app.closeModal();
}


document.addEventListener('DOMContentLoaded', () => {
    window.app = new ShopApp(); // ✅ ПРАВИЛЬНЫЙ КЛАСС

    // Глобальные функции для HTML
    window.handleCategoryClick = (category) => {
        console.log(`🌍 Глобальный handleCategoryClick: "${category}"`);
        if (window.app) {
            window.app.handleCategoryClick(category);
        }
    };

    console.log('✅ Приложение и глобальные функции инициализированы');
});

