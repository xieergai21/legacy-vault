import { JsonRpcPublicProvider } from '@massalabs/massa-web3';

async function main() {
  const provider = await JsonRpcPublicProvider.buildnet();
  
  const adminAddress = 'AU1ZVt29AjiG5tHiUTwcDoRQohasmFdqKEovnmbUYEVmBNJpKApJ';
  
  const addresses = await provider.getAddresses([adminAddress]);
  console.log('Admin balance:', Number(addresses[0].balance.final) / 1_000_000_000, 'MAS');
}

main().catch(console.error);
