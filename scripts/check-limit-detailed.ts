async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('MAINNET - Exact boundary');
  console.log('Current period:', currentPeriod);
  
  for (const periodsAhead of [37800, 37850, 37900, 37950, 38000]) {
    const targetPeriod = currentPeriod + periodsAhead;
    
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
    const hours = (periodsAhead * 16 / 3600).toFixed(1);
    console.log(`+${periodsAhead} periods (~${hours}h): ${result?.available ? '✅' : '❌'}`);
  }
}

main();
