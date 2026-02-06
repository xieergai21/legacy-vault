import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_CONTRACT = 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7';
const NEW_CONTRACT = 'AS1n9QXbB8V3uQcphzQHxPLTZaRVMW3akofZgSMjtLv1eBTASdXE';
const BEARBY_ADDRESS = 'AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE';

async function checkVault(contract: SmartContract, name: string) {
  try {
    const vaultResult = await contract.read('getVault', new Args().addString(BEARBY_ADDRESS).serialize());
    const data = new TextDecoder().decode(vaultResult.value);
    if (data && data.length > 5) {
      const parts = data.split('|');
      console.log(`${name}: Tier=${parts[0]}, Active=${parts[4]==='1'?'YES':'NO'}, Balance=${Number(parts[5])/1e9} MAS`);
    } else {
      console.log(`${name}: Empty vault`);
    }
  } catch {
    console.log(`${name}: No vault`);
  }
}

async function main() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  
  console.log('Checking Bearby:', BEARBY_ADDRESS);
  console.log('');
  
  await checkVault(new SmartContract(provider, OLD_CONTRACT), 'OLD contract');
  await checkVault(new SmartContract(provider, NEW_CONTRACT), 'NEW contract');
}
main();
