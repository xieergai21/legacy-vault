async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('Checking all 32 threads for 8 days ahead...\n');
  
  const periodsAhead = 43200; // 8 days
  const targetPeriod = currentPeriod + periodsAhead;
  
  let availableCount = 0;
  for (let thread = 0; thread < 32; thread++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: targetPeriod, thread: thread },
          max_gas_request: 100000000,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    const result = data.result?.[0];
    if (result?.available) {
      availableCount++;
      console.log(`Thread ${thread}: ✅ ${result.price} MAS`);
    }
  }
  console.log(`\nAvailable threads: ${availableCount}/32`);
}

main();
