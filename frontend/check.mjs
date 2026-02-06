import { Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

async function main() {
  console.log('Starting...');
  const provider = Web3Provider.buildnet();
  console.log('Provider created');
  
  const contract = new SmartContract(provider, 'AS1n9QXbB8V3uQcphzQHxPLTZaRVMW3akofZgSMjtLv1eBTASdXE');
  console.log('Contract created');
  
  try {
    const vaultResult = await contract.read('getVault', new Args().addString('AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE').serialize());
    console.log('Vault data:', new TextDecoder().decode(vaultResult.value) || '(empty)');
  } catch(e) {
    console.log('Vault error:', e.message);
  }
  
  try {
    const distResult = await contract.read('getDistributedInfo', new Args().addString('AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE').serialize());
    console.log('Distributed info:', new TextDecoder().decode(distResult.value) || '(empty)');
  } catch(e) {
    console.log('Dist error:', e.message);
  }
}

main().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
