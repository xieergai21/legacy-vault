import { SmartContract, Args, Web3Provider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS1Bhww1CuM3o837XrjoH3XA17CXfw7miK4y9MtMpbve1RVVfBeH';

async function main() {
  const provider = Web3Provider.buildnet();
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  
  const ownerAddress = 'AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE';
  
  try {
    const result = await contract.read('getVault', new Args().addString(ownerAddress).serialize());
    const raw = new TextDecoder().decode(result.value);
    console.log('Vault data:', raw);
    
    const parts = raw.split('|');
    console.log('isActive:', parts[4]);
    console.log('balance:', Number(parts[5]) / 1_000_000_000, 'MAS');
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
