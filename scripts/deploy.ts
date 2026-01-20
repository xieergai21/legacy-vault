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
  console.log('🚀 Starting Legacy Vault deployment...\n');

  if (!config.privateKey) {
    throw new Error('❌ DEPLOYER_PRIVATE_KEY is not set in .env');
  }

  const account = await Account.fromPrivateKey(config.privateKey);
  const walletAddress = account.address.toString();
  console.log(`👛 Wallet: ${walletAddress}`);

  const provider = Web3Provider.buildnet(account);
  console.log(`🌐 Network: Buildnet`);

  const wasmPath = path.resolve(config.wasmPath);
  console.log(`📄 WASM: ${wasmPath}`);
  
  let wasmBytes: Uint8Array;
  try {
    wasmBytes = new Uint8Array(readFileSync(wasmPath));
    console.log(`📦 Size: ${(wasmBytes.length / 1024).toFixed(2)} KB`);
  } catch (e) {
    throw new Error(`❌ WASM file not found. Run 'npm run build' first`);
  }

  const oracleAddress = config.oracleAddress || walletAddress;
  const adminAddress = config.adminAddress || walletAddress;
  
  console.log(`\n📋 Parameters:`);
  console.log(`   Oracle: ${oracleAddress}`);
  console.log(`   Admin:  ${adminAddress}`);

  // Serialize constructor arguments
  const constructorArgs = new Args()
    .addString(oracleAddress)
    .addString(adminAddress);

  console.log('\n⏳ Deploying contract...');
  console.log('   (this may take 30-60 seconds)\n');

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
    console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log(`\n📍 Contract address: ${contractAddress}\n`);
    console.log('═'.repeat(60));
    
    console.log('\n📝 Add to .env:');
    console.log(`CONTRACT_ADDRESS=${contractAddress}`);
    
    console.log('\n⏳ Waiting for finalization (15 sec)...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('\n🎉 Done!');

  } catch (deployError: any) {
    console.error('❌ Error:', deployError.message);
    throw deployError;
  }
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  });
