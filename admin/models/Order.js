const database = require('./database');

class Order {
    static create(orderData) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = `
                INSERT INTO orders (
                    product_id, product_title, product_price, product_url,
                    customer_name, customer_email, customer_phone, 
                    customer_address, customer_comment, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
                orderData.productId,
                orderData.productTitle,
                orderData.productPrice,
                orderData.productUrl,
                orderData.customerName,
                orderData.customerEmail,
                orderData.customerPhone || null,
                orderData.customerAddress || null,
                orderData.customerComment || null,
                'new'
            ];
            
            db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...orderData });
                }
            });
        });
    }

    static getAll(filters = {}) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            let query = 'SELECT * FROM orders';
            let params = [];
            
            // Добавляем фильтры
            const conditions = [];
            
            if (filters.status) {
                conditions.push('status = ?');
                params.push(filters.status);
            }
            
            if (filters.dateFrom) {
                conditions.push('created_at >= ?');
                params.push(filters.dateFrom);
            }
            
            if (filters.dateTo) {
                conditions.push('created_at <= ?');
                params.push(filters.dateTo);
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            query += ' ORDER BY created_at DESC';
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    static getById(id) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static updateStatus(id, status) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const query = 'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            
            db.run(query, [status, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, status, updated: this.changes > 0 });
                }
            });
        });
    }

    static getStats() {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const queries = {
                total: 'SELECT COUNT(*) as count FROM orders',
                today: 'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE("now")',
                week: 'SELECT COUNT(*) as count FROM orders WHERE created_at >= date("now", "-7 days")',
                month: 'SELECT COUNT(*) as count FROM orders WHERE created_at >= date("now", "-30 days")',
                byStatus: 'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
            };
            
            const stats = {};
            let completed = 0;
            const total = Object.keys(queries).length;
            
            Object.entries(queries).forEach(([key, query]) => {
                if (key === 'byStatus') {
                    db.all(query, (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            stats[key] = rows;
                            completed++;
                            if (completed === total) resolve(stats);
                        }
                    });
                } else {
                    db.get(query, (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            stats[key] = row.count;
                            completed++;
                            if (completed === total) resolve(stats);
                        }
                    });
                }
            });
        });
    }
}

module.exports = Order;