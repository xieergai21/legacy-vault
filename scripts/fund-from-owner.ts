import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

dotenv.config();

const CONTRACT_ADDRESS = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';
const AMOUNT_MAS = 260;

async function main() {
  const privateKey = process.env.OWNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('OWNER_PRIVATE_KEY not found in .env');
  }
  
  const account = await Account.fromPrivateKey(privateKey);
  const provider = Web3Provider.buildnet(account);
  
  console.log('Owner wallet:', account.address.toString());
  console.log('Adding', AMOUNT_MAS, 'MAS to vault via deposit...');
  
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  const op = await contract.call('deposit', new Args().serialize(), {
    coins: BigInt(AMOUNT_MAS) * 1_000_000_000n,
    maxGas: 50_000_000n,
  });
  
  console.log('Operation:', op.id);
  console.log('Waiting for finalization...');
  await op.waitFinalExecution();
  console.log('Done!');
}

main().catch(console.error);
