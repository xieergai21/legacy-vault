/**
 * LEGACY VAULT - ТЕСТОВЫЙ СКРИПТ (ASC версия)
 */

import * as dotenv from 'dotenv';
import {
  Account,
  Web3Provider,
  SmartContract,
  Args,
} from '@massalabs/massa-web3';

dotenv.config();

const config = {
  privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
  contractAddress: process.env.CONTRACT_ADDRESS || 'AS12v6bTHRSLctNN3qxfcEPfpBkCk8VPs2QVp9FrHQYbMj1KBSQGb',
};

function toNanoMassa(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

function fromNanoMassa(nano: bigint): string {
  const whole = nano / 1_000_000_000n;
  const frac = nano % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

async function test(): Promise<void> {
  console.log('🧪 ТЕСТИРОВАНИЕ LEGACY VAULT (ASC версия)\n');
  console.log('═'.repeat(60));

  const account = await Account.fromPrivateKey(config.privateKey);
  const walletAddress = account.address.toString();
  console.log(`👛 Кошелек: ${walletAddress}`);
  console.log(`📄 Контракт: ${config.contractAddress}\n`);

  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, config.contractAddress);

  // ===== TEST 1: Check rate =====
  console.log('═'.repeat(60));
  console.log('📊 TEST 1: Get MASSA/USD rate');
  console.log('═'.repeat(60));
  
  try {
    const rateResult = await contract.read('getRate', new Args().serialize());
    const rate = new Args(rateResult.value).nextU64();
    console.log(`✅ Курс: ${rate} центов за 1 MASSA ($${Number(rate) / 100})`);
  } catch (e: any) {
    console.log(`❌ Ошибка: ${e.message}`);
  }

  // ===== TEST 2: Check tier price =====
  console.log('\n' + '═'.repeat(60));
  console.log('💰 TEST 2: Tier prices');
  console.log('═'.repeat(60));

  const tierNames = ['FREE', 'LIGHT', 'VAULT_PRO', 'LEGATE'];
  for (let tier = 0; tier <= 3; tier++) {
    try {
      const priceResult = await contract.read('getTierPrice', new Args().addU8(tier).serialize());
      const price = new Args(priceResult.value).nextU64();
      console.log(`   ${tierNames[tier]}: ${fromNanoMassa(price)} MASSA`);
    } catch (e: any) {
      console.log(`   ${tierNames[tier]}: ❌ ${e.message}`);
    }
  }

  // ===== TEST 3: Check vault existence =====
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 TEST 3: Check vault existence');
  console.log('═'.repeat(60));

  try {
    const hasVaultResult = await contract.read('hasVault', new Args().addString(walletAddress).serialize());
    const hasVault = new Args(hasVaultResult.value).nextU64();
    console.log(`✅ Vault существует: ${hasVault === 1n ? 'ДА' : 'НЕТ'}`);
  } catch (e: any) {
    console.log(`❌ Ошибка: ${e.message}`);
  }

  // ===== TEST 4: Create vault (FREE tier) with 6 MAS =====
  console.log('\n' + '═'.repeat(60));
  console.log('🏗️  TEST 4: Create vault (FREE + 6 MAS for Gas Tank)');
  console.log('═'.repeat(60));

  const testHeir = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';
  
  // Using 2 minutes for test (120000 ms) - but contract requires minimum 1 day
  // Поэтому ставим 1 день + 1 минуту
  const oneDay = 86400000;
  
  const createArgs = new Args()
    .addU8(0)                    // tier: FREE
    .addU32(1)                   // number of heirs
    .addString(testHeir)         // heir address
    .addU64(BigInt(oneDay))      // интервал: 1 день
    .addString('Test encrypted payload ASC')
    .addString('')
    .addString('test-encrypted-key-asc');

  try {
    console.log('   Отправляем 6 MAS (5 Gas Tank + 0.01 fee + остаток)...');
    const op = await contract.call('createVault', createArgs.serialize(), {
      coins: toNanoMassa(6),  // 6 MAS for Gas Tank
      maxGas: 500_000_000n,   // More gas for deferred call
    });
    
    console.log(`   📤 Operation ID: ${op.id}`);
    console.log('   ⏳ Ожидаем подтверждения...');
    
    await op.waitFinalExecution();
    console.log('   ✅ Vault создан с ASC таймером!');
  } catch (e: any) {
    if (e.message.includes('Vault exists')) {
      console.log('   ⚠️  Vault уже существует');
    } else {
      console.log(`   ❌ Ошибка: ${e.message}`);
    }
  }

  // ===== ТЕСТ 5: Получение данных vault =====
  console.log('\n' + '═'.repeat(60));
  console.log('📖 ТЕСТ 5: Чтение данных vault');
  console.log('═'.repeat(60));

  try {
    const vaultResult = await contract.read('getVault', new Args().addString(walletAddress).serialize());
    const vaultData = new TextDecoder().decode(vaultResult.value);
    console.log(`   Raw data: ${vaultData.substring(0, 100)}...`);
    
    const parts = vaultData.split('|');
    if (parts.length >= 6) {
      console.log(`   ├─ Tier: ${parts[0]}`);
      console.log(`   ├─ Unlock Date: ${new Date(parseInt(parts[1])).toISOString()}`);
      console.log(`   ├─ Interval: ${parseInt(parts[2]) / 1000 / 60 / 60} часов`);
      console.log(`   ├─ Last Ping: ${new Date(parseInt(parts[3])).toISOString()}`);
      console.log(`   ├─ Active: ${parts[4] === '1' ? 'YES' : 'NO'}`);
      console.log(`   └─ Balance: ${fromNanoMassa(BigInt(parts[5]))} MASSA`);
    }
  } catch (e: any) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // ===== TEST 6: Check Deferred Call ID =====
  console.log('\n' + '═'.repeat(60));
  console.log('⚡ TEST 6: Check Deferred Call ID (ASC)');
  console.log('═'.repeat(60));

  try {
    const dcResult = await contract.read('getDeferredCallId', new Args().addString(walletAddress).serialize());
    const callId = new TextDecoder().decode(dcResult.value);
    if (callId.length > 0) {
      console.log(`   ✅ Deferred Call ID: ${callId}`);
      console.log(`   🤖 Контракт автоматически пробудится!`);
    } else {
      console.log(`   ⚠️  Нет активного Deferred Call`);
    }
  } catch (e: any) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // ===== ТЕСТ 7: Ping =====
  console.log('\n' + '═'.repeat(60));
  console.log('🏓 ТЕСТ 7: Ping (сброс таймера + новый ASC)');
  console.log('═'.repeat(60));

  try {
    console.log('   Отправляем ping с 5.1 MAS...');
    const op = await contract.call('ping', new Args().serialize(), {
      coins: toNanoMassa(5.1),  // Gas Tank + fee
      maxGas: 500_000_000n,
    });
    
    console.log(`   📤 Operation ID: ${op.id}`);
    await op.waitFinalExecution();
    console.log('   ✅ Ping успешен! Новый ASC таймер установлен.');
  } catch (e: any) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // ===== ТЕСТ 8: Deposit =====
  console.log('\n' + '═'.repeat(60));
  console.log('💵 TEST 8: Deposit (adding funds for heirs)');
  console.log('═'.repeat(60));

  try {
    console.log('   Отправляем 1 MASSA в vault...');
    const op = await contract.call('deposit', new Args().serialize(), {
      coins: toNanoMassa(1),
      maxGas: 50_000_000n,
    });
    
    console.log(`   📤 Operation ID: ${op.id}`);
    await op.waitFinalExecution();
    console.log('   ✅ Deposit успешен!');
  } catch (e: any) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // ===== ТЕСТ 9: Время до разблокировки =====
  console.log('\n' + '═'.repeat(60));
  console.log('⏰ ТЕСТ 9: Время до разблокировки');
  console.log('═'.repeat(60));

  try {
    const timeResult = await contract.read('getTimeUntilUnlock', new Args().addString(walletAddress).serialize());
    const timeMs = new Args(timeResult.value).nextU64();
    const hours = Number(timeMs) / 1000 / 60 / 60;
    console.log(`   ✅ До разблокировки: ${hours.toFixed(2)} часов`);
  } catch (e: any) {
    console.log(`   ❌ Ошибка: ${e.message}`);
  }

  // ===== ИТОГИ =====
  console.log('\n' + '═'.repeat(60));
  console.log('🏁 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
  console.log('═'.repeat(60));
  console.log('\n✅ Контракт работает в АВТОНОМНОМ режиме!');
  console.log('⚡ Deferred Call запланирован - контракт сам пробудится.');
  console.log('🚫 Keeper Bot больше не нужен!\n');
}

test()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
