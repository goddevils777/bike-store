const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, '../../data/admin.db');
        
        // Создаем папку data если её нет
        const dataDir = path.dirname(dbPath);
        if (!require('fs').existsSync(dataDir)) {
            require('fs').mkdirSync(dataDir, { recursive: true });
        }
        
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Ошибка подключения к БД:', err);
            } else {
                console.log('✅ Подключение к админ БД успешно');
                // Добавляем задержку перед созданием таблиц
                setTimeout(() => {
                    this.createTables();
                }, 100);
            }
        });
    }

createTables() {
    console.log('📝 Создание таблиц БД...');
    
    // Таблица заказов
    const ordersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            product_title TEXT NOT NULL,
            product_price TEXT NOT NULL,
            product_url TEXT,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT,
            customer_address TEXT,
            customer_comment TEXT,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // Таблица настроек
    const settingsTable = `
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    this.db.serialize(() => {
        this.db.run(ordersTable, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы orders:', err);
            } else {
                console.log('✅ Таблица orders создана');
            }
        });
        
        this.db.run(settingsTable, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы settings:', err);
            } else {
                console.log('✅ Таблица settings создана');
                this.initDefaultSettings();
            }
        });
    });
}

    initDefaultSettings() {
        const defaultSettings = [
            { key: 'contact_email', value: 'info@rebike-store.ru' },
            { key: 'contact_phone', value: '+7 (999) 123-45-67' },
            { key: 'contact_hours', value: 'Пн-Пт 9:00-18:00' },
            { key: 'markup_percent', value: '10' },
            { key: 'notification_email', value: 'orders@rebike-store.ru' }
        ];

        defaultSettings.forEach(setting => {
            this.db.run(
                'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
                [setting.key, setting.value]
            );
        });
    }

    getDb() {
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new Database();