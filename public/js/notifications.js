class NotificationManager {
    constructor() {
        this.createNotificationContainer();
    }

    createNotificationContainer() {
        if (document.getElementById('notificationContainer')) return;

        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    show(message, type = 'success', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;

        notification.style.cssText = `
            background: ${type === 'success' ? '#f0fff4' : type === 'error' ? '#fed7d7' : '#ebf8ff'};
            border: 1px solid ${type === 'success' ? '#9ae6b4' : type === 'error' ? '#feb2b2' : '#90cdf4'};
            color: ${type === 'success' ? '#22543d' : type === 'error' ? '#c53030' : '#2c5282'};
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(8px);
            pointer-events: auto;
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Стили для содержимого
        const content = notification.querySelector('.notification-content');
        content.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        const iconEl = notification.querySelector('.notification-icon');
        iconEl.style.cssText = `
            font-size: 20px;
            flex-shrink: 0;
        `;

        const messageEl = notification.querySelector('.notification-message');
        messageEl.style.cssText = `
            flex: 1;
            font-weight: 500;
            line-height: 1.4;
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            color: inherit;
            opacity: 0.7;
            flex-shrink: 0;
        `;

        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';

        // Добавляем в контейнер
        const container = document.getElementById('notificationContainer');
        container.appendChild(notification);

        // Анимация появления
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        });

        // Обработчик закрытия
        const close = () => {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', close);

        // Автозакрытие
        if (duration > 0) {
            setTimeout(close, duration);
        }

        return notification;
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Создаем глобальный экземпляр
window.notifications = new NotificationManager();