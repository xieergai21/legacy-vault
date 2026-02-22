# Legacy Vault 🔐

**Decentralized Digital Inheritance on Massa Blockchain**

Legacy Vault is an autonomous dead man's switch protocol for secure cryptocurrency and digital asset inheritance. Using Massa's unique Autonomous Smart Contracts (ASC), your assets are automatically transferred to designated heirs if you fail to check in within a specified interval — no intermediaries, no trust required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Massa Network](https://img.shields.io/badge/Network-Massa-blue)](https://massa.net)
[![Contract Version](https://img.shields.io/badge/Contract-v5.0-green)]()
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
4. **Set File Password** — Password-protect encrypted files (shared with heirs offline)
5. **Regular Pings** — Confirm you're alive with a simple transaction
6. **Automatic Inheritance** — If you miss the deadline, heirs can claim assets

---

## Subscription Plans

| Feature | FREE | LIGHT | VAULT PRO | LEGATE |
|---------|------|-------|-----------|--------|
| **Annual Price** | $0 | $9.99 | $29.99 | $89.99 |
| **AUM Fee** | 0% | 2% | 1% | 0.5% |
| **Max Heirs** | 1 | 3 | 10 | Unlimited |
| **Max Balance** | 10K MAS | 200K MAS | 2M MAS | Unlimited |
| **Message Storage** | 25 chars | 1 KB | 2 KB | 2 KB |
| **File Storage** | — | — | 50 MB | 1 GB |
| **AES-256 Encryption** | ✓ | ✓ | ✓ | ✓ |
| **Email Alerts** | — | ✓ | ✓ | ✓ |

### Payment Options

- **MAS** — Native Massa token (price calculated via MEXC oracle)
- **USDC.e** — Bridged USDC stablecoin on Massa

---

## Gas & Network Fees

### Dynamic Gas Calculation

Gas fees are calculated dynamically based on your check-in interval. Longer intervals require more gas to fund the chain of Autonomous Smart Contract (ASC) calls.

**Contract minimum floor:** `numCalls × 1.0 MAS + 2 MAS buffer`
**Frontend recommended:** `(numCalls × 1.21 MAS + 3 MAS buffer) × 1.3 safety multiplier`

Gas excess above minimum stays on contract balance. Admin can withdraw via `adminWithdrawGasExcess()`.

| Interval | ASC Calls | Recommended Gas | Minimum Floor |
|----------|-----------|-----------------|---------------|
| 5 min (test) | 1 | 5.48 MAS | 3.01 MAS |
| 1 day | 1 | 5.48 MAS | 3.01 MAS |
| 7 days | 2 | 7.06 MAS | 4.01 MAS |
| 14 days | 3 | 8.63 MAS | 5.01 MAS |
| 30 days | 5 | 11.78 MAS | 7.01 MAS |
| 90 days | 15 | 27.50 MAS | 17.01 MAS |
| 180 days | 30 | 51.10 MAS | 32.01 MAS |
| 1 year | 61 | 99.86 MAS | 63.01 MAS |

### Why ASC Chains?

Massa's deferred calls have a maximum scheduling window of ~7 days. For longer intervals, Legacy Vault creates a chain of ASC calls that reschedule themselves until the unlock date is reached.

### Who Pays What?

| Fee Type | Paid By | When |
|----------|---------|------|
| **Subscription** | Owner | At vault creation |
| **Gas + Network** | Owner | At creation & each ping |
| **AUM Fee** | Owner | At each ping |
| **Claim Gas** | Heir | When claiming inheritance |

> 💡 **Important:** AUM fees and gas are paid by the vault owner, NOT deducted from the inheritance balance. Your heirs receive the full deposited amount.

---

## Key Features

### Autonomous Smart Contracts (ASC)
Unlike traditional smart contracts that require external triggers, Massa's ASC technology enables truly autonomous execution. Your vault automatically unlocks when the timer expires — no keepers, no bots, no third parties.

### Password-Protected File Encryption
Files are encrypted client-side with AES-256. The encryption key is then protected with a user-chosen password using PBKDF2 (100,000 iterations) + AES-256-GCM before being stored on-chain. Only someone with the password can decrypt the files. The password is never stored anywhere — owners share it with heirs offline (in person, in a will, etc.).

### Permanent File Storage
Files are stored on Arweave — a decentralized permanent storage network. Once uploaded, files exist forever and cannot be deleted or censored.

### Subscription Model with AUM Fees
Annual subscriptions keep the protocol sustainable. A small AUM (Assets Under Management) fee is collected proportionally from vault balances during ping operations.

### Frozen Vault Recovery
If a vault subscription expires, the vault enters a "frozen" state. Heirs can still claim inheritance by paying the expired subscription fee. Owners can renew to reactivate.

### Error Boundary & Safe UX
The app includes React Error Boundary for crash recovery, custom confirmation modals for destructive actions, drift-free countdown timers, and BigInt-safe calculations for balances exceeding 9M MAS.

---

## Smart Contract

### Deployed Addresses

| Network | Address | Status |
|---------|---------|--------|
| Buildnet | `AS1J3NgbtgrBMLnqkNn7zis9MNKkmHSjeJtCKvR8q8uqikq7vRkn` | Active |
| Mainnet | Coming soon | — |

### Core Functions

**Vault Management**
- `createVault()` — Create vault with MAS payment
- `createVaultWithUsdc()` — Create vault with USDC payment
- `ping()` — Check-in to reset timer
- `deposit()` — Add funds to vault
- `deactivateVault()` — Close vault and withdraw funds
- `updateInterval()` — Change check-in interval (PRO/LEGATE only)

**Subscription**
- `renewSubscription()` — Renew with MAS
- `renewSubscriptionWithUsdc()` — Renew with USDC

**Inheritance**
- `claimInheritance()` — Heir claims after unlock
- `claimInheritanceWithUsdc()` — Heir pays expired subscription with USDC
- `manualTrigger()` — Fallback: heirs trigger distribution if ASC failed

**Gas Management**
- `getMinGasDeposit()` — Get minimum gas deposit for interval
- `getNumAscCalls()` — Get number of ASC calls needed
- `getGasExcess()` — Get accumulated gas excess on contract
- `adminWithdrawGasExcess()` — Admin withdraws gas excess

**Read Functions**
- `getVault()` — Get vault data
- `getVaultsForHeir()` — Get vaults where address is heir
- `getSubscriptionPrice()` — Get subscription price
- `getSubscriptionPriceUsdc()` — Get USDC price

---

## Security Model

### Trust Assumptions

| Component | Trust Level | Description |
|-----------|-------------|-------------|
| Smart Contract | Trustless | Open source, verifiable on-chain |
| File Encryption | Password-protected | AES-256 client-side, key encrypted with PBKDF2+AES-GCM |
| File Storage | Decentralized | Arweave permanent storage |
| Timer Execution | Autonomous | Massa ASC, no external dependencies |
| Price Feed | Real-time | MEXC API with fallback protection |
| Notification API | Rate-limited | Wallet signature + timestamp auth |
| Upload API | Rate-limited | Wallet signature + timestamp auth |

### What Legacy Vault Cannot Do

- Access your private keys
- Decrypt your files (without the password)
- Stop or pause your vault
- Redirect your inheritance
- Recover lost file passwords

### Heir Security

Heirs are identified by their Massa wallet address. To claim inheritance:
1. Vault must be unlocked (owner missed check-in)
2. Heir must sign transaction with their wallet
3. If subscription expired, heir can pay to unlock
4. For encrypted files, heir must enter the file password

No one except designated heirs can claim — enforced by smart contract.

---

## Email Notifications

LIGHT, PRO, and LEGATE tiers include email alerts for critical vault events:

- **Vault Expiration Warning** — Reminder sent before unlock date
- **Subscription Expiring** — Alert when annual subscription needs renewal
- **Inheritance Available** — Notification to heirs when vault unlocks

### Setup

1. Go to vault dashboard
2. Click "Notification Settings"
3. Enter email addresses for owner and heirs
4. Verify email via confirmation link

Email service powered by Resend via Cloudflare Workers. Notifications are optional and can be disabled anytime.

---

## Technical Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                   React + TypeScript                        │
│          Cloudflare Pages (buildnet) → DeWeb (mainnet)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   MASSA BLOCKCHAIN                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Legacy Vault Contract                   │   │
│  │  - Vault storage and management                      │   │
│  │  - ASC deferred calls for auto-unlock               │   │
│  │  - Dynamic gas with ×1.3 safety buffer              │   │
│  │  - USDC integration via transferFrom                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     ARWEAVE                                 │
│         Permanent encrypted file storage (AES-256)          │
│         Upload proxy: Express backend on VPS                │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               CLOUDFLARE WORKERS                            │
│         Email notifications (Resend integration)            │
│         Timestamp auth + IP rate limiting                   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | AssemblyScript → WebAssembly |
| Frontend | React + TypeScript + Vite |
| Blockchain | Massa (buildnet → mainnet) |
| File Storage | Arweave (permanent, decentralized) |
| Notifications | Cloudflare Workers + Resend |
| Upload Proxy | Express + Node.js (VPS) |
| Hosting | Cloudflare Pages → Massa DeWeb |

---

## Changelog (v5.0 — Security Audit, Feb 2025)

**Contract:**
- ASC chain safety — fallback to manual trigger if gas runs out
- Checks-effects-interactions for all USDC functions
- Rate change limited to ±50% per update
- Max interval 1 year, rate in milicents
- Pipe char blocked in payload, exact address matching
- Balance safety checks on all admin withdraws
- Removed duplicate adminEmergencyWithdraw

**Frontend:**
- Fixed heir file decryption, added claim fallback button
- Attach files to existing vaults, change interval (PRO/LEGATE)
- Upload auth via wallet signature, MEXC price API
- Loading state fix, case-sensitive addresses, negative guard

### v5.1 — Bug Fixes (Feb 2026)

**Contract:**
- Fixed USDC gas ternary — excess MAS now correctly goes to gas buffer
- Fixed FREE tier expiry in USDC flow — now gets infinite subscription
- Fixed AUM fee precision loss — hourly calculation avoids overflow
- Added pipe validation for arweaveTxId and encryptedKey fields
- Fixed trailing comma in updateHeirs breaking heir parsing

**Frontend:**
- Connected Claim button to claimInheritance contract call
- Fixed getMinTierPrice → getMinSubscriptionPrice function name
- Removed toLowerCase on base58 Massa addresses
- Added warning that interval change takes effect after next ping

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
