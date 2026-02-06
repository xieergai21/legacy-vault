import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

const OLD_CONTRACT = 'AS1D5fSHU83ktyGLeb5X143JeFgEqS9M1VAqsajb42vYbkg1Cfo7';

async function main() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, OLD_CONTRACT);
  
  console.log('Wallet:', account.address.toString());
  console.log('Old contract:', OLD_CONTRACT);
  
  // Проверим vault
  try {
    const vaultResult = await contract.read('getVault', new Args().addString(account.address.toString()).serialize());
    const data = new TextDecoder().decode(vaultResult.value);
    const parts = data.split('|');
    console.log('\nVault found!');
    console.log('Balance:', Number(parts[5]) / 1e9, 'MAS');
    console.log('Active:', parts[4] === '1' ? 'YES' : 'NO');
    
    if (parts[4] === '1') {
      console.log('\nDeactivating vault to return funds...');
      const op = await contract.call('deactivateVault', new Args().serialize(), {
        maxGas: 500_000_000n,
      });
      console.log('Operation:', op.id);
      await op.waitFinalExecution();
      console.log('✅ Vault deactivated! Funds returned to your wallet.');
    }
  } catch (e: any) {
    console.log('No vault or error:', e.message);
  }
}
main();
