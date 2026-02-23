import * as dotenv from 'dotenv';
import { Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

dotenv.config();

const CONTRACT_ADDRESS = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';

async function main() {
  const provider = Web3Provider.buildnet();
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  // Твой адрес кошелька - замени на свой
  const walletAddress = process.argv[2];
  
  if (!walletAddress) {
    console.log('Usage: npx ts-node scripts/check-my-vault.ts <wallet_address>');
    return;
  }
  
  console.log('Checking vault for:', walletAddress);
  console.log('Contract:', CONTRACT_ADDRESS);
  
  try {
    const result = await contract.read('getVault', new Args().addString(walletAddress).serialize());
    const raw = new TextDecoder().decode(result.value);
    console.log('\nRaw vault data:');
    console.log(raw);
    
    const parts = raw.split('|');
    console.log('\nParsed:');
    console.log('  tier:', parts[0]);
    console.log('  unlockDate:', parts[1], '=', new Date(parseInt(parts[1])).toISOString());
    console.log('  interval:', parts[2]);
    console.log('  lastPing:', parts[3]);
    console.log('  isActive:', parts[4]);
    console.log('  balance:', parts[5], '=', (parseInt(parts[5]) / 1e9).toFixed(2), 'MAS');
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main();
