const { Web3Provider, SmartContract, Args } = require('@massalabs/massa-web3');

(async () => {
  console.log('Starting...');
  try {
    const provider = Web3Provider.buildnet();
    console.log('Provider created');
    
    const contract = new SmartContract(provider, 'AS1n9QXbB8V3uQcphzQHxPLTZaRVMW3akofZgSMjtLv1eBTASdXE');
    console.log('Contract created');
    
    const vaultResult = await contract.read('getVault', new Args().addString('AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE').serialize());
    console.log('Vault data:', new TextDecoder().decode(vaultResult.value) || '(empty)');
    
    const distResult = await contract.read('getDistributedInfo', new Args().addString('AU128hXjQ3dyfJchgGrQ37tsT7MfQVhcmdNMvc7ekEQ5anxPruVGE').serialize());
    console.log('Distributed info:', new TextDecoder().decode(distResult.value) || '(empty)');
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
})();
