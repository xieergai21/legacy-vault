import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

dotenv.config();

const CONTRACT_ADDRESS = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  
  const account = await Account.fromPrivateKey(privateKey);
  const provider = Web3Provider.buildnet(account);
  
  console.log('Admin wallet:', account.address.toString());
  console.log('Creating vault with 300 MAS...');
  
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  const args = new Args()
    .addU8(0n)
    .addU32(1n)
    .addString('AU1TF8r9i3SEDXT946AURBTk7D49UPXoVCN1a29DwW2TeQiXRhC7')
    .addU64(86400000n)  // 1 day only
    .addString('admin-fund')
    .addString('')
    .addString('')
    .addU64(0n);
  
  const op = await contract.call('createVault', args.serialize(), {
    coins: 300_000_000_000n,
    maxGas: 500_000_000n,
  });
  
  console.log('Operation:', op.id);
  console.log('Waiting...');
  await op.waitFinalExecution();
  console.log('Done!');
}

main().catch(console.error);
