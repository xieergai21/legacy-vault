#!/bin/bash

# Баланс контракта
BALANCE=$(curl -s "https://buildnet.massa.net/api/v2" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_addresses","params":[["AS128ULYRvbbKdTgfH8hYB5cEMD6u8UJ3wXSVdBibG8JsfCqCGAAw"]]}' \
  | python3 -c "import sys,json; print(float(json.load(sys.stdin)['result'][0]['final_balance']))")

# Резерв (минимум 10 MAS)
RESERVE=10

# Безопасный вывод (используем python)
SAFE=$(python3 -c "print(max(0, $BALANCE - $RESERVE))")

echo "================================"
echo "Contract balance: $BALANCE MAS"
echo "Reserve needed:   $RESERVE MAS"
echo "Safe to withdraw: $SAFE MAS"
echo "================================"

if python3 -c "exit(0 if $SAFE > 0 else 1)"; then
  echo "Run: npx ts-node scripts/admin-withdraw.ts $SAFE"
else
  echo "Not enough balance to withdraw"
fi
