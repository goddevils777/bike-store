const adminConfig = require('../../config/admin-config.json');

class AdminAuth {
    constructor() {
        this.sessions = new Map();
        this.loginAttempts = new Map();

        // Привязываем методы к контексту
        this.checkSecretHash = this.checkSecretHash.bind(this);
        this.verifyPin = this.verifyPin.bind(this);
        this.requireAuth = this.requireAuth.bind(this);
        this.logout = this.logout.bind(this);
    }

    // Проверка секретной ссылки
    checkSecretHash(req, res, next) {
        const { hash } = req.params;

        if (hash !== adminConfig.security.secretHash) {
            return res.status(404).send('Page not found');
        }

        next();
    }

    // Проверка пин-кода
    verifyPin(req, res, next) {
        const { pin } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        // Проверяем блокировку по IP
        if (this.isIpBlocked(clientIp)) {
            return res.status(429).json({
                error: 'Слишком много неудачных попыток. Попробуйте позже.'
            });
        }

        // Приводим к строке для сравнения
        if (pin.toString() !== adminConfig.security.pinCode.toString()) {
            this.recordFailedAttempt(clientIp);
            return res.status(401).json({ error: 'Неверный пин-код' });
        }

        // Пин-код верный - создаем сессию
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            ip: clientIp,
            createdAt: Date.now(),
            expiresAt: Date.now() + adminConfig.security.sessionDuration
        };

        this.sessions.set(sessionId, session);
        this.clearFailedAttempts(clientIp);

        // Устанавливаем cookie с сессией
        res.cookie('admin_session', sessionId, {
            httpOnly: true,
            secure: false,
            maxAge: adminConfig.security.sessionDuration
        });

        req.session = session;
        next();
    }

    // Проверка активной сессии

    requireAuth(req, res, next) {
        const sessionId = req.cookies.admin_session;

        if (!sessionId) {
            console.log('🔐 Нет cookie сессии');
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const session = this.sessions.get(sessionId);

        if (!session) {
            console.log('🔐 Сессия не найдена в памяти (возможно сервер перезапущен)');
            res.clearCookie('admin_session');
            return res.status(401).json({ error: 'Сессия истекла' });
        }

        if (session.expiresAt < Date.now()) {
            console.log('🔐 Сессия истекла по времени');
            this.sessions.delete(sessionId);
            res.clearCookie('admin_session');
            return res.status(401).json({ error: 'Сессия истекла' });
        }

        // Проверяем IP (опционально)
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        if (session.ip !== clientIp) {
            console.log('🔐 IP не совпадает');
            this.sessions.delete(sessionId);
            res.clearCookie('admin_session');
            return res.status(401).json({ error: 'Подозрительная активность' });
        }

        console.log('✅ Сессия валидна');
        req.session = session;
        next();
    }

    // Выход из системы
    logout(req, res) {
        const sessionId = req.cookies.admin_session;

        if (sessionId) {
            this.sessions.delete(sessionId);
        }

        res.clearCookie('admin_session');
        res.json({ success: true, message: 'Выход выполнен' });
    }

    // Вспомогательные методы остаются без изменений
    generateSessionId() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    recordFailedAttempt(ip) {
        const attempts = this.loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.loginAttempts.set(ip, attempts);
    }

    clearFailedAttempts(ip) {
        this.loginAttempts.delete(ip);
    }

    isIpBlocked(ip) {
        const attempts = this.loginAttempts.get(ip);

        if (!attempts) return false;

        if (attempts.count >= adminConfig.security.maxLoginAttempts) {
            const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
            return timeSinceLastAttempt < adminConfig.security.lockoutDuration;
        }

        return false;
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.expiresAt < now) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

const adminAuth = new AdminAuth();

// Очищаем истекшие сессии каждые 15 минут
setInterval(() => {
    adminAuth.cleanupExpiredSessions();
}, 15 * 60 * 1000);

module.exports = adminAuth;