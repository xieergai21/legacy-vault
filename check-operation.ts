import { Web3Provider } from '@massalabs/massa-web3';

async function main() {
  const provider = Web3Provider.buildnet();
  
  const opId = 'O1o379ZGy2AUTaZMhVFxJJD8PmrX7vs8fGjsxY2S625wBLXrsNK';
  
  try {
    const status = await provider.getOperationStatus(opId);
    console.log('Status:', status);
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
