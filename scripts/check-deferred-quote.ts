async function main() {
  const statusRes = await fetch('https://buildnet.massa.net/api/v2', {
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
  
  console.log('Current period:', currentPeriod);
  console.log('\nFinding max limit...\n');
  
  const PERIOD_MS = 16000;
  
  for (const days of [7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 30]) {
    const periodsAhead = Math.floor((days * 86400 * 1000) / PERIOD_MS);
    const targetPeriod = currentPeriod + periodsAhead;
    
    const response = await fetch('https://buildnet.massa.net/api/v2', {
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
    const result = data.result[0];
    console.log(`${days} days: ${result.available ? '✅ ' + result.price + ' MAS' : '❌'}`);
  }
}

main();
