async function checkNetwork(name: string, url: string) {
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  const genesis = statusData.result.config.genesis_timestamp;
  
  console.log(`\n=== ${name.toUpperCase()} ===`);
  console.log('Genesis:', new Date(genesis).toISOString());
  console.log('Current period:', currentPeriod);
  console.log('Network age (days):', ((Date.now() - genesis) / 86400000).toFixed(1));
  
  // Бинарный поиск границы
  let low = 1000, high = 100000, lastGood = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: currentPeriod + mid, thread: 0 },
          max_gas_request: 100000000,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    if (data.result?.[0]?.available) {
      lastGood = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  console.log('Max available offset:', lastGood, 'periods');
  console.log('Max available time:', (lastGood * 16 / 86400).toFixed(2), 'days');
}

async function main() {
  await checkNetwork('buildnet', 'https://buildnet.massa.net/api/v2');
  await checkNetwork('mainnet', 'https://mainnet.massa.net/api/v2');
}

main();
