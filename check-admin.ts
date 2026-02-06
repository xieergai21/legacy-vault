import { SmartContract, Args, Web3Provider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS1Bhww1CuM3o837XrjoH3XA17CXfw7miK4y9MtMpbve1RVVfBeH';

async function main() {
  const provider = Web3Provider.buildnet();
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  // Read admin from storage
  const result = await provider.readStorage(CONTRACT_ADDRESS, ['ADMIN']);
  console.log('Admin address:', result);
}

main().catch(console.error);
