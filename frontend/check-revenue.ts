import pkg from '@massalabs/massa-web3';
const { Args, Web3Provider } = pkg;

async function check() {
  const provider = Web3Provider.buildnet();
  const contract = new pkg.SmartContract(provider, 'AS12LpRSv6x3p1dVRnvqs7mHMm1eUziC3fxqLxbPVgoBq1myGNu3e');
  
  const revenue = await contract.read('getTotalRevenue', new Uint8Array());
  const aumFees = await contract.read('getTotalAumFees', new Uint8Array());
  
  const revenueVal = new pkg.Args(revenue.value).nextU64();
  const aumVal = new pkg.Args(aumFees.value).nextU64();
  
  console.log('Protocol Revenue:', Number(revenueVal) / 1e9, 'MAS');
  console.log('AUM Fees collected:', Number(aumVal) / 1e9, 'MAS');
}
check().catch(console.error);
