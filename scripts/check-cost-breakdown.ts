async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  const statusRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const statusData = await statusRes.json();
  const currentPeriod = statusData.result.last_slot.period;
  
  console.log('Deferred call cost by time ahead:\n');
  
  // Проверим стоимость для разных периодов
  const daysAhead = [1, 2, 3, 4, 5, 6, 7];
  
  for (const days of daysAhead) {
    const periodsAhead = days * 5400;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deferred_call_quote',
        params: [[{
          target_slot: { period: currentPeriod + periodsAhead, thread: 0 },
          max_gas_request: 100_000_000,
          params_size: 100,
          arg: ""
        }]]
      })
    });
    const data = await response.json();
    const result = data.result?.[0];
    console.log(`${days}d ahead: ${result?.price || 'N/A'} MAS`);
  }
}

main();
