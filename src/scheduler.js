const cron = require('node-cron');
const ReBikeParser = require('./parser');
const config = require('../config/config.json');

class UpdateScheduler {
  constructor() {
    this.parser = new ReBikeParser();
    this.isRunning = false;
  }

  async runUpdate() {
    if (this.isRunning) {
      console.log('Обновление уже запущено, пропускаем...');
      return;
    }

    this.isRunning = true;
    console.log(`[${new Date().toISOString()}] Запуск автообновления каталога`);

    try {
      const result = await this.parser.parseFullUpdate();
      
      // Отправляем уведомление если есть изменения
      if (this.hasSignificantChanges(result.changes)) {
        await this.sendUpdateNotification(result.changes);
      }

      console.log(`[${new Date().toISOString()}] Обновление завершено успешно`);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Ошибка при обновлении:`, error.message);
      await this.sendErrorNotification(error);
    } finally {
      await this.parser.close();
      this.isRunning = false;
    }
  }

  hasSignificantChanges(changes) {
    const totalChanges = changes.added.length + changes.removed.length + changes.updated.length;
    return totalChanges > 0;
  }

  async sendUpdateNotification(changes) {
    const nodemailer = require('nodemailer');
    
    if (!config.email.user || config.email.user === 'your-email@gmail.com') {
      console.log('Email не настроен, пропускаем уведомление');
      return;
    }

    try {
      const transporter = nodemailer.createTransporter({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password
        }
      });

      const emailText = `
Обновление каталога завершено:

✅ Добавлено товаров: ${changes.added.length}
❌ Удалено товаров: ${changes.removed.length}  
🔄 Обновлено товаров: ${changes.updated.length}

Время обновления: ${new Date().toLocaleString('ru-RU')}
      `;

      await transporter.sendMail({
        from: config.email.user,
        to: config.email.to,
        subject: 'Обновление каталога ReBike',
        text: emailText
      });

      console.log('Уведомление об обновлении отправлено');
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error.message);
    }
  }

  async sendErrorNotification(error) {
    console.log('Отправка уведомления об ошибке:', error.message);
  }

  start() {
    console.log('Запуск планировщика обновлений...');
    
    // Каждые 6 часов
    cron.schedule('0 */6 * * *', () => {
      this.runUpdate();
    });

    // Каждую ночь в 2:00
    cron.schedule('0 2 * * *', () => {
      this.runUpdate();
    });

    console.log('Планировщик запущен. Обновления каждые 6 часов и в 2:00 ночи');
    
    // Запускаем первое обновление через 30 секунд
    setTimeout(() => {
      this.runUpdate();
    }, 30000);
  }

  async runOnce() {
    console.log('Запуск разового обновления...');
    await this.runUpdate();
    process.exit(0);
  }
}

module.exports = UpdateScheduler;

// Если файл запущен напрямую
if (require.main === module) {
  const scheduler = new UpdateScheduler();
  
  if (process.argv.includes('--once')) {
    scheduler.runOnce();
  } else {
    scheduler.start();
  }
}