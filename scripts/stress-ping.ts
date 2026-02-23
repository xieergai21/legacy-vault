import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
dotenv.config();

const CONTRACT = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';

async function main() {
  const account = await Account.fromPrivateKey(process.env.OWNER_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, CONTRACT);
  
  for (let i = 1; i <= 5; i++) {
    console.log(`\nPing ${i}/5...`);
    try {
      const op = await contract.call('ping', new Args().serialize(), {
        coins: 100000000n, // 0.1 MAS
        maxGas: 200000000n,
      });
      await op.waitFinalExecution();
      console.log(`Ping ${i} done!`);
    } catch (e: any) {
      console.log(`Ping ${i} failed: ${e.message}`);
    }
    
    // Подожди 30 сек между ping
    if (i < 5) {
      console.log('Waiting 30 sec...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

main();
