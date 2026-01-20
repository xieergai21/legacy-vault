# Legacy Vault Architecture

This document provides a comprehensive technical overview of the Legacy Vault protocol.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [Autonomous Execution Model](#autonomous-execution-model)
4. [File Storage & Encryption](#file-storage--encryption)
5. [Payment System](#payment-system)
6. [Frontend Architecture](#frontend-architecture)
7. [Security Considerations](#security-considerations)

---

## System Overview

Legacy Vault is a decentralized inheritance protocol built on three pillars:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LEGACY VAULT PROTOCOL                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐          │
│  │    MASSA      │    │   ARWEAVE     │    │   FRONTEND    │          │
│  │  BLOCKCHAIN   │    │   STORAGE     │    │  APPLICATION  │          │
│  ├───────────────┤    ├───────────────┤    ├───────────────┤          │
│  │ • Vault logic │    │ • Encrypted   │    │ • Wallet      │          │
│  │ • Asset hold  │    │   files       │    │   integration │          │
│  │ • Auto exec   │    │ • Permanent   │    │ • Encryption  │          │
│  │ • Heir mgmt   │    │ • Immutable   │    │ • UX layer    │          │
│  └───────────────┘    └───────────────┘    └───────────────┘          │
│          │                    │                    │                   │
│          └────────────────────┴────────────────────┘                   │
│                              │                                         │
│                    ┌─────────▼─────────┐                              │
│                    │   USER WALLETS    │                              │
│                    │ Bearby / Massa St │                              │
│                    └───────────────────┘                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Trustless** — No admin keys, no upgradability, no backdoors
2. **Autonomous** — Execution requires no external triggers or oracles
3. **Self-custodial** — Users maintain full control of assets
4. **Transparent** — All logic verifiable on-chain

---

## Smart Contract Architecture

### State Model

```
┌─────────────────────────────────────────────────────────────┐
│                        VAULT STATE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VaultData {                                                │
│    id: string              // Unique vault identifier       │
│    owner: Address          // Vault creator                 │
│    status: VaultStatus     // ACTIVE | TRIGGERED | CLAIMED  │
│    balance: u64            // MAS amount in vault           │
│    checkInInterval: u64    // Milliseconds between check-ins│
│    lastCheckIn: u64        // Timestamp of last check-in    │
│    triggerTime: u64        // When vault becomes claimable  │
│    createdAt: u64          // Creation timestamp            │
│    heirs: Heir[]           // Array of heir configurations  │
│    fileRefs: FileRef[]     // Arweave transaction IDs       │
│  }                                                          │
│                                                             │
│  Heir {                                                     │
│    address: Address        // Heir's wallet address         │
│    percentage: u8          // Share of inheritance (0-100)  │
│    claimed: bool           // Whether heir has claimed      │
│  }                                                          │
│                                                             │
│  FileRef {                                                  │
│    arweaveId: string       // Arweave transaction ID        │
│    name: string            // Original filename             │
│    size: u64               // File size in bytes            │
│    encryptedKey: string    // Encrypted decryption key      │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Vault Lifecycle

```
                    ┌─────────────┐
                    │   CREATE    │
                    │   VAULT     │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │                        │
              │        ACTIVE          │◄───────────┐
              │                        │            │
              └───────────┬────────────┘            │
                          │                         │
          ┌───────────────┼───────────────┐        │
          │               │               │        │
          ▼               ▼               ▼        │
    ┌──────────┐   ┌──────────┐   ┌──────────┐    │
    │ CHECK-IN │   │  DEPOSIT │   │ ADD HEIR │    │
    │          │   │  ASSETS  │   │          │    │
    └────┬─────┘   └──────────┘   └──────────┘    │
         │                                         │
         └─────────────────────────────────────────┘
                          │
                          │ Interval expires
                          │ (no check-in)
                          ▼
              ┌────────────────────────┐
              │                        │
              │      TRIGGERED         │
              │                        │
              └───────────┬────────────┘
                          │
                          │ Heirs claim
                          ▼
              ┌────────────────────────┐
              │                        │
              │       CLAIMED          │
              │                        │
              └────────────────────────┘
```

### Key Functions

#### Vault Management

```typescript
/**
 * Creates a new vault with specified configuration
 * @param heirs Array of heir addresses
 * @param percentages Corresponding percentage for each heir (must sum to 100)
 * @param intervalDays Number of days between required check-ins
 * @returns vaultId Unique identifier for the created vault
 */
export function createVault(
  heirs: Address[],
  percentages: u8[],
  intervalDays: u32
): string

/**
 * Owner confirms they are alive, resets trigger timer
 * @param vaultId The vault to check into
 */
export function checkIn(vaultId: string): void

/**
 * Deposits MAS tokens into vault
 * @param vaultId The vault to deposit into
 * Attached coins are added to vault balance
 */
export function deposit(vaultId: string): void

/**
 * Owner withdraws funds from active vault
 * @param vaultId The vault to withdraw from
 * @param amount Amount in nanoMAS to withdraw
 */
export function withdraw(vaultId: string, amount: u64): void
```

#### Inheritance

```typescript
/**
 * Heir claims their share after vault triggers
 * @param vaultId The triggered vault
 * Caller must be a registered heir
 */
export function claimInheritance(vaultId: string): void

/**
 * Returns all vaults where address is registered as heir
 * @param heirAddress Address to check
 * @returns Array of vault IDs
 */
export function getVaultsForHeir(heirAddress: Address): string[]
```

#### View Functions

```typescript
/**
 * Returns complete vault data
 * @param vaultId Vault to query
 */
export function getVault(vaultId: string): VaultData

/**
 * Returns current vault status
 * @param vaultId Vault to query
 */
export function getVaultStatus(vaultId: string): VaultStatus

/**
 * Checks if vault should trigger (for deferred call)
 * @param vaultId Vault to check
 */
export function shouldTrigger(vaultId: string): bool
```

---

## Autonomous Execution Model

Legacy Vault uses Massa's **Autonomous Smart Contracts** feature for trustless execution.

### How Deferred Calls Work

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEFERRED CALL FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. User creates vault with 30-day interval                    │
│      │                                                          │
│      ▼                                                          │
│   2. Contract schedules deferred call for Day 30                │
│      │                                                          │
│      │    ┌─────────────────────────────────────┐              │
│      │    │  sendMessage(                       │              │
│      │    │    targetAddress: THIS_CONTRACT,    │              │
│      │    │    targetFunction: "checkTrigger",  │              │
│      │    │    validityStart: now + 30 days,    │              │
│      │    │    validityEnd: now + 31 days,      │              │
│      │    │    coins: executionFee              │              │
│      │    │  )                                  │              │
│      │    └─────────────────────────────────────┘              │
│      │                                                          │
│      ▼                                                          │
│   3a. User checks in on Day 15                                  │
│       → Cancel old deferred call                                │
│       → Schedule new call for Day 45                            │
│                                                                 │
│   3b. User does NOT check in                                    │
│       → Day 30: Massa executes checkTrigger()                   │
│       → Vault status changes to TRIGGERED                       │
│       → Heirs can now claim                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Execution Guarantees

| Aspect | Guarantee |
|--------|-----------|
| Trigger accuracy | Within validity window (±1 slot) |
| Execution cost | Pre-paid by vault creator |
| Censorship resistance | Any node can include the call |
| Failure handling | Retries within validity window |

### Code Example

```typescript
// Schedule trigger check
function scheduleNextCheck(vaultId: string, interval: u64): void {
  const validityStart = Context.timestamp() + interval;
  const validityEnd = validityStart + VALIDITY_WINDOW;
  
  sendMessage(
    Context.callee(),           // This contract
    "checkTrigger",             // Function to call
    validityStart,
    validityEnd,
    MAX_GAS,
    RAW_FEE,
    EXECUTION_COINS,
    new Args().add(vaultId)     // Parameters
  );
}

// Called autonomously by Massa
export function checkTrigger(vaultId: string): void {
  const vault = getVault(vaultId);
  
  if (vault.status != VaultStatus.ACTIVE) return;
  
  if (Context.timestamp() >= vault.triggerTime) {
    vault.status = VaultStatus.TRIGGERED;
    saveVault(vault);
    generateEvent(`VAULT_TRIGGERED:${vaultId}`);
  }
}
```

---

## File Storage & Encryption

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE ENCRYPTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   OWNER'S BROWSER                                               │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  1. User selects file                                   │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  2. Generate random AES-256 key                         │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  3. Encrypt file with AES-256-GCM                       │  │
│   │     │                                                   │  │
│   │     ├──────────────────────┐                            │  │
│   │     ▼                      ▼                            │  │
│   │  4a. Upload encrypted   4b. Encrypt AES key with        │  │
│   │      file to Arweave       heir's public key            │  │
│   │     │                      │                            │  │
│   │     ▼                      ▼                            │  │
│   │  5. Store Arweave ID    Store encrypted key             │  │
│   │     in smart contract   in smart contract               │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   KEY POINT: Raw file and AES key NEVER leave browser          │
│   unencrypted. Server/blockchain only sees encrypted data.     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Decryption Flow (Heir)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE DECRYPTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   HEIR'S BROWSER                                                │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  1. Fetch encrypted AES key from contract               │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  2. Decrypt AES key with heir's private key             │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  3. Fetch encrypted file from Arweave                   │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  4. Decrypt file with AES key                           │  │
│   │     │                                                   │  │
│   │     ▼                                                   │  │
│   │  5. File available to heir                              │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cryptographic Specifications

| Component | Algorithm | Key Size | Notes |
|-----------|-----------|----------|-------|
| File encryption | AES-256-GCM | 256 bits | Authenticated encryption |
| Key encryption | RSA-OAEP / ECIES | 2048/256 bits | Depends on wallet type |
| Key derivation | PBKDF2 | — | For password-based keys |
| Random generation | Web Crypto API | — | CSPRNG |

---

## Payment System

Legacy Vault supports dual payment options for maximum accessibility.

### Payment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT OPTIONS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Option 1: Native MAS                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  User ──► Pay in MAS ──► Smart Contract                 │  │
│   │                                                         │  │
│   │  • Real-time price from CoinGecko API                   │  │
│   │  • Direct on-chain payment                              │  │
│   │  • No intermediaries                                    │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Option 2: USDT (Stable)                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  User ──► Pay USDT ──► Payment Processor ──► MAS        │  │
│   │                                                         │  │
│   │  • Fixed USD pricing                                    │  │
│   │  • No price volatility for user                         │  │
│   │  • Cross-chain bridge integration                       │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Subscription Tiers

```typescript
enum SubscriptionTier {
  FREE = 0,      // Limited features, no payment
  LIGHT = 1,     // $5/month equivalent
  VAULT_PRO = 2, // $15/month equivalent  
  LEGATE = 3     // $50/month equivalent
}
```

---

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── vault/
│   │   ├── CreateVault.tsx      # Vault creation wizard
│   │   ├── VaultDashboard.tsx   # Owner's vault overview
│   │   ├── VaultDetails.tsx     # Single vault management
│   │   └── CheckInButton.tsx    # Quick check-in action
│   ├── heir/
│   │   ├── HeirDashboard.tsx    # Heir's inheritance view
│   │   ├── VaultDiscovery.tsx   # Find assigned vaults
│   │   └── ClaimInterface.tsx   # Claim inheritance
│   ├── files/
│   │   ├── FileUploader.tsx     # Encrypted upload
│   │   ├── FileList.tsx         # Vault files display
│   │   └── FileDownloader.tsx   # Decrypted download
│   └── wallet/
│       ├── WalletConnect.tsx    # Multi-wallet support
│       └── WalletContext.tsx    # Wallet state management
├── hooks/
│   ├── useVault.ts              # Vault operations
│   ├── useWallet.ts             # Wallet integration
│   └── useEncryption.ts         # Crypto operations
├── services/
│   ├── massa.ts                 # Blockchain interactions
│   ├── arweave.ts               # File storage
│   └── encryption.ts            # Crypto utilities
└── types/
    └── index.ts                 # TypeScript definitions
```

### Wallet Integration

```typescript
// Unified wallet interface
interface WalletProvider {
  connect(): Promise<Address>;
  disconnect(): void;
  signTransaction(tx: Transaction): Promise<SignedTransaction>;
  getBalance(): Promise<bigint>;
}

// Supported wallets
const SUPPORTED_WALLETS = {
  bearby: BearbyProvider,
  massaStation: MassaStationProvider
};
```

---

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Contract bugs | Formal verification, audits, bug bounty |
| Key compromise (owner) | Multi-sig option, time-locks |
| Key loss (heir) | Multiple heirs, backup keys |
| Massa network failure | Long validity windows, retry logic |
| Arweave unavailability | Multiple gateways, local caching |
| Front-end compromise | Client-side encryption, open source |

### Access Control

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL MATRIX                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Function              Owner    Heir    Anyone                 │
│   ─────────────────────────────────────────────                 │
│   createVault           ✓        ✗       ✗                     │
│   checkIn               ✓        ✗       ✗                     │
│   deposit               ✓        ✗       ✗                     │
│   withdraw              ✓        ✗       ✗                     │
│   addHeir               ✓        ✗       ✗                     │
│   claimInheritance      ✗        ✓       ✗                     │
│   getVault              ✓        ✓       ✓                     │
│   getVaultStatus        ✓        ✓       ✓                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Upgrade Policy

**The core vault contract is immutable by design.**

We believe inheritance contracts should not be upgradeable because:

1. Users must trust the code won't change after deposit
2. Upgrades could be used maliciously
3. Inheritance may execute years in the future

New features are deployed as separate contracts. Users can migrate voluntarily.

---

## Appendix: Data Flow Diagrams

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE USER JOURNEY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   OWNER FLOW                                                    │
│   ══════════                                                    │
│   Connect Wallet                                                │
│        │                                                        │
│        ▼                                                        │
│   Create Vault ──► Add Heirs ──► Set Interval                  │
│        │                                                        │
│        ▼                                                        │
│   Deposit MAS ──► Upload Files (encrypted)                      │
│        │                                                        │
│        ▼                                                        │
│   Share decryption instructions with heirs (off-chain)          │
│        │                                                        │
│        ▼                                                        │
│   Regular Check-ins ◄─────────────────────────┐                │
│        │                                       │                │
│        │ (life continues)                      │                │
│        └───────────────────────────────────────┘                │
│                                                                 │
│   HEIR FLOW                                                     │
│   ═════════                                                     │
│   Connect Wallet                                                │
│        │                                                        │
│        ▼                                                        │
│   Discover Vaults (by heir address)                             │
│        │                                                        │
│        ▼                                                        │
│   Monitor Status ◄────────────────────────────┐                │
│        │                                       │                │
│        │ (vault still active)                  │                │
│        └───────────────────────────────────────┘                │
│        │                                                        │
│        │ (vault triggered)                                      │
│        ▼                                                        │
│   Claim Inheritance ──► Receive MAS                            │
│        │                                                        │
│        ▼                                                        │
│   Download Files ──► Decrypt (with shared key)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Last updated: January 2025*
*Version: 1.0*
