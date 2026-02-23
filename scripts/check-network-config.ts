async function main() {
  const url = 'https://mainnet.massa.net/api/v2';
  
  // Получим полный статус
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_status', params: [] })
  });
  const data = await response.json();
  
  console.log('Full network config:\n');
  console.log(JSON.stringify(data.result.config, null, 2));
  
  // Расчёт
  const t0 = data.result.config.t0;
  console.log('\n--- Calculations ---');
  console.log('Slot duration (t0):', t0, 'ms');
  console.log('Slots per day:', 86400000 / t0);
  console.log('7 days in slots:', 7 * 86400000 / t0);
  
  // Проверим что 37800 = 7 * 5400
  console.log('\n37800 / 5400 =', 37800 / 5400, 'days');
}

main();
