const database = require('./database');

class Settings {
    static get(key) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.value : null);
                }
            });
        });
    }

    static getAll() {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            db.all('SELECT key, value FROM settings', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const settings = {};
                    rows.forEach(row => {
                        settings[row.key] = row.value;
                    });
                    resolve(settings);
                }
            });
        });
    }

    static set(key, value) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = `
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `;
            
            db.run(query, [key, value], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ key, value, updated: true });
                }
            });
        });
    }

    static updateMultiple(settings) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const updates = Object.entries(settings);
            let completed = 0;
            const results = {};
            
            if (updates.length === 0) {
                resolve(results);
                return;
            }
            
            updates.forEach(([key, value]) => {
                this.set(key, value)
                    .then(result => {
                        results[key] = result;
                        completed++;
                        if (completed === updates.length) {
                            resolve(results);
                        }
                    })
                    .catch(reject);
            });
        });
    }

    static getContacts() {
        return new Promise(async (resolve, reject) => {
            try {
                const contacts = {
                    email: await this.get('contact_email'),
                    phone: await this.get('contact_phone'),
                    hours: await this.get('contact_hours')
                };
                resolve(contacts);
            } catch (error) {
                reject(error);
            }
        });
    }

    static updateContacts(contacts) {
        return this.updateMultiple({
            contact_email: contacts.email,
            contact_phone: contacts.phone,
            contact_hours: contacts.hours
        });
    }

// ЗАМЕНИТЬ МЕТОД getMarkupPercent НА:
static getMarkupPercent() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('🔍 ОТЛАДКА: Запрос наценки из БД...');
            const value = await this.get('markup_percent');
            console.log('🔍 ОТЛАДКА: Получено из БД:', value, typeof value);
            
            const result = parseFloat(value) || 0;
            console.log('🔍 ОТЛАДКА: Обработанное значение:', result);
            
            resolve(result);
        } catch (error) {
            console.error('❌ ОТЛАДКА: Ошибка получения наценки:', error);
            reject(error);
        }
    });
}

static setMarkupPercent(percent) {
    console.log('💾 ОТЛАДКА: Попытка сохранить наценку:', percent, typeof percent);
    return this.set('markup_percent', percent.toString()).then(result => {
        console.log('💾 ОТЛАДКА: Результат сохранения:', result);
        return result;
    });
}

    static getNotificationEmail() {
        return this.get('notification_email');
    }

    static setNotificationEmail(email) {
        return this.set('notification_email', email);
    }

    static getEmailConfig() {
        return new Promise(async (resolve, reject) => {
            try {
                const config = {
                    notificationEmail: await this.get('notification_email'),
                    contactEmail: await this.get('contact_email')
                };
                resolve(config);
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = Settings;