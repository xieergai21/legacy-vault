import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

dotenv.config();

const CONTRACT = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';

async function test(days: number) {
  const account = await Account.fromPrivateKey(process.env.HEIR3_PRIVATE_KEY!);
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, CONTRACT);
  
  console.log(`Testing ${days} days...`);
  
  const args = new Args()
    .addU8(0n).addU32(1n)
    .addString(account.address.toString())
    .addU64(BigInt(days * 86400000))
    .addString('test').addString('').addString('').addU64(0n);
  
  try {
    const op = await contract.call('createVault', args.serialize(), {
      coins: 8_000_000_000n,
      maxGas: 500_000_000n,
    });
    await op.waitFinalExecution();
    console.log(`${days} days: ✅ SUCCESS`);
    
    // Deactivate
    await (await contract.call('deactivateVault', new Args().serialize(), {maxGas: 500_000_000n})).waitFinalExecution();
    return true;
  } catch (e: any) {
    console.log(`${days} days: ❌ FAIL`);
    return false;
  }
}

async function main() {
  for (const d of [60, 90, 120, 180, 365]) {
    await test(d);
    await new Promise(r => setTimeout(r, 3000));
  }
}

main();
