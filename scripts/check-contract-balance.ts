import { Web3Provider } from '@massalabs/massa-web3';

const CONTRACT_ADDRESS = 'AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw';

async function main() {
  const provider = Web3Provider.buildnet();
  
  try {
    const addresses = await provider.getAddressesInfo([CONTRACT_ADDRESS]);
    console.log('Contract address:', CONTRACT_ADDRESS);
    console.log('Address info:', JSON.stringify(addresses, null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main();
