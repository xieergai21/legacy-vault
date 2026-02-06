# Legacy Vault

Decentralized Digital Inheritance on Massa Blockchain

Legacy Vault is an autonomous dead man's switch protocol. Using Massa's Autonomous Smart Contracts (ASC), assets are automatically transferred to designated heirs if the owner fails to check in.

> Beta on Massa Buildnet

## Deployed Addresses

| Network | Address |
|---------|---------|
| Buildnet | AS12gd8bNux6qsrMKVn4xR43W1HKMDNpAyjsJFL6ULgitvL3QDKvn |

## Core Functions

- createVault() - Create vault with MAS payment
- ping() - Check-in to reset timer
- deposit() - Add funds to vault
- deactivateVault() - Close vault and withdraw
- claimInheritance() - Heir claims after unlock
- triggerDistribution() - ASC auto-distribution callback

## Gas Model

Dynamic gas based on check-in interval. Safety multiplier x1.3.
Minimum floor: 1.0 MAS/call + 2 MAS buffer.
Excess stays on contract, admin withdraws via adminWithdrawGasExcess().

| Interval | Calls | Gas Fee |
|----------|-------|---------|
| 1 day | 1 | 5.48 MAS |
| 7 days | 2 | 7.06 MAS |
| 30 days | 5 | 11.78 MAS |
| 90 days | 15 | 27.50 MAS |
| 1 year | 61 | 99.86 MAS |

## Development

npm install
npm run build
npx ts-node scripts/deploy.ts

## Links

- App: https://app.legacy-vault.xyz
- Telegram: https://t.me/legacyvault
- Twitter: https://twitter.com/legacyvault_xyz

## License

MIT
