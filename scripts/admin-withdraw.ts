import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
dotenv.config();

const CONTRACT = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';
const RPC = 'https://buildnet.massa.net/api/v2';

async function main() {
  const amt = parseFloat(process.argv[2] || '0');
  if (amt <= 0) { console.log('Usage: npx ts-node scripts/admin-withdraw.ts <MAS>'); return; }
  
  const account = await Account.fromEnv();
  const provider = Web3Provider.buildnet(account);
  const contract = new SmartContract(provider, CONTRACT);
  
  console.log('Withdrawing ' + amt + ' MAS...');
  const args = new Args().addU64(BigInt(Math.floor(amt * 1e9)));
  const op = await contract.call('adminWithdraw', args.serialize(), { coins: BigInt(0) });
  console.log('Operation:', op);
  console.log('Waiting...');
  await op.waitFinalExecution();
  console.log('Done!');
}
main().catch(console.error);
