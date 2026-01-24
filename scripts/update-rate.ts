/**
 * LEGACY VAULT - UPDATE RATE SCRIPT
 * Updates MAS/USD rate in contract via CoinGecko API
 * 
 * Usage:
 *   npx ts-node update-rate.ts          # Update rate
 *   npx ts-node update-rate.ts --check  # Only check current rate
 *   npx ts-node update-rate.ts --force 5 # Force set 5 cents
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
  // Oracle private key (must match ORACLE_ADDRESS from deploy)
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '',
  contractAddress: process.env.CONTRACT_ADDRESS || 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7',
};

function toNanoMassa(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

async function fetchMasPrice(): Promise<number> {
  console.log('📡 Getting MAS/USD rate from CoinGecko...');
  
  const response = await fetch(COINGECKO_API);
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  const price = data?.massa?.usd;
  
  if (!price || typeof price !== 'number') {
    throw new Error('Invalid price data from CoinGecko');
  }
  
  console.log(`   💵 Current rate: $${price.toFixed(4)} per 1 MAS`);
  return price;
}

function usdToCents(usd: number): number {
  // Convert USD to cents, rounding to integer
  // Example: $0.0512 = 5.12 cents → 5 cents
  return Math.round(usd * 100);
}

async function getCurrentRate(contract: SmartContract): Promise<bigint> {
  const result = await contract.read('getRate', new Args().serialize());
  return new Args(result.value).nextU64();
}

async function updateRate(contract: SmartContract, newRate: bigint, provider: Web3Provider): Promise<void> {
  console.log(`\n⏳ Sending updateRate(${newRate}) to contract...`);
  
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
  console.log('   ⏳ Waiting for confirmation...');
  
  await op.waitFinalExecution();
  console.log('   ✅ Rate updated successfully!');
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
    throw new Error('❌ ORACLE_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY not set in .env');
  }

  // Connecting to network
  const account = await Account.fromPrivateKey(config.oraclePrivateKey);
  const oracleAddress = account.address.toString();
  console.log(`\n👛 Oracle wallet: ${oracleAddress}`);
  console.log(`📄 Contract: ${config.contractAddress}`);

  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, config.contractAddress);

  // Get current rate from contract
  const currentRate = await getCurrentRate(contract);
  console.log(`\n📊 Current RATE in contract: ${currentRate} cents ($${Number(currentRate) / 100})`);

  // If check only - exit
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
      console.log(`\n🌐 Real CoinGecko rate: ${realCents} cents ($${realPrice.toFixed(4)})`);
      
      if (Number(currentRate) !== realCents) {
        console.log(`\n⚠️  MISMATCH! Contract: ${currentRate}¢, Real: ${realCents}¢`);
        console.log(`   Run: npx ts-node update-rate.ts`);
      } else {
        console.log(`\n✅ Rate is current!`);
      }
    } catch (e: any) {
      console.log(`\n⚠️  Failed to get rate from CoinGecko: ${e.message}`);
    }
    
    return;
  }

  // Determine new rate
  let newRateCents: number;
  
  if (forceRate !== null) {
    // Force update
    console.log(`\n🔧 Force setting rate: ${forceRate} cents`);
    newRateCents = forceRate;
  } else {
    // Get from CoinGecko
    const masPrice = await fetchMasPrice();
    newRateCents = usdToCents(masPrice);
    console.log(`   📈 Rate in cents: ${newRateCents}¢`);
  }

  // Check if update needed
  if (BigInt(newRateCents) === currentRate) {
    console.log('\n✅ Rate already current, no update needed.');
    return;
  }

  // Validation
  if (newRateCents <= 0 || newRateCents >= 1000000) {
    throw new Error(`❌ Invalid rate: ${newRateCents}. Must be 1-999999 cents.`);
  }

  console.log(`\n📝 Updating rate: ${currentRate}¢ → ${newRateCents}¢`);

  // Updating
  await updateRate(contract, BigInt(newRateCents), provider);

  // Checking result
  const updatedRate = await getCurrentRate(contract);
  console.log(`\n✅ New RATE in contract: ${updatedRate} cents ($${Number(updatedRate) / 100})`);

  // Showing new prices
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

  console.log('\n🎉 Done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
