# Legacy Vault 🔐

**Decentralized Inheritance Management on Massa Blockchain**

Legacy Vault is a trustless dead man's switch protocol that enables autonomous asset transfer and encrypted file inheritance. If you don't check in within your specified interval, your designated heirs automatically receive access to your digital legacy.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Massa Network](https://img.shields.io/badge/Massa-Buildnet-blue)](https://massa.net)
[![Smart Contract](https://img.shields.io/badge/Contract-Verified-green)]()

---

## 🎯 Problem We Solve

Traditional inheritance of digital assets faces critical challenges:

- **Centralized custody risks** — Exchanges can freeze accounts, lose keys, or disappear
- **Key management complexity** — How do you pass private keys securely after death?
- **Legal delays** — Probate can take months or years
- **No automation** — Someone must manually execute your wishes

Legacy Vault solves this through **autonomous on-chain execution** — no intermediaries, no trust required.

---

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         LEGACY VAULT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Owner creates vault                                           │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐    Check-in interval    ┌─────────────┐      │
│   │   ACTIVE    │◄──────────────────────► │   OWNER     │      │
│   │   VAULT     │    (e.g., 30 days)      │   ALIVE     │      │
│   └─────────────┘                         └─────────────┘      │
│        │                                                        │
│        │ No check-in                                            │
│        ▼                                                        │
│   ┌─────────────┐                         ┌─────────────┐      │
│   │  TRIGGERED  │────────────────────────►│   HEIRS     │      │
│   │   STATE     │   Assets + Files        │   RECEIVE   │      │
│   └─────────────┘                         └─────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Create Vault** — Define heirs, check-in interval, and inheritance rules
2. **Deposit Assets** — Add MAS tokens and encrypted files to your vault
3. **Regular Check-ins** — Confirm you're alive (one transaction)
4. **Automatic Execution** — If check-in missed, heirs can claim inheritance

The protocol uses Massa's **Autonomous Smart Contracts** (deferred calls) to execute without any external triggers.

---

## ✨ Features

| Feature | FREE | LIGHT | VAULT PRO | LEGATE |
|---------|------|-------|-----------|--------|
| **Price** | $0 | $9.99 | $29.99 | $89.99 |
| **Heirs** | 1 | Up to 3 | Up to 10 | Unlimited |
| **On-chain text** | 25 characters | 1 KB | 2 KB (Encrypted Notes) | — |
| **File storage** | — | — | 50 MB (Arweave) | 1 GB (Arweave) |
| **AES-256 encryption** | ✓ | ✓ | ✓ | ✓ |
| **Email alerts for heirs** | — | ✓ | ✓ | ✓ |
| **File Protection System** | — | — | ✓ | ✓ |
| **Shamir's Secret Sharing** | — | — | — | ✓ |
| **Dynamic asset distribution (%)** | — | — | — | ✓ |
| **Automated MAS transfer** | ✓ | ✓ | ✓ | ✓ |

### Target Audience

- **FREE** — Essential Security: Test the system, basic inheritance
- **LIGHT** — Crypto Natives: Multiple heirs, encrypted messages
- **VAULT PRO** — Comprehensive Heritage: Files, documents, full protection
- **LEGATE** — Digital Dynasties: Enterprise-grade, unlimited scale

---

## 🔒 Security Model

### Trust Assumptions

| Component | Trust Level | Why |
|-----------|-------------|-----|
| Smart Contract | **Trustless** | Open source, verifiable on-chain |
| File Encryption | **Client-side** | Keys never leave your device |
| File Storage | **Decentralized** | Arweave permanent storage |
| Check-in Logic | **Autonomous** | Massa deferred calls, no server needed |

### What We DON'T Have Access To

- ❌ Your private keys
- ❌ Your decryption keys
- ❌ Ability to pause/stop your vault
- ❌ Ability to redirect inheritance

### Risks & Limitations

We believe in transparency. Here's what you should know:

1. **Smart contract risk** — Bugs could affect funds (see Audits section)
2. **Massa network risk** — Protocol depends on Massa blockchain availability
3. **Key loss** — If heirs lose their keys, inheritance is unrecoverable
4. **Encryption key management** — You must securely share file decryption keys with heirs

---

## 📜 Smart Contracts

### Deployed Addresses

| Network | Contract | Address | Verified |
|---------|----------|---------|----------|
| Buildnet | LegacyVault | `AS12...` | ✓ |
| Mainnet | — | Coming soon | — |

### Contract Architecture

```
contracts/
├── assembly/
│   ├── main.ts              # Entry point
│   ├── vault.ts             # Vault logic
│   ├── inheritance.ts       # Distribution logic
│   ├── storage.ts           # State management
│   └── types.ts             # Data structures
└── tests/
    └── vault.spec.ts        # Unit tests
```

### Key Functions

```typescript
// Create a new vault
createVault(heirs: Address[], percentages: u8[], intervalDays: u32): void

// Owner check-in (resets timer)
checkIn(vaultId: string): void

// Heir claims inheritance (after trigger)
claimInheritance(vaultId: string): void

// View vault status
getVaultStatus(vaultId: string): VaultStatus
```

Full documentation: [docs/CONTRACTS.md](docs/CONTRACTS.md)

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Blockchain | Massa | Smart contracts, autonomous execution |
| Contract Language | AssemblyScript | Massa VM compatible |
| File Storage | Arweave | Permanent, decentralized storage |
| Encryption | AES-256-GCM | Client-side file encryption |
| Frontend | React + TypeScript | User interface |
| Wallets | Bearby, Massa Station | Transaction signing |

---

## 🚀 Getting Started

### For Users

1. Visit [app.legacyvault.io](https://app.legacyvault.io) (coming soon)
2. Connect your Massa wallet (Bearby or Massa Station)
3. Create your first vault
4. Add heirs and set your check-in interval
5. Deposit assets and/or upload encrypted files

### For Developers

```bash
# Clone repository
git clone https://github.com/your-username/legacy-vault.git
cd legacy-vault

# Install dependencies
npm install

# Build contracts
cd contracts
npm run build

# Run tests
npm test

# Deploy to buildnet
npm run deploy:buildnet
```

Requirements:
- Node.js 18+
- Massa wallet with buildnet MAS

---

## 🔍 Audits

| Auditor | Date | Scope | Report |
|---------|------|-------|--------|
| — | Planned | Smart Contracts | — |

We are actively seeking security audits. If you're an auditor interested in reviewing Legacy Vault, please contact us.

### Bug Bounty

We offer rewards for responsible disclosure of security vulnerabilities:

| Severity | Reward |
|----------|--------|
| Critical (fund loss) | Up to $5,000 |
| High | Up to $2,000 |
| Medium | Up to $500 |
| Low | Recognition |

Report vulnerabilities to: security@legacyvault.io (coming soon)

See [SECURITY.md](SECURITY.md) for details.

---

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Smart Contract Reference](docs/CONTRACTS.md)
- [Heir Guide](docs/HEIR_GUIDE.md)
- [FAQ](docs/FAQ.md)

---

## 🗺️ Roadmap

### Phase 1: Foundation ✓
- [x] Core smart contract development
- [x] Buildnet deployment
- [x] Basic frontend with wallet integration
- [x] Single heir support

### Phase 2: Current
- [x] Multi-heir support with percentage splits
- [x] Encrypted file storage (Arweave)
- [x] Cross-chain payment options
- [ ] Security audit
- [ ] Mainnet deployment

### Phase 3: Expansion
- [ ] Multi-signature heir release
- [ ] Time-locked inheritance
- [ ] NFT inheritance support
- [ ] Mobile app

### Phase 4: Ecosystem
- [ ] DAO governance
- [ ] Third-party integrations
- [ ] Multi-chain support

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where we need help:
- Smart contract review
- Frontend improvements
- Documentation translations
- Security research

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

Legacy Vault is experimental software. While we strive for security and reliability:

- **Not financial advice** — Do your own research before using
- **No guarantees** — Software may contain bugs
- **Testnet first** — Always test with small amounts first
- **Your responsibility** — You are responsible for your keys and heir management

---

## 📬 Contact

*Contact channels coming soon*

<!--
Uncomment when ready:
- Website: [legacyvault.io](https://legacyvault.io)
- Twitter: [@LegacyVaultApp](https://twitter.com/LegacyVaultApp)
- Discord: [Join our community](https://discord.gg/legacyvault)
- Email: hello@legacyvault.io
-->

---

<p align="center">
  <strong>Your Digital Legacy, Secured Forever</strong>
  <br>
  Built with ❤️ on Massa
</p>
