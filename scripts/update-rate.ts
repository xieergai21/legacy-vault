/**
 * LEGACY VAULT - UPDATE RATE SCRIPT
 * Обновляет курс MAS/USD в контракте через CoinGecko API
 * 
 * Использование:
 *   npx ts-node update-rate.ts          # Обновить курс
 *   npx ts-node update-rate.ts --check  # Только проверить текущий курс
 *   npx ts-node update-rate.ts --force 5 # Принудительно установить 5 центов
 */

import * as dotenv from 'dotenv';
import {
  Account,
  Web3Provider,
  SmartContract,
  Args,
} from '@massalabs/massa-web3';

dotenv.config();

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=massa&vs_currencies=usd';

const config = {
  // Oracle приватный ключ (должен совпадать с ORACLE_ADDRESS при деплое)
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '',
  contractAddress: process.env.CONTRACT_ADDRESS || 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7',
};

function toNanoMassa(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

async function fetchMasPrice(): Promise<number> {
  console.log('📡 Получаем курс MAS/USD с CoinGecko...');
  
  const response = await fetch(COINGECKO_API);
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  const price = data?.massa?.usd;
  
  if (!price || typeof price !== 'number') {
    throw new Error('Invalid price data from CoinGecko');
  }
  
  console.log(`   💵 Текущий курс: $${price.toFixed(4)} за 1 MAS`);
  return price;
}

function usdToCents(usd: number): number {
  // Конвертируем USD в центы, округляя до целого
  // Например: $0.0512 = 5.12 центов → 5 центов
  return Math.round(usd * 100);
}

async function getCurrentRate(contract: SmartContract): Promise<bigint> {
  const result = await contract.read('getRate', new Args().serialize());
  return new Args(result.value).nextU64();
}

async function updateRate(contract: SmartContract, newRate: bigint, provider: Web3Provider): Promise<void> {
  console.log(`\n⏳ Отправляем updateRate(${newRate}) в контракт...`);
  
  const op = await contract.call(
    'updateRate',
    new Args().addU64(newRate).serialize(),
    {
      coins: 0n,
      maxGas: 50_000_000n,
      fee: toNanoMassa(0.01),
    }
  );
  
  console.log(`   📤 Operation ID: ${op.id}`);
  console.log('   ⏳ Ожидаем подтверждения...');
  
  await op.waitFinalExecution();
  console.log('   ✅ Курс успешно обновлён!');
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('🔄 LEGACY VAULT - UPDATE RATE');
  console.log('═'.repeat(60));

  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const forceIndex = args.indexOf('--force');
  const forceRate = forceIndex !== -1 ? parseInt(args[forceIndex + 1]) : null;

  if (!config.oraclePrivateKey) {
    throw new Error('❌ ORACLE_PRIVATE_KEY или DEPLOYER_PRIVATE_KEY не установлен в .env');
  }

  // Подключаемся к сети
  const account = await Account.fromPrivateKey(config.oraclePrivateKey);
  const oracleAddress = account.address.toString();
  console.log(`\n👛 Oracle кошелёк: ${oracleAddress}`);
  console.log(`📄 Контракт: ${config.contractAddress}`);

  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, config.contractAddress);

  // Получаем текущий курс из контракта
  const currentRate = await getCurrentRate(contract);
  console.log(`\n📊 Текущий RATE в контракте: ${currentRate} центов ($${Number(currentRate) / 100})`);

  // Если только проверка - выходим
  if (checkOnly) {
    // Show tier prices
    console.log('\n💰 Tier prices at current rate:');
    const tierPrices = [
      { name: 'FREE', usd: 0 },
      { name: 'LIGHT', usd: 9.99 },
      { name: 'VAULT PRO', usd: 29.99 },
      { name: 'LEGATE', usd: 89.99 },
    ];
    
    for (const tier of tierPrices) {
      if (tier.usd === 0) {
        console.log(`   ${tier.name}: FREE`);
      } else {
        const masPrice = (tier.usd * 100) / Number(currentRate);
        console.log(`   ${tier.name}: ${masPrice.toFixed(2)} MAS ($${tier.usd})`);
      }
    }
    
    // Get real rate for comparison
    try {
      const realPrice = await fetchMasPrice();
      const realCents = usdToCents(realPrice);
      console.log(`\n🌐 Реальный курс CoinGecko: ${realCents} центов ($${realPrice.toFixed(4)})`);
      
      if (Number(currentRate) !== realCents) {
        console.log(`\n⚠️  РАСХОЖДЕНИЕ! Контракт: ${currentRate}¢, Реальный: ${realCents}¢`);
        console.log(`   Запустите: npx ts-node update-rate.ts`);
      } else {
        console.log(`\n✅ Курс актуален!`);
      }
    } catch (e: any) {
      console.log(`\n⚠️  Не удалось получить курс с CoinGecko: ${e.message}`);
    }
    
    return;
  }

  // Определяем новый курс
  let newRateCents: number;
  
  if (forceRate !== null) {
    // Принудительная установка
    console.log(`\n🔧 Принудительная установка курса: ${forceRate} центов`);
    newRateCents = forceRate;
  } else {
    // Получаем с CoinGecko
    const masPrice = await fetchMasPrice();
    newRateCents = usdToCents(masPrice);
    console.log(`   📈 Курс в центах: ${newRateCents}¢`);
  }

  // Проверяем, нужно ли обновлять
  if (BigInt(newRateCents) === currentRate) {
    console.log('\n✅ Курс уже актуален, обновление не требуется.');
    return;
  }

  // Валидация
  if (newRateCents <= 0 || newRateCents >= 1000000) {
    throw new Error(`❌ Некорректный курс: ${newRateCents}. Должен быть 1-999999 центов.`);
  }

  console.log(`\n📝 Обновляем курс: ${currentRate}¢ → ${newRateCents}¢`);

  // Обновляем
  await updateRate(contract, BigInt(newRateCents), provider);

  // Проверяем результат
  const updatedRate = await getCurrentRate(contract);
  console.log(`\n✅ Новый RATE в контракте: ${updatedRate} центов ($${Number(updatedRate) / 100})`);

  // Показываем новые цены
  console.log('\n💰 Updated tier prices:');
  const tierPrices = [
    { name: 'FREE', usd: 0 },
    { name: 'LIGHT', usd: 9.99 },
    { name: 'VAULT PRO', usd: 29.99 },
    { name: 'LEGATE', usd: 89.99 },
  ];
  
  for (const tier of tierPrices) {
    if (tier.usd === 0) {
      console.log(`   ${tier.name}: FREE`);
    } else {
      const masPrice = (tier.usd * 100) / Number(updatedRate);
      console.log(`   ${tier.name}: ${masPrice.toFixed(2)} MAS ($${tier.usd})`);
    }
  }

  console.log('\n🎉 Готово!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });
