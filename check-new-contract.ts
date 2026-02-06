import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, 'AS1n9QXbB8V3uQcphzQHxPLTZaRVMW3akofZgSMjtLv1eBTASdXE');
  
  console.log('Wallet:', account.address.toString());
  
  // Проверяем rate
  const rateResult = await contract.read('getRate', new Args().serialize());
  const rate = new Args(rateResult.value).nextU64();
  console.log('RATE:', rate.toString(), 'cents ($' + (Number(rate) / 100) + ')');
  
  // Проверяем vault
  const addr = account.address.toString();
  try {
    const vaultResult = await contract.read('getVault', new Args().addString(addr).serialize());
    const data = new TextDecoder().decode(vaultResult.value);
    console.log('\nVault raw:', data);
    const parts = data.split('|');
    console.log('Tier:', parts[0]);
    console.log('Balance for heirs:', Number(parts[5]) / 1e9, 'MAS');
  } catch {
    console.log('No vault');
  }
  
  // Проверяем total revenue
  const revResult = await contract.read('getTotalRevenue', new Args().serialize());
  const revenue = new Args(revResult.value).nextU64();
  console.log('\nTotal Revenue:', Number(revenue) / 1e9, 'MAS');
}
check();
