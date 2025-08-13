class ComponentLoader {
    static async loadComponent(componentName, containerId) {
        try {
            const response = await fetch(`/components/${componentName}.html`);
            if (!response.ok) {
                throw new Error(`Компонент ${componentName} не найден`);
            }
            
            const html = await response.text();
            const container = document.getElementById(containerId);
            
            if (container) {
                container.innerHTML = html;
            } else {
                console.error(`Контейнер ${containerId} не найден`);
            }
        } catch (error) {
            console.error(`Ошибка загрузки компонента ${componentName}:`, error);
        }
    }

    static async loadHeader() {
        await this.loadComponent('header', 'headerContainer');
    }

    static async loadFooter() {
        await this.loadComponent('footer', 'footerContainer');
    }

    static async loadAll() {
        await Promise.all([
            this.loadHeader(),
            this.loadFooter()
        ]);
    }
}

// Глобальные функции для обработки кликов в header
function handleHomeClick(event) {
    // Если мы на главной странице - перезагружаем
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        event.preventDefault();
        window.location.reload();
        return false;
    }
    // Иначе переходим на главную
    return true;
}

function handleCategoryClick(category) {
    // Если мы не на главной странице - переходим на главную с категорией
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = `/?category=${category}`;
        return;
    }
    
    // Если на главной - используем существующую функцию
    if (window.app && window.app.selectCategory) {
        window.app.selectCategory(category);
    }
}

function handleSearchClick() {
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput.value.trim();
    
    // Если не на главной странице - переходим на главную с поиском
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = `/?search=${encodeURIComponent(searchValue)}`;
        return;
    }
    
    // Если на главной - используем существующую функцию
    if (window.searchProducts) {
        window.searchProducts();
    }
}

// Функционал навигации по категориям
class CategoryNavigation {
    constructor() {
        this.container = null;
        this.leftBtn = null;
        this.rightBtn = null;
        this.init();
    }

    init() {
        // Ждем загрузки компонентов
        setTimeout(() => {
            this.container = document.getElementById('categoriesContainer');
            this.leftBtn = document.getElementById('categoryNavLeft');
            this.rightBtn = document.getElementById('categoryNavRight');
            
            if (this.container && this.leftBtn && this.rightBtn) {
                this.setupEventListeners();
                this.updateButtonStates();
            }
        }, 300);
    }

    setupEventListeners() {
        // Клик по левой стрелке
        this.leftBtn.addEventListener('click', () => {
            this.scrollLeft();
        });

        // Клик по правой стрелке
        this.rightBtn.addEventListener('click', () => {
            this.scrollRight();
        });

        // Обновляем состояние кнопок при скролле
        this.container.addEventListener('scroll', () => {
            this.updateButtonStates();
        });

        // Обновляем при изменении размера окна
        window.addEventListener('resize', () => {
            setTimeout(() => this.updateButtonStates(), 100);
        });
    }

    scrollLeft() {
        const scrollAmount = 200;
        this.container.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    }

    scrollRight() {
        const scrollAmount = 200;
        this.container.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    }

    updateButtonStates() {
        if (!this.container || !this.leftBtn || !this.rightBtn) return;

        const { scrollLeft, scrollWidth, clientWidth } = this.container;
        
        // Левая кнопка
        this.leftBtn.disabled = scrollLeft <= 0;
        
        // Правая кнопка
        this.rightBtn.disabled = scrollLeft >= scrollWidth - clientWidth - 1;
    }
}

// Инициализируем навигацию после загрузки компонентов
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new CategoryNavigation();
    }, 500);
});

// Автоматическая загрузка компонентов при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    ComponentLoader.loadAll();
});