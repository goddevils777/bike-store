class AdminLogin {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.pinInput = document.getElementById('pinCode');
        this.submitBtn = document.getElementById('submitBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.loading = document.getElementById('loading');
        this.hash = window.location.pathname.split('/')[2];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.pinInput.focus();
    }

    setupEventListeners() {
        this.loginForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Только цифры в пин-коде
        this.pinInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        // Enter для отправки формы
        this.pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSubmit(e);
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const pin = this.pinInput.value.trim();
        
        if (!pin) {
            this.showError('Введите пин-код');
            return;
        }

        if (pin.length < 4) {
            this.showError('Пин-код должен содержать минимум 4 цифры');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const response = await fetch(`/admin/${this.hash}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Успешный вход - перенаправляем
                this.showSuccess('Вход выполнен успешно!');
                setTimeout(() => {
                    window.location.href = result.redirectUrl;
                }, 1000);
            } else {
                this.showError(result.error);
                this.pinInput.value = '';
                this.pinInput.focus();
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showError('Ошибка соединения с сервером');
        } finally {
            this.setLoading(false);
        }
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.errorMessage.style.background = '#fed7d7';
        this.errorMessage.style.color = '#c53030';
        
        setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.errorMessage.style.background = '#c6f6d5';
        this.errorMessage.style.color = '#22543d';
    }
    
    setLoading(isLoading) {
        this.submitBtn.disabled = isLoading;
        this.pinInput.disabled = isLoading;
        this.loading.style.display = isLoading ? 'block' : 'none';
        
        if (isLoading) {
            this.submitBtn.textContent = 'Вход...';
        } else {
            this.submitBtn.textContent = 'Войти в админку';
        }
    }
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    new AdminLogin();
});