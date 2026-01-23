/**
 * LEGACY VAULT DEPLOY SCRIPT
 * Massa SDK v5.3.0
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import {
  Account,
  Web3Provider,
  SmartContract,
  Args,
} from '@massalabs/massa-web3';

dotenv.config();

const config = {
  privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
  oracleAddress: process.env.ORACLE_ADDRESS || '',
  adminAddress: process.env.ADMIN_ADDRESS || '',
  wasmPath: process.env.WASM_PATH || './build/main.wasm',
};

function toNanoMassa(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

async function deploy(): Promise<void> {
  console.log('🚀 Начинаем деплой Legacy Vault...\n');

  if (!config.privateKey) {
    throw new Error('❌ DEPLOYER_PRIVATE_KEY не установлен в .env');
  }

  const account = await Account.fromPrivateKey(config.privateKey);
  const walletAddress = account.address.toString();
  console.log(`👛 Кошелек: ${walletAddress}`);

  const provider = Web3Provider.buildnet(account);
  console.log(`🌐 Сеть: Buildnet`);

  const wasmPath = path.resolve(config.wasmPath);
  console.log(`📄 WASM: ${wasmPath}`);
  
  let wasmBytes: Uint8Array;
  try {
    wasmBytes = new Uint8Array(readFileSync(wasmPath));
    console.log(`📦 Размер: ${(wasmBytes.length / 1024).toFixed(2)} KB`);
  } catch (e) {
    throw new Error(`❌ WASM файл не найден. Запустите 'npm run build'`);
  }

  const oracleAddress = config.oracleAddress || walletAddress;
  const adminAddress = config.adminAddress || walletAddress;
  
  console.log(`\n📋 Параметры:`);
  console.log(`   Oracle: ${oracleAddress}`);
  console.log(`   Admin:  ${adminAddress}`);

  // Сериализуем аргументы конструктора
  const constructorArgs = new Args()
    .addString(oracleAddress)
    .addString(adminAddress);

  console.log('\n⏳ Деплоим контракт...');
  console.log('   (это может занять 30-60 секунд)\n');

  try {
    const contract = await SmartContract.deploy(
      provider,
      wasmBytes,
      constructorArgs.serialize(),
      {
        coins: toNanoMassa(1),
        maxGas: 3_900_000_000n,
        fee: toNanoMassa(0.01),
      }
    );

    const contractAddress = contract.address.toString();
    
    console.log('═'.repeat(60));
    console.log('✅ КОНТРАКТ УСПЕШНО ЗАДЕПЛОЕН!');
    console.log('═'.repeat(60));
    console.log(`\n📍 Адрес контракта: ${contractAddress}\n`);
    console.log('═'.repeat(60));
    
    console.log('\n📝 Добавьте в .env:');
    console.log(`CONTRACT_ADDRESS=${contractAddress}`);
    
    console.log('\n⏳ Ожидаем финализации (15 сек)...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('\n🎉 Готово!');

  } catch (deployError: any) {
    console.error('❌ Ошибка:', deployError.message);
    throw deployError;
  }
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Деплой провалился:', error.message);
    process.exit(1);
  });
