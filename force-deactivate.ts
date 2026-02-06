import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS1Bhww1CuM3o837XrjoH3XA17CXfw7miK4y9MtMpbve1RVVfBeH';
const SECRET_KEY = 'S1GMAGaH9BjsLkN77KR27FmkhUExBuLgotxiZf9tmumecQsABBG';

async function main() {
  const account = await Account.fromPrivateKey(SECRET_KEY);
  const provider = await Web3Provider.fromRPCUrl('https://buildnet.massa.net/api/v2', account);
  
  console.log('Address:', provider.address.toString());
  
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  console.log('Calling deactivateVault...');
  const op = await contract.call('deactivateVault', new Args().serialize(), {
    maxGas: 500_000_000n,
  });
  
  console.log('Operation ID:', op.id);
  console.log('Waiting for finalization...');
  await op.waitFinalExecution();
  console.log('Done!');
  
  // Check result
  const result = await contract.read('getVault', new Args().addString(provider.address.toString()).serialize());
  const raw = new TextDecoder().decode(result.value);
  const parts = raw.split('|');
  console.log('isActive now:', parts[4]);
  console.log('balance now:', Number(parts[5]) / 1_000_000_000, 'MAS');
}

main().catch(console.error);
