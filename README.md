# Legacy Vault 🔐

**Decentralized Digital Inheritance on Massa Blockchain**

Legacy Vault is an autonomous dead man's switch protocol for secure cryptocurrency and digital asset inheritance. Using Massa's unique Autonomous Smart Contracts (ASC), your assets are automatically transferred to designated heirs if you fail to check in within a specified interval — no intermediaries, no trust required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Massa Network](https://img.shields.io/badge/Network-Massa-blue)](https://massa.net)
[![Contract Version](https://img.shields.io/badge/Contract-v3.1-green)]()
[![App](https://img.shields.io/badge/App-Live-brightgreen)](https://app.legacy-vault.xyz)

> ⚠️ **Beta on Massa Buildnet** — Do not use with significant funds until mainnet release.

---

## The Problem

Every year, billions of dollars in cryptocurrency become permanently inaccessible:

- **No succession planning** — Private keys die with their owners
- **Centralized solutions fail** — Exchanges freeze accounts, lose keys, or shut down
- **Legal complexity** — Probate takes months, courts don't understand crypto
- **Trust requirements** — Existing solutions require trusting third parties

**Legacy Vault solves this with trustless, autonomous on-chain execution.**

---

## How It Works
```
┌─────────────────────────────────────────────────────────────┐
│                      LEGACY VAULT                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Owner creates vault with heirs and check-in interval   │
│                           │                                 │
│                           ▼                                 │
│   ┌─────────────┐    Ping every    ┌─────────────┐         │
│   │   ACTIVE    │◄────────────────►│   OWNER     │         │
│   │   VAULT     │    N days        │   ALIVE     │         │
│   └─────────────┘                  └─────────────┘         │
│           │                                                 │
│           │ No ping received                                │
│           ▼                                                 │
│   ┌─────────────┐                  ┌─────────────┐         │
│   │  UNLOCKED   │─────────────────►│   HEIRS     │         │
│   │   STATE     │  Auto-transfer   │   RECEIVE   │         │
│   └─────────────┘                  └─────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step by Step

1. **Create Vault** — Choose tier, set check-in interval (1-365 days), add heir addresses
2. **Fund Vault** — Deposit MAS tokens for inheritance
3. **Upload Files** (PRO/LEGATE) — Encrypted files stored permanently on Arweave
4. **Regular Pings** — Confirm you're alive with a simple transaction
5. **Automatic Inheritance** — If you miss the deadline, heirs can claim assets

---

## Subscription Plans

| Feature | FREE | LIGHT | VAULT PRO | LEGATE |
|---------|------|-------|-----------|--------|
| **Annual Price** | $0 | $9.99 | $29.99 | $89.99 |
| **AUM Fee** | 0% | 1% | 0.5% | 0.25% |
| **Max Heirs** | 1 | 3 | 10 | Unlimited |
| **Max Balance** | 10K MAS | 200K MAS | 2M MAS | Unlimited |
| **Message Storage** | 25 chars | 1 KB | 2 KB | 2 KB |
| **File Storage** | — | — | 50 MB | 1 GB |
| **AES-256 Encryption** | ✓ | ✓ | ✓ | ✓ |
| **Email Alerts** | — | ✓ | ✓ | ✓ |

### Payment Options

- **MAS** — Native Massa token (price calculated via oracle)
- **USDC.e** — Bridged USDC stablecoin on Massa

---

## Key Features

### Autonomous Smart Contracts (ASC)
Unlike traditional smart contracts that require external triggers, Massa's ASC technology enables truly autonomous execution. Your vault automatically unlocks when the timer expires — no keepers, no bots, no third parties.

### Client-Side Encryption
All sensitive data is encrypted in your browser using AES-256 before being stored. Encryption keys never leave your device. Only you and your designated heirs can decrypt the contents.

### Permanent File Storage
Files are stored on Arweave — a decentralized permanent storage network. Once uploaded, files exist forever and cannot be deleted or censored.

### Subscription Model with AUM Fees
Annual subscriptions keep the protocol sustainable. A small AUM (Assets Under Management) fee is collected proportionally from vault balances during ping operations.

---

## Smart Contract

### Deployed Addresses

| Network | Address | Status |
|---------|---------|--------|
| Buildnet | `AS1qj32F95nHt93svdvt94AXFeXdV5GfEMcwXmCoN3ALkaEvMQN8` | Active |
| Mainnet | Coming soon | — |

### Core Functions

**Vault Management**
- `createVault()` — Create vault with MAS payment
- `createVaultWithUsdc()` — Create vault with USDC payment
- `ping()` — Check-in to reset timer
- `deposit()` — Add funds to vault
- `deactivateVault()` — Close vault and withdraw funds

**Subscription**
- `renewSubscription()` — Renew with MAS
- `renewSubscriptionWithUsdc()` — Renew with USDC

**Inheritance**
- `claimInheritance()` — Heir claims after unlock
- `claimInheritanceWithUsdc()` — Heir pays expired subscription with USDC

**Read Functions**
- `getVault()` — Get vault data
- `getVaultsAsHeir()` — Get vaults where address is heir
- `getTierPrice()` — Get subscription price
- `getSubscriptionPriceUsdc()` — Get USDC price

---

## Security Model

### Trust Assumptions

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| Smart Contract | Trustless | Open source, verifiable on-chain |
| File Encryption | Zero-knowledge | AES-256 client-side, keys never transmitted |
| File Storage | Decentralized | Arweave permanent storage |
| Timer Execution | Autonomous | Massa ASC, no external dependencies |
| Price Feed | Real-time | CoinGecko API for MAS/USD conversion |

### What Legacy Vault Cannot Do

- Access your private keys
- Decrypt your files
- Stop or pause your vault
- Redirect your inheritance
- Recover lost encryption keys

### Heir Security

Heirs are identified by their Massa wallet address. To claim inheritance:
1. Vault must be unlocked (owner missed check-in)
2. Heir must sign transaction with their wallet
3. If subscription expired, heir can pay to unlock

No one except designated heirs can claim — enforced by smart contract.

---

## Technical Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                   React + TypeScript                        │
│                  Hosted on Cloudflare                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   MASSA BLOCKCHAIN                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Legacy Vault Contract                   │   │
│  │  - Vault storage and management                      │   │
│  │  - ASC deferred calls for auto-unlock               │   │
│  │  - USDC integration via transferFrom                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     ARWEAVE                                 │
│              Permanent encrypted file storage               │
└─────────────────────────────────────────────────────────────┘
```

---

## Links

| Resource | URL |
|----------|-----|
| Web App | https://app.legacy-vault.xyz |
| Landing Page | https://legacy-vault.xyz |
| Twitter | https://twitter.com/legacyvault_xyz |
| Telegram | https://t.me/legacyvault |
| Email | key@legacy-vault.xyz |

---

## Development
```bash
# Clone repository
git clone https://github.com/xieergai21/legacy-vault.git
cd legacy-vault

# Install dependencies
npm install

# Build contract
npm run build

# Deploy to buildnet
npx ts-node scripts/deploy.ts
```

---

## License

MIT License — see [LICENSE](LICENSE) file.

---

**Built with ❤️ on Massa Blockchain**
