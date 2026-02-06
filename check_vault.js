const { Web3Provider, Args } = require('@massalabs/massa-web3');

async function main() {
  const provider = Web3Provider.buildnet();
  const address = 'AU1ZVt29AjiG5tHiUTwcDoRQohasmFdqKEovnmbUYEVmBNJpKApJ';
  const contract = 'AS12v6bTHRSLctNN3qxfcEPfpBkCk8VPs2QVp9FrHQYbMj1KBSQGb';
  
  try {
    const result = await provider.readSC({
      target: contract,
      function: 'hasVault',
      parameter: new Args().addString(address).serialize(),
    });
    console.log('Has vault:', result);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
