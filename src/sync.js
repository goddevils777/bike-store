const ReBikeParser = require('./parser');

async function runSync() {
  const parser = new ReBikeParser();
  
  try {
    console.log('🚀 Запуск синхронизации товаров...');
    const result = await parser.syncWithWebsite();
    
    console.log('\n🎉 Синхронизация завершена!');
    console.log(`✅ Актуальных товаров: ${result.found.length}`);
    console.log(`🗑️ Удалено устаревших: ${result.deleted.length}`);
    
    if (result.deleted.length > 0) {
      console.log('\n📋 Удаленные товары:');
      result.deleted.slice(0, 5).forEach(product => {
        console.log(`  - ${product.title}`);
      });
      if (result.deleted.length > 5) {
        console.log(`  ... и еще ${result.deleted.length - 5} товаров`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runSync();