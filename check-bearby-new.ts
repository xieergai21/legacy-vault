import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const NEW_CONTRACT = 'AS1n9QXbB8V3uQcphzQHxPLTZaRVMW3akofZgSMjtLv1eBTASdXE';
const BEARBY_ADDRESS = 'AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE';

async function main() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, NEW_CONTRACT);
  
  console.log('NEW Contract:', NEW_CONTRACT);
  console.log('Checking vault for Bearby:', BEARBY_ADDRESS);
  
  try {
    const vaultResult = await contract.read('getVault', new Args().addString(BEARBY_ADDRESS).serialize());
    const data = new TextDecoder().decode(vaultResult.value);
    console.log('\nRaw vault data:', data);
    
    const parts = data.split('|');
    console.log('Tier:', parts[0]);
    console.log('Active:', parts[4] === '1' ? 'YES' : 'NO');
    console.log('Balance:', Number(parts[5]) / 1e9, 'MAS');
  } catch (e: any) {
    console.log('No vault:', e.message);
  }
  
  // Total Revenue
  const revResult = await contract.read('getTotalRevenue', new Args().serialize());
  const revenue = new Args(revResult.value).nextU64();
  console.log('\nTotal Revenue:', Number(revenue) / 1e9, 'MAS');
}
main();
