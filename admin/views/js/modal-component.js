class AdminModal {
    constructor() {
        this.modal = null;
    }

    show(title, content, footerButtons = null) {
        // Удаляем предыдущее модальное окно если есть
        this.hide();
        
        // Создаем новое модальное окно
        this.modal = document.createElement('div');
        this.modal.className = 'modal';
        this.modal.style.display = 'block';
        
        const defaultFooter = footerButtons || `
            <button class="btn-secondary modal-close-btn">Закрыть</button>
        `;
        
        this.modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.escapeHtml(title)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                
                <div class="modal-body">
                    ${content}
                </div>
                
                <div class="modal-footer">
                    ${defaultFooter}
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        
        // Добавляем обработчики закрытия
        this.setupCloseHandlers();
        
        return this.modal;
    }

    setupCloseHandlers() {
        if (!this.modal) return;
        
        const closeModal = () => this.hide();

        // Закрытие по крестику
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        // Закрытие по кнопке "Закрыть"
        const closeBtnFooter = this.modal.querySelector('.modal-close-btn');
        if (closeBtnFooter) {
            closeBtnFooter.addEventListener('click', closeModal);
        }

        // Закрытие по клику вне модального окна
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                closeModal();
            }
        });

        // Закрытие по Escape
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    hide() {
        if (this.modal && this.modal.parentNode) {
            document.body.removeChild(this.modal);
        }
        
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
        
        this.modal = null;
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

// Создаем глобальный экземпляр
window.adminModal = new AdminModal();