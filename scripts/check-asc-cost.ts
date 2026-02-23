async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('Deferred call costs:\n');
  
  // Проверим стоимость для разных газов
  const gasAmounts = [10_000_000, 50_000_000, 100_000_000, 200_000_000];
  
  for (const gas of gasAmounts) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: currentPeriod + 5400, thread: 0 }, // 1 day
          max_gas_request: gas,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    const result = data.result?.[0];
    console.log(`Gas ${(gas/1_000_000).toFixed(0)}M: ${result?.price || 'N/A'} MAS`);
  }
}

main();
