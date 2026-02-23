async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('Testing different gas amounts for 10 days ahead...\n');
  
  const periodsAhead = 54000; // 10 days
  const targetPeriod = currentPeriod + periodsAhead;
  
  const gasAmounts = [1000000, 10000000, 50000000, 100000000, 500000000];
  
  for (const gas of gasAmounts) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: targetPeriod, thread: 0 },
          max_gas_request: gas,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    const result = data.result?.[0];
    console.log(`Gas ${gas.toLocaleString()}: ${result?.available ? '✅ ' + result.price + ' MAS' : '❌'}`);
  }
}

main();
