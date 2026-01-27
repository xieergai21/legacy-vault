# Legacy Vault 🔐

> ⚠️ **Development Status: Beta on Massa Buildnet**
> 
> Smart contracts deployed on Massa Buildnet. **Do NOT use with significant funds** until mainnet release.

**Decentralized Inheritance Management on Massa Blockchain**

Legacy Vault is a trustless dead man's switch protocol that enables autonomous asset transfer and encrypted file inheritance.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Massa Network](https://img.shields.io/badge/Massa-Buildnet-blue)](https://massa.net)
[![Contract](https://img.shields.io/badge/Contract-v3.1-green)]()

---

## What's New in v3.1

- **Annual Subscription Model** — Pay yearly instead of one-time
- **AUM Fees** — Small percentage fee on vault balance (0.25-1% annually)
- **USDC Payment Support** — Pay subscriptions in USDC.e stablecoin
- **Vault Freeze** — Expired subscriptions freeze vault until renewed
- **Tier-based Limits** — Message and file storage limits per plan

---

## How It Works

1. **Create Vault** — Select tier, define heirs, set check-in interval
2. **Deposit Assets** — Add MAS tokens and encrypted files
3. **Regular Check-ins** — Confirm you're alive (ping transaction)
4. **Automatic Execution** — If check-in missed, heirs claim inheritance

The protocol uses Massa's **Autonomous Smart Contracts** (ASC) to execute without external triggers.

---

## Pricing

| Feature | FREE | LIGHT | VAULT PRO | LEGATE |
|---------|------|-------|-----------|--------|
| **Annual Price** | $0 | $9.99/year | $29.99/year | $89.99/year |
| **AUM Fee** | 0% | 1% | 0.5% | 0.25% |
| **Heirs** | 1 | Up to 3 | Up to 10 | Unlimited |
| **Message** | 25 chars | 1 KB | 2 KB | 2 KB |
| **File Storage** | — | — | 50 MB | 1 GB |
| **Email Alerts** | — | ✓ | ✓ | ✓ |
| **AES-256 Encryption** | ✓ | ✓ | ✓ | ✓ |

---

## Smart Contract

**Buildnet Address:** `AS1qj32F95nHt93svdvt94AXFeXdV5GfEMcwXmCoN3ALkaEvMQN8`

### Key Functions
```typescript
// Create vault with MAS payment
createVault(tier, heirs, interval, payload, arweaveId, encKey)

// Create vault with USDC payment
createVaultWithUsdc(tier, heirs, interval, payload, arweaveId, encKey)

// Owner check-in (resets timer)
ping()

// Renew subscription (MAS or USDC)
renewSubscription()
renewSubscriptionWithUsdc()

// Heir claims inheritance
claimInheritance(ownerAddress)
claimInheritanceWithUsdc(ownerAddress)

// Deactivate and withdraw
deactivateVault()
```

---

## Security Model

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| Smart Contract | Trustless | Open source, verifiable on-chain |
| File Encryption | Client-side | AES-256, keys never leave device |
| File Storage | Decentralized | Arweave permanent storage |
| Check-in Logic | Autonomous | Massa ASC, no server needed |

### What We Don't Have Access To

- Your private keys
- Your decryption keys
- Ability to pause/stop your vault
- Ability to redirect inheritance

---

## Links

- **App:** https://app.legacy-vault.xyz
- **Landing:** https://legacy-vault.xyz
- **Twitter:** https://twitter.com/legacyvault_xyz
- **Telegram:** https://t.me/legacyvault
- **Email:** key@legacy-vault.xyz

---

## License

MIT License - see [LICENSE](LICENSE) file.
