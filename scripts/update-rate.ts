/**
 * LEGACY VAULT - UPDATE RATE SCRIPT
 * Updates MAS/USD rate in contract via CoinGecko API
 * Rate stored in MILLICENTS (1/1000 cent). Example: $0.00431 = 431 millicents
 * 
 * Usage:
 *   npx ts-node update-rate.ts          # Update rate
 *   npx ts-node update-rate.ts --check  # Only check current rate
 *   npx ts-node update-rate.ts --force 431 # Force set 431 millicents ($0.00431)
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
  contractAddress: process.env.CONTRACT_ADDRESS || 'AS17R9rZPJXzrP2CP63oPp2aog1tm8izkqdogHCXDCxYMqy1NMdn',
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
  
  console.log(`   💵 Current rate: $${price.toFixed(5)} per 1 MAS`);
  return price;
}

function usdToMillicents(usd: number): number {
  // Convert USD to millicents (1/1000 cent), matching contract storage format
  // Example: $0.00431 → 431 millicents
  return Math.round(usd * 100_000);
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

function showTierPrices(rate: bigint): void {
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
      const masPrice = (tier.usd * 100_000) / Number(rate);
      console.log(`   ${tier.name}: ${masPrice.toFixed(2)} MAS ($${tier.usd})`);
    }
  }
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

  const NETWORK = process.env.NETWORK || "buildnet";
  const provider = NETWORK === "mainnet" ? Web3Provider.mainnet(account) : Web3Provider.buildnet(account);
  console.log(`🌐 Network: ${NETWORK}`);
  const contract = new SmartContract(provider, config.contractAddress);

  // Get current rate from contract
  const currentRate = await getCurrentRate(contract);
  console.log(`\n📊 Current RATE in contract: ${currentRate} millicents ($${(Number(currentRate) / 100_000).toFixed(5)})`);

  // If check only - exit
  if (checkOnly) {
    console.log('\n💰 Tier prices at current rate:');
    showTierPrices(currentRate);
    
    // Get real rate for comparison
    try {
      const realPrice = await fetchMasPrice();
      const realMillicents = usdToMillicents(realPrice);
      console.log(`\n🌐 Real CoinGecko rate: ${realMillicents} millicents ($${realPrice.toFixed(5)})`);
      
      if (Number(currentRate) !== realMillicents) {
        console.log(`\n⚠️  MISMATCH! Contract: ${currentRate}, Real: ${realMillicents} millicents`);
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
  let newRateMillicents: number;
  
  if (forceRate !== null) {
    console.log(`\n🔧 Force setting rate: ${forceRate} millicents`);
    newRateMillicents = forceRate;
  } else {
    const masPrice = await fetchMasPrice();
    newRateMillicents = usdToMillicents(masPrice);
    console.log(`   📈 Rate in millicents: ${newRateMillicents}`);
  }

  // Check if update needed
  if (BigInt(newRateMillicents) === currentRate) {
    console.log('\n✅ Rate already current, no update needed.');
    return;
  }

  // Validation
  if (newRateMillicents <= 0 || newRateMillicents >= 100_000_000) {
    throw new Error(`❌ Invalid rate: ${newRateMillicents}. Must be 1-99999999 millicents.`);
  }

  console.log(`\n📝 Updating rate: ${currentRate} → ${newRateMillicents} millicents`);

  // Updating
  await updateRate(contract, BigInt(newRateMillicents), provider);

  // Checking result
  const updatedRate = await getCurrentRate(contract);
  console.log(`\n✅ New RATE in contract: ${updatedRate} millicents ($${(Number(updatedRate) / 100_000).toFixed(5)})`);

  // Showing new prices
  console.log('\n💰 Updated tier prices:');
  showTierPrices(updatedRate);

  console.log('\n🎉 Done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
