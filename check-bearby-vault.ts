import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_CONTRACT = 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7';
const BEARBY_ADDRESS = 'AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE';

async function main() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, OLD_CONTRACT);
  
  console.log('Checking vault for:', BEARBY_ADDRESS);
  
  const vaultResult = await contract.read('getVault', new Args().addString(BEARBY_ADDRESS).serialize());
  const data = new TextDecoder().decode(vaultResult.value);
  console.log('\nRaw vault data:', data);
  
  const parts = data.split('|');
  console.log('\nParsed:');
  console.log('Tier:', parts[0]);
  console.log('Active:', parts[4] === '1' ? 'YES' : 'NO');
  console.log('Balance:', Number(parts[5]) / 1e9, 'MAS');
  console.log('Heirs:', parts[6]);
}
main();
