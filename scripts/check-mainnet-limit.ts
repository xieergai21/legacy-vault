async function main() {
  const statusRes = await fetch('https://mainnet.massa.net/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'get_status',
      params: []
    })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('MAINNET - Finding exact limit');
  console.log('Current period:', currentPeriod);
  
  const PERIOD_MS = 16000;
  
  for (const days of [7, 8, 9, 10, 11, 12, 13, 14]) {
    const periodsAhead = Math.floor((days * 86400 * 1000) / PERIOD_MS);
    const targetPeriod = currentPeriod + periodsAhead;
    
    const response = await fetch('https://mainnet.massa.net/api/v2', {
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
    console.log(`${days} days (${periodsAhead} periods): ${result?.available ? '✅' : '❌'}`);
  }
}

main();
