import { Web3Provider, SmartContract, Args, Account } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
  const account = await Account.fromPrivateKey(process.env.DEPLOYER_PRIVATE_KEY || '');
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, 'AS12YoBhrc5GHbun7GXyDF6m4oGf5ihUymCZ1Mz7xa6o4frUQoJah');
  
  console.log('Checking vault for:', account.address.toString());
  
  try {
    const result = await contract.read('hasVault', new Args().addString(account.address.toString()).serialize());
    const has = new Args(result.value).nextU64();
    console.log('Has vault:', has === 1n);
    
    if (has === 1n) {
      const vaultResult = await contract.read('getVault', new Args().addString(account.address.toString()).serialize());
      const raw = new TextDecoder().decode(vaultResult.value);
      console.log('Vault data:', raw);
    }
  } catch (err) {
    console.log('No vault or error');
  }
}
check();
