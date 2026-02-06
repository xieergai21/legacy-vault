import { SmartContract, Args, Web3Provider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS1Bhww1CuM3o837XrjoH3XA17CXfw7miK4y9MtMpbve1RVVfBeH';

async function main() {
  const provider = Web3Provider.buildnet();
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  const result = await contract.read('getTotalRevenue', new Args().serialize());
  const revenue = new Args(result.value).nextU64();
  console.log('Total Revenue:', Number(revenue) / 1_000_000_000, 'MAS');
}

main().catch(console.error);
