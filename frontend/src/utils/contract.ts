// CONTRACT ADDRESS - UPDATE AFTER DEPLOYMENT
export const CONTRACT_ADDRESS = 'AS12gd8bNux6qsrMKVn4xR43W1HKMDNpAyjsJFL6ULgitvL3QDKvn';

// Tier names
export const TIER_NAMES = ['FREE', 'LIGHT', 'VAULT PRO', 'LEGATE'];

// Annual subscription prices in USD
export const SUBSCRIPTION_PRICES_USD = [0, 9.99, 29.99, 89.99];

// Minimum subscription prices in MAS (protection)
export const MIN_SUBSCRIPTION_MAS = [0, 1000, 3000, 9000];

// AUM Fee rates (basis points: 100 = 1%)
export const AUM_FEE_BPS = [0, 100, 50, 25];

// AUM Fee rates as percentages
export const AUM_FEE_PERCENT = [0, 1, 0.5, 0.25];

// Max balance per tier (in MAS)
export const MAX_BALANCE_MAS = [10000, 200000, 2000000, Infinity];

// Max heirs per tier
export const MAX_HEIRS = [1, 3, 10, 255];

// Constants
export const ONE_DAY_MS = 86400000;
export const MAX_DEFERRED_INTERVAL_MS = 6 * ONE_DAY_MS;
export const ORACLE_FEE = 0.01;
export const ONE_YEAR_MS = 365 * ONE_DAY_MS;

// Minimum gas thresholds (must match smart contract MIN_GAS_PER_CALL and MIN_GAS_BUFFER)
// Network fee is ~1.05-1.21 MAS per call, 1.0 MAS is the realistic floor
export const MIN_GAS_PER_CALL_MAS = 1.0;
export const MIN_GAS_BUFFER_MAS = 2;

// Default cost per call (used as fallback when network quote is unavailable)
export const DEFAULT_COST_PER_CALL_MAS = 1.21;
export const DEFAULT_GAS_BUFFER_MAS = 3;

// Safety multiplier applied to network quote (1.3 = 30% extra buffer)
// Excess stays on contract balance, admin can withdraw via adminWithdrawGasExcess()
export const GAS_SAFETY_MULTIPLIER = 1.3;

export interface GasEstimate {
  minimum: number;       // Absolute floor (contract will reject below this)
  recommended: number;   // Based on network conditions + safety buffer
  numCalls: number;      // Number of ASC calls in the chain
  perCallCost: number;   // Cost per individual call used in calculation
}

// Calculate gas estimates for a given interval
export function calculateGasEstimate(
  intervalMs: number,
  networkQuotePerCall?: number
): GasEstimate {
  const numCalls = Math.ceil(intervalMs / MAX_DEFERRED_INTERVAL_MS);
  
  // Absolute minimum (hardcoded in contract as safety floor)
  const minimum = numCalls * MIN_GAS_PER_CALL_MAS + MIN_GAS_BUFFER_MAS;
  
  // Recommended: use network quote if available, otherwise fallback
  const perCallCost = networkQuotePerCall || DEFAULT_COST_PER_CALL_MAS;
  const baseCost = numCalls * perCallCost + DEFAULT_GAS_BUFFER_MAS;
  const recommended = Math.max(baseCost * GAS_SAFETY_MULTIPLIER, minimum);
  
  return { minimum, recommended, numCalls, perCallCost };
}

// Legacy compatibility wrapper (returns recommended amount)
export function calculateRequiredGas(intervalMs: number, networkQuotePerCall?: number): number {
  return calculateGasEstimate(intervalMs, networkQuotePerCall).recommended;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type VaultStatus = 
  | 'ACTIVE'                    // Subscription valid, timer running
  | 'FROZEN'                    // Subscription expired, timer still running!
  | 'UNLOCKED_PENDING_PAYMENT'  // Timer expired + subscription expired, heir must pay
  | 'UNLOCKED_READY'            // Timer expired + subscription valid, heir can claim
  | 'DISTRIBUTED'               // Vault distributed
  | 'NOT_FOUND';                // No vault exists

export interface VaultData {
  tier: number;
  unlockDate: number;
  interval: number;
  lastPing: number;
  isActive: boolean;
  balance: bigint;
  heirs: string[];
  payload: string;
  arweaveTxId: string;
  encryptedKey: string;
  subscriptionExpiry: number;
  lastFeeCollection: number;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONVERSION FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function toNanoMassa(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

export function fromNanoMassa(nano: bigint | string | number): number {
  return Number(BigInt(nano)) / 1_000_000_000;
}

export function formatMassa(nano: bigint | string | number): string {
  const value = fromNanoMassa(nano);
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K';
  return value.toFixed(2) + ' MAS';
}

export function formatUsd(amount: number): string {
  return '$' + amount.toFixed(2);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIME FORMATTING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Unlocked!';
  
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VAULT DATA PARSING (12 fields)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Parse vault data from contract
 * Format: tier|unlockDate|interval|lastPing|isActive|vaultBalance|heirs|payload|arweave|encKey|subscriptionExpiry|lastFeeCollection
 */
export function parseVaultData(raw: string): VaultData {
  const parts = raw.split('|');
  return {
    tier: parseInt(parts[0]) || 0,
    unlockDate: parseInt(parts[1]) || 0,
    interval: parseInt(parts[2]) || 0,
    lastPing: parseInt(parts[3]) || 0,
    isActive: parts[4] === '1',
    balance: BigInt(parts[5] || '0'),
    heirs: (parts[6] || '').split(',').filter(h => h.length > 0),
    payload: parts[7] || '',
    arweaveTxId: parts[8] || '',
    encryptedKey: parts[9] || '',
    subscriptionExpiry: parseInt(parts[10]) || 0,
    lastFeeCollection: parseInt(parts[11]) || 0,
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUBSCRIPTION HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function isSubscriptionActive(vault: VaultData): boolean {
  if (vault.tier === 0) return true; // FREE tier never expires
  return Date.now() < vault.subscriptionExpiry;
}

export function isVaultUnlocked(vault: VaultData): boolean {
  return Date.now() >= vault.unlockDate;
}

export function getVaultStatusFromData(vault: VaultData): VaultStatus {
  if (!vault.isActive) return 'DISTRIBUTED';
  
  const now = Date.now();
  const unlocked = now >= vault.unlockDate;
  const subscriptionActive = isSubscriptionActive(vault);
  
  if (unlocked) {
    return subscriptionActive ? 'UNLOCKED_READY' : 'UNLOCKED_PENDING_PAYMENT';
  } else {
    return subscriptionActive ? 'ACTIVE' : 'FROZEN';
  }
}

export function getDaysUntilSubscriptionExpiry(vault: VaultData): number {
  if (vault.tier === 0) return Infinity;
  const ms = vault.subscriptionExpiry - Date.now();
  return Math.ceil(ms / ONE_DAY_MS);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUM FEE CALCULATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Calculate accrued AUM fee
 * fee = balance * (feeBps / 10000) * (timePassed / oneYear)
 */
export function calculateAccruedFee(vault: VaultData): number {
  const feeBps = AUM_FEE_BPS[vault.tier];
  if (feeBps === 0) return 0;
  
  const balance = fromNanoMassa(vault.balance);
  const timePassed = Date.now() - vault.lastFeeCollection;
  
  const fee = balance * (feeBps / 10000) * (timePassed / ONE_YEAR_MS);
  return fee;
}

/**
 * Calculate net balance after AUM fee
 */
export function getNetBalance(vault: VaultData): number {
  const balance = fromNanoMassa(vault.balance);
  const fee = calculateAccruedFee(vault);
  return Math.max(0, balance - fee);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIER HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function getTierName(tier: number): string {
  return TIER_NAMES[tier] || 'UNKNOWN';
}

export function getSubscriptionPriceUsd(tier: number): number {
  return SUBSCRIPTION_PRICES_USD[tier] || 0;
}

export function getMinSubscriptionMas(tier: number): number {
  return MIN_SUBSCRIPTION_MAS[tier] || 0;
}

export function getAumFeePercent(tier: number): number {
  return AUM_FEE_PERCENT[tier] || 0;
}

export function getMaxBalance(tier: number): number {
  return MAX_BALANCE_MAS[tier] || 0;
}

export function getMaxHeirs(tier: number): number {
  return MAX_HEIRS[tier] || 1;
}
