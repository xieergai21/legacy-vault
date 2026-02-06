import { Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';

async function main() {
  const provider = Web3Provider.buildnet();
  const address = 'AU1ZVt29AjiG5tHiUTwcDoRQohasmFdqKEovnmbUYEVmBNJpKApJ';
  const contractAddr = 'AS12v6bTHRSLctNN3qxfcEPfpBkCk8VPs2QVp9FrHQYbMj1KBSQGb';
  
  try {
    const contract = new SmartContract(provider, contractAddr);
    const result = await contract.read('hasVault', new Args().addString(address).serialize());
    const value = new Args(result.value).nextU64();
    console.log('Has vault:', value === 1n ? 'YES' : 'NO');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
