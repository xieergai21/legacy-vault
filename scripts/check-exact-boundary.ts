async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  const genesisTimestamp = statusData.result.config.genesis_timestamp;
  
  console.log('Current period:', currentPeriod);
  console.log('Genesis timestamp:', new Date(genesisTimestamp).toISOString());
  console.log('Network age (days):', ((Date.now() - genesisTimestamp) / 86400000).toFixed(1));
  
  // Проверим какие периоды доступны
  console.log('\nChecking availability window...\n');
  
  // Найдём последний доступный период
  let lastAvailable = currentPeriod;
  for (let offset = 37800; offset <= 50000; offset += 1000) {
    const targetPeriod = currentPeriod + offset;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: targetPeriod, thread: 0 },
          max_gas_request: 100000000,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    const result = data.result?.[0];
    const days = (offset * 16 / 86400).toFixed(1);
    console.log(`+${offset} periods (~${days}d): ${result?.available ? '✅' : '❌'}`);
    if (result?.available) lastAvailable = targetPeriod;
  }
  
  console.log('\nLast available period:', lastAvailable);
  console.log('Max future offset:', lastAvailable - currentPeriod, 'periods');
  console.log('Max future days:', ((lastAvailable - currentPeriod) * 16 / 86400).toFixed(2));
}

main();
