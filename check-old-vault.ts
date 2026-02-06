import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_CONTRACT = 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7';

async function main() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, OLD_CONTRACT);
  
  console.log('Wallet:', account.address.toString());
  
  const vaultResult = await contract.read('getVault', new Args().addString(account.address.toString()).serialize());
  const data = new TextDecoder().decode(vaultResult.value);
  console.log('\nRaw vault data:', data);
  
  const parts = data.split('|');
  console.log('\nParsed:');
  console.log('0 - Tier:', parts[0]);
  console.log('1 - UnlockDate:', parts[1]);
  console.log('2 - Interval:', parts[2]);
  console.log('3 - LastPing:', parts[3]);
  console.log('4 - Active:', parts[4]);
  console.log('5 - Balance:', parts[5]);
  console.log('6 - Heirs:', parts[6]);
}
main();
