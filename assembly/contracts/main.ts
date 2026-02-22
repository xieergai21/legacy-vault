/**
 * LEGACY VAULT - AUTONOMOUS SMART CONTRACT v3.0
 * Subscription model with AUM fees
 * 
 * Changes v3.0:
 * - Annual subscription model (not one-time payment)
 * - AUM fees collected on ping and distribution
 * - Vault freeze when subscription expires (timer continues!)
 * - Heir can pay expired subscription to claim
 * - Distribution history for heirs
 * 
 * Vault Data Structure (12 fields):
 * tier|unlockDate|interval|lastPing|isActive|vaultBalance|heirs|payload|arweave|encKey|subscriptionExpiry|lastFeeCollection
 */

import {
  Context,
  Storage,
  Address,
  transferCoins,
  generateEvent,
  callerHasWriteAccess,
  deferredCallRegister,
  deferredCallCancel,
  deferredCallExists,
  currentPeriod,
  currentThread,
  Slot,
  call,
  balance,
} from '@massalabs/massa-as-sdk';

import {
  Args,
  stringToBytes,
  bytesToString,
  u64ToBytes,
  bytesToU64,
} from '@massalabs/as-types';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORAGE KEYS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const VAULT_PREFIX: string = 'VAULT_';
const ORACLE_KEY: string = 'ORACLE';
const RATE_KEY: string = 'RATE';
const ADMIN_KEY: string = 'ADMIN';
const PENDING_ADMIN_KEY: string = 'PENDING_ADMIN';
const INITIALIZED_KEY: string = 'INIT';
const DEFERRED_CALL_PREFIX: string = 'DC_';
const HEIR_VAULTS_PREFIX: string = 'HEIR_';
const DISTRIBUTED_PREFIX: string = 'DIST_';
const DISTRIBUTED_HEIR_PREFIX: string = 'DISTHEIR_';
const TOTAL_REVENUE_KEY: string = 'REVENUE';
const TOTAL_AUM_FEES_KEY: string = 'AUM_FEES';
const USDC_CONTRACT: string = "AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ";
const USDC_DECIMALS: u64 = 1_000_000; // USDC has 6 decimals

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTANTS - PRICING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const MASSA_DECIMALS: u64 = 1_000_000_000;

// Annual subscription prices in USD cents
const SUBSCRIPTION_FREE_USD: u64 = 0;        // $0
const SUBSCRIPTION_LIGHT_USD: u64 = 999;     // $9.99
const SUBSCRIPTION_PRO_USD: u64 = 2999;      // $29.99
const SUBSCRIPTION_LEGATE_USD: u64 = 8999;   // $89.99

// Minimum subscription prices in MAS (protection against exploits)
const MIN_SUBSCRIPTION_FREE: u64 = 0;
const MIN_SUBSCRIPTION_LIGHT: u64 = 1000 * MASSA_DECIMALS;   // 1,000 MAS
const MIN_SUBSCRIPTION_PRO: u64 = 3000 * MASSA_DECIMALS;     // 3,000 MAS
const MIN_SUBSCRIPTION_LEGATE: u64 = 9000 * MASSA_DECIMALS;  // 9,000 MAS

// Subscription period (1 year in milliseconds)
const SUBSCRIPTION_PERIOD: u64 = 365 * 24 * 60 * 60 * 1000;

// AUM Fee in basis points (100 bps = 1%)
const AUM_FEE_FREE: u64 = 0;      // 0%
const AUM_FEE_LIGHT: u64 = 200;   // 2% annual
const AUM_FEE_PRO: u64 = 100;     // 1% annual
const AUM_FEE_LEGATE: u64 = 50;   // 0.5% annual
const BPS_DENOMINATOR: u64 = 10000;
const MS_PER_YEAR: u64 = 365 * 24 * 60 * 60 * 1000;

// Balance limits in nanoMAS
const MAX_BALANCE_FREE: u64 = 10000 * MASSA_DECIMALS;      // 10K MAS
const MAX_BALANCE_LIGHT: u64 = 200000 * MASSA_DECIMALS;    // 200K MAS
const MAX_BALANCE_PRO: u64 = 2000000 * MASSA_DECIMALS;     // 2M MAS
const MAX_BALANCE_LEGATE: u64 = U64.MAX_VALUE;             // Unlimited

// Max heirs
const MAX_HEIRS_FREE: u8 = 1;
const MAX_HEIRS_LIGHT: u8 = 3;
const MAX_HEIRS_PRO: u8 = 10;
const MAX_HEIRS_LEGATE: u8 = 255;

// Payload limits (bytes)
const MAX_PAYLOAD_FREE: u32 = 25;
const MAX_PAYLOAD_LIGHT: u32 = 1024;
const MAX_PAYLOAD_PRO: u32 = 2048;
const MAX_PAYLOAD_LEGATE: u32 = 5120;

// Other constants
const MIN_HEARTBEAT_INTERVAL: u64 = 300000; // 5 min for testing // 1 day in ms
const MAX_HEARTBEAT_INTERVAL: u64 = 365 * 24 * 60 * 60 * 1000; // 1 year max
const PERIOD_DURATION_MS: u64 = 16000;

export const ORACLE_FEE: u64 = 10_000_000; // 0.01 MAS
export const DEFERRED_CALL_GAS: u64 = 100_000_000;
export const MAX_DEFERRED_INTERVAL: u64 = 6 * 24 * 60 * 60 * 1000; // 6 days max for deferred call

// Minimum safe gas per ASC call (absolute floor, protects against underfunding)
// Network deferred call fee is ~1.05-1.21 MAS, so 1.0 MAS is the realistic floor
const MIN_GAS_PER_CALL: u64 = 1_000_000_000; // 1.0 MAS per call
const MIN_GAS_BUFFER: u64 = 2 * MASSA_DECIMALS; // 2 MAS buffer

// Storage key for accumulated gas excess (admin-withdrawable)
const GAS_EXCESS_KEY: string = 'GAS_EXCESS';

// Calculate minimum required gas deposit (contract-side safety floor)
export function _calcMinGasDeposit(intervalMs: u64): u64 {
  const numCalls = (intervalMs + MAX_DEFERRED_INTERVAL - 1) / MAX_DEFERRED_INTERVAL;
  return numCalls * MIN_GAS_PER_CALL + MIN_GAS_BUFFER;
}

// Calculate number of ASC calls needed for a given interval
export function _calcNumCalls(intervalMs: u64): u64 {
  return (intervalMs + MAX_DEFERRED_INTERVAL - 1) / MAX_DEFERRED_INTERVAL;
}

// Track gas excess that admin can withdraw
function _getGasExcess(): u64 {
  const key = stringToBytes(GAS_EXCESS_KEY);
  if (!Storage.has(key)) return 0;
  return bytesToU64(Storage.get(key));
}

function _addGasExcess(amount: u64): void {
  const current = _getGasExcess();
  Storage.set(stringToBytes(GAS_EXCESS_KEY), u64ToBytes(current + amount));
}

function _subtractGasExcess(amount: u64): void {
  const current = _getGasExcess();
  if (amount > current) {
    Storage.set(stringToBytes(GAS_EXCESS_KEY), u64ToBytes(0));
  } else {
    Storage.set(stringToBytes(GAS_EXCESS_KEY), u64ToBytes(current - amount));
  }
}

// Public: get minimum gas deposit for frontend display
export function getMinGasDeposit(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const intervalMs = args.nextU64().unwrap();
  const minGas = _calcMinGasDeposit(intervalMs);
  return new Args().add(minGas).serialize();
}

// Public: get number of ASC calls needed
export function getNumAscCalls(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const intervalMs = args.nextU64().unwrap();
  const numCalls = _calcNumCalls(intervalMs);
  return new Args().add(numCalls).serialize();
}

// Public: get accumulated gas excess balance
export function getGasExcess(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getGasExcess());
}

// Tiers
export const TIER_FREE: u8 = 0;
export const TIER_LIGHT: u8 = 1;
export const TIER_VAULT_PRO: u8 = 2;
export const TIER_LEGATE: u8 = 3;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KEY GENERATION FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _getVaultKey(address: string): string { return VAULT_PREFIX + address; }
function _getDeferredCallKey(address: string): string { return DEFERRED_CALL_PREFIX + address; }
function _getHeirVaultsKey(heir: string): string { return HEIR_VAULTS_PREFIX + heir; }
function _getDistributedKey(owner: string): string { return DISTRIBUTED_PREFIX + owner; }
function _getDistributedHeirKey(heir: string): string { return DISTRIBUTED_HEIR_PREFIX + heir; }
function _vaultExists(address: string): bool { return Storage.has(stringToBytes(_getVaultKey(address))); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RATE AND PRICING FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _getMassaUsdRate(): u64 {
  const key = stringToBytes(RATE_KEY);
  if (Storage.has(key)) return bytesToU64(Storage.get(key));
  return 431; // Default 431 milicents ($0.00431)
}

function _usdToMassa(usdCents: u64): u64 {
  const rate = _getMassaUsdRate();
  if (rate == 0) return 0;
  // Rate is in milicents (1/1000 cent), so multiply usdCents by 1000
  return (usdCents * 1000 * MASSA_DECIMALS) / rate;
}

function _getSubscriptionPriceUsd(tier: u8): u64 {
  if (tier == TIER_FREE) return SUBSCRIPTION_FREE_USD;
  if (tier == TIER_LIGHT) return SUBSCRIPTION_LIGHT_USD;
  if (tier == TIER_VAULT_PRO) return SUBSCRIPTION_PRO_USD;
  if (tier == TIER_LEGATE) return SUBSCRIPTION_LEGATE_USD;
  return 0;
}

function _getMinSubscriptionMassa(tier: u8): u64 {
  if (tier == TIER_FREE) return MIN_SUBSCRIPTION_FREE;
  if (tier == TIER_LIGHT) return MIN_SUBSCRIPTION_LIGHT;
  if (tier == TIER_VAULT_PRO) return MIN_SUBSCRIPTION_PRO;
  if (tier == TIER_LEGATE) return MIN_SUBSCRIPTION_LEGATE;
  return 0;
}

function _getAumFeeBps(tier: u8): u64 {
  if (tier == TIER_FREE) return AUM_FEE_FREE;
  if (tier == TIER_LIGHT) return AUM_FEE_LIGHT;
  if (tier == TIER_VAULT_PRO) return AUM_FEE_PRO;
  if (tier == TIER_LEGATE) return AUM_FEE_LEGATE;
  return 0;
}

function _getMaxBalance(tier: u8): u64 {
  if (tier == TIER_FREE) return MAX_BALANCE_FREE;
  if (tier == TIER_LIGHT) return MAX_BALANCE_LIGHT;
  if (tier == TIER_VAULT_PRO) return MAX_BALANCE_PRO;
  return MAX_BALANCE_LEGATE;
}

function _getMaxHeirs(tier: u8): u8 {
  if (tier == TIER_FREE) return MAX_HEIRS_FREE;
  if (tier == TIER_LIGHT) return MAX_HEIRS_LIGHT;
  if (tier == TIER_VAULT_PRO) return MAX_HEIRS_PRO;
  return MAX_HEIRS_LEGATE;
}

function _getMaxPayload(tier: u8): u32 {
  if (tier == TIER_FREE) return MAX_PAYLOAD_FREE;
  if (tier == TIER_LIGHT) return MAX_PAYLOAD_LIGHT;
  if (tier == TIER_VAULT_PRO) return MAX_PAYLOAD_PRO;
  return MAX_PAYLOAD_LEGATE;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN AND STORAGE FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// Transfer USDC from user to this contract
function _transferUsdcFrom(from: string, amount: u64): void {
  const args = new Args()
    .add(from)
    .add(Context.callee().toString())
    .add(amount);
  call(new Address(USDC_CONTRACT), 'transferFrom', args, 0);
}

// Transfer USDC from contract to address
function _transferUsdcTo(to: string, amount: u64): void {
  const args = new Args()
    .add(to)
    .add(amount);
  call(new Address(USDC_CONTRACT), 'transfer', args, 0);
}

// Transfer USDC directly from sender to recipient (single transferFrom)
function _transferUsdcDirect(from: string, to: string, amount: u64): void {
  const args = new Args()
    .add(from)
    .add(to)
    .add(amount);
  call(new Address(USDC_CONTRACT), 'transferFrom', args, 0);
}

// Get USDC subscription price (in USDC cents, 6 decimals)
function _getSubscriptionPriceUsdc(tier: u32): u64 {
  if (tier == 0) return 0;
  if (tier == 1) return 10 * USDC_DECIMALS;   // $10 USDC
  if (tier == 2) return 30 * USDC_DECIMALS;   // $30 USDC
  if (tier == 3) return 90 * USDC_DECIMALS;   // $90 USDC
  return 0;
}
function _getAdmin(): string {
  const key = stringToBytes(ADMIN_KEY);
  if (!Storage.has(key)) return '';
  return bytesToString(Storage.get(key));
}

function _getOracle(): string {
  const key = stringToBytes(ORACLE_KEY);
  if (!Storage.has(key)) return '';
  return bytesToString(Storage.get(key));
}

function _getTotalRevenue(): u64 {
  const key = stringToBytes(TOTAL_REVENUE_KEY);
  if (!Storage.has(key)) return 0;
  return bytesToU64(Storage.get(key));
}

function _getTotalAumFees(): u64 {
  const key = stringToBytes(TOTAL_AUM_FEES_KEY);
  if (!Storage.has(key)) return 0;
  return bytesToU64(Storage.get(key));
}

function _subtractRevenue(amount: u64): void {
  const current = _getTotalRevenue();
  if (amount > current) {
    Storage.set(stringToBytes(TOTAL_REVENUE_KEY), u64ToBytes(0));
  } else {
    Storage.set(stringToBytes(TOTAL_REVENUE_KEY), u64ToBytes(current - amount));
  }
}


function _addRevenue(amount: u64): void {
  const current = _getTotalRevenue();
  Storage.set(stringToBytes(TOTAL_REVENUE_KEY), u64ToBytes(current + amount));
}

function _addAumFees(amount: u64): void {
  const current = _getTotalAumFees();
  Storage.set(stringToBytes(TOTAL_AUM_FEES_KEY), u64ToBytes(current + amount));
}

function _saveVault(owner: string, data: string): void { 
  Storage.set(stringToBytes(_getVaultKey(owner)), stringToBytes(data)); 
}

function _loadVault(owner: string): string { 
  return bytesToString(Storage.get(stringToBytes(_getVaultKey(owner)))); 
}

function _saveDeferredCallId(owner: string, callId: string): void { 
  Storage.set(stringToBytes(_getDeferredCallKey(owner)), stringToBytes(callId)); 
}

function _getDeferredCallId(owner: string): string {
  const key = stringToBytes(_getDeferredCallKey(owner));
  if (!Storage.has(key)) return '';
  return bytesToString(Storage.get(key));
}

function _deleteDeferredCallId(owner: string): void {
  const key = stringToBytes(_getDeferredCallKey(owner));
  if (Storage.has(key)) Storage.del(key);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HEIR TRACKING FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _containsPipe(s: string): bool {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) == 124) return true; // 124 = '|'
  }
  return false;
}

function _addVaultToHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getHeirVaultsKey(heir));
  let owners = '';
  if (Storage.has(key)) owners = bytesToString(Storage.get(key));
  const ownerArr = owners.length > 0 ? owners.split(',') : [];
  let found = false;
  for (let i = 0; i < ownerArr.length; i++) { if (ownerArr[i] == owner) { found = true; break; } }
  if (!found) {
    owners = owners.length > 0 ? owners + ',' + owner : owner;
    Storage.set(key, stringToBytes(owners));
  }
}

function _removeVaultFromHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getHeirVaultsKey(heir));
  if (!Storage.has(key)) return;
  const owners = bytesToString(Storage.get(key));
  const ownerList = owners.split(',');
  let newList: string[] = [];
  for (let i = 0; i < ownerList.length; i++) {
    if (ownerList[i] != owner && ownerList[i].length > 0) newList.push(ownerList[i]);
  }
  if (newList.length > 0) Storage.set(key, stringToBytes(newList.join(',')));
  else Storage.del(key);
}

function _addDistributedToHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getDistributedHeirKey(heir));
  let owners = '';
  if (Storage.has(key)) owners = bytesToString(Storage.get(key));
  const ownerArr = owners.length > 0 ? owners.split(',') : [];
  let found = false;
  for (let i = 0; i < ownerArr.length; i++) { if (ownerArr[i] == owner) { found = true; break; } }
  if (!found) {
    owners = owners.length > 0 ? owners + ',' + owner : owner;
    Storage.set(key, stringToBytes(owners));
  }
}

function _saveDistributedAmount(owner: string, total: u64, perHeir: u64, heirsCount: i32, feeCollected: u64, payload: string = '', arweaveTxId: string = '', encryptedKey: string = ''): void {
  const data = total.toString() + '|' + perHeir.toString() + '|' + heirsCount.toString() + '|' + Context.timestamp().toString() + '|' + feeCollected.toString() + '|' + payload + '|' + arweaveTxId + '|' + encryptedKey;
  Storage.set(stringToBytes(_getDistributedKey(owner)), stringToBytes(data));
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUM FEE CALCULATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _calculateAumFee(balance: u64, feeBps: u64, lastCollection: u64, now: u64): u64 {
  if (feeBps == 0 || balance == 0) return 0;
  if (now <= lastCollection) return 0;
  const timePassed = now - lastCollection;
  // fee = balance * (feeBps / 10000) * (timePassed / MS_PER_YEAR)
  // Minute precision: multiply before divide to avoid rounding to zero.
  // Old formula lost precision: (annualFee / 8760) * (timePassed / 3600000)
  //   -> both divisions truncate independently, fee=0 for small vaults/short intervals
  // New: annualFee * minutesElapsed / MINUTES_PER_YEAR
  //   -> single division, safe for balances up to ~6.8M MAS (covers all tier limits)
  const annualFee = balance * feeBps / BPS_DENOMINATOR;
  const minutesElapsed = timePassed / 60000;
  if (minutesElapsed == 0) return 0;
  const fee = annualFee * minutesElapsed / 525600;
  return fee;
}

function _collectAumFee(parts: string[], now: u64): u64 {
  const tier = U8.parseInt(parts[0]);
  const feeBps = _getAumFeeBps(tier);
  if (feeBps == 0) return 0;
  
  const balance = U64.parseInt(parts[5]);
  const lastCollection = U64.parseInt(parts[11]);
  
  const fee = _calculateAumFee(balance, feeBps, lastCollection, now);
  if (fee == 0) return 0;
  
  // Deduct fee from balance
  const newBalance = balance > fee ? balance - fee : 0;
  parts[5] = newBalance.toString();
  parts[11] = now.toString(); // Update lastFeeCollection
  
  // Accumulate fee in revenue pool (admin withdraws via adminWithdraw)
  // SECURITY: Do NOT transferCoins here — contract holds funds for multiple vaults.
  // Immediate transfer could spend MAS belonging to other vaults.
  if (fee > 0) {
    _addRevenue(fee);
    _addAumFees(fee);
  }
  
  return fee;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUBSCRIPTION HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _isSubscriptionActive(parts: string[], now: u64): bool {
  const tier = U8.parseInt(parts[0]);
  if (tier == TIER_FREE) return true; // FREE tier never expires
  const expiry = U64.parseInt(parts[10]);
  return now < expiry;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEFERRED CALL (ASC) FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _timestampToPeriod(timestampMs: u64): u64 {
  const nowPeriod = currentPeriod();
  const nowTimestamp = Context.timestamp();
  assert(timestampMs > nowTimestamp, 'Target timestamp must be in the future');
  const diffMs = timestampMs - nowTimestamp;
  const diffPeriods = diffMs / PERIOD_DURATION_MS;
  return nowPeriod + diffPeriods;
}

function _scheduleASC(ownerAddress: string, unlockTimestamp: u64, gasDeposit: u64): void {
  const thisContract = Context.callee().toString();
  const args = new Args().add(ownerAddress);
  
  // Limit to max 6 days due to Massa deferred call limit (7 days max)
  const now = Context.timestamp();
  const maxAllowedTimestamp = now + MAX_DEFERRED_INTERVAL;
  const minAllowedTimestamp = now + 60000; // At least 1 minute in the future
  let targetTimestamp = unlockTimestamp < maxAllowedTimestamp ? unlockTimestamp : maxAllowedTimestamp;
  if (targetTimestamp < minAllowedTimestamp) targetTimestamp = minAllowedTimestamp;
  
  const targetPeriod = _timestampToPeriod(targetTimestamp);
  const targetThread = currentThread();
  const targetSlot = new Slot(targetPeriod, targetThread);
  const callId = deferredCallRegister(thisContract, 'triggerDistribution', targetSlot,
  DEFERRED_CALL_GAS, args.serialize(), gasDeposit);
  _saveDeferredCallId(ownerAddress, callId);
  generateEvent('ASC_SCHEDULED:' + ownerAddress + ':period=' + targetPeriod.toString() + ':target=' + targetTimestamp.toString());
}

function _cancelASC(ownerAddress: string): void {
  const callId = _getDeferredCallId(ownerAddress);
  if (callId.length > 0) {
    if (deferredCallExists(callId)) deferredCallCancel(callId);
    _deleteDeferredCallId(ownerAddress);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTRUCTOR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(callerHasWriteAccess(), 'Unauthorized');
  const args = new Args(binaryArgs);
  const oracleAddress = args.nextString().unwrap();
  const adminAddress = args.nextString().unwrap();
  Storage.set(stringToBytes(ORACLE_KEY), stringToBytes(oracleAddress));
  Storage.set(stringToBytes(ADMIN_KEY), stringToBytes(adminAddress));
  Storage.set(stringToBytes(RATE_KEY), u64ToBytes(431)); // Default 431 milicents ($0.00431)
  Storage.set(stringToBytes(INITIALIZED_KEY), u64ToBytes(1));
  Storage.set(stringToBytes(TOTAL_REVENUE_KEY), u64ToBytes(0));
  Storage.set(stringToBytes(TOTAL_AUM_FEES_KEY), u64ToBytes(0));
  generateEvent('CONTRACT_INITIALIZED:oracle=' + oracleAddress + ':admin=' + adminAddress);
}

export function updateRate(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getOracle() || caller == _getAdmin(), 'Only oracle or admin');
  const args = new Args(binaryArgs);
  const newRate = args.nextU64().unwrap();
  assert(newRate > 0 && newRate < 100000000, 'Rate out of range'); // milicents
  // Safety: limit rate change to ±50% per update
  const currentRate = _getMassaUsdRate();
  if (currentRate > 0) {
    const minAllowed: u64 = currentRate / 2;
    const maxAllowed: u64 = currentRate + currentRate / 2;
    assert(newRate >= minAllowed && newRate <= maxAllowed, 'Rate change exceeds 50% limit');
  }
  Storage.set(stringToBytes(RATE_KEY), u64ToBytes(newRate));
  generateEvent('RATE_UPDATED:' + newRate.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CREATE VAULT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * createVault v3 - with subscription model
 * 
 * Arguments:
 * - tier: u8
 * - heirsCount: u32
 * - heirs: string[] (heirsCount items)
 * - interval: u64 (ms)
 * - payload: string
 * - arweaveTxId: string
 * - encryptedKey: string
 * - subscriptionPayment: u64 (subscription payment in nanoMAS)
 * 
 * Transferred coins = subscriptionPayment + gasDeposit + ORACLE_FEE + userBalance
 * Gas deposit is validated against minimum safety floor, but frontend sends recommended amount
 */
export function createVault(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  
  // Check if vault exists and is inactive (can recreate)
  if (_vaultExists(caller)) {
    const oldData = _loadVault(caller);
    const oldParts = oldData.split('|');
    assert(oldParts[4] == '0', 'Vault already active');
    _deleteDeferredCallId(caller);
  }
  
  const transferred = Context.transferredCoins();
  // Early check removed - will check after parsing interval
  
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  assert(tier <= TIER_LEGATE, 'Invalid tier');
  
  // Parse heirs
  const heirsCount = args.nextU32().unwrap();
  const maxHeirs = _getMaxHeirs(tier);
  assert(heirsCount <= maxHeirs as u32, 'Too many heirs for this tier');
  assert(heirsCount > 0, 'Need at least 1 heir');
  
  let heirsArray: string[] = [];
  let heirsData = '';
  for (let i: u32 = 0; i < heirsCount; i++) {
    const heir = args.nextString().unwrap();
    assert(heir != caller, 'Cannot be own heir');
    assert(!_containsPipe(heir), 'Heir address cannot contain pipe');
    assert(!heir.includes(','), 'Heir address cannot contain comma');
    assert(heir.length > 0, 'Heir address cannot be empty');
    for (let j = 0; j < heirsArray.length; j++) {
      assert(heirsArray[j] != heir, 'Duplicate heir address');
    }
    heirsArray.push(heir);
    heirsData += (i > 0 ? ',' : '') + heir;
  }
  
  // Parse interval
  const interval = args.nextU64().unwrap();
  assert(interval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short (min 5 min)');
  assert(interval <= MAX_HEARTBEAT_INTERVAL, 'Interval too long (max 1 year)');
  
  // Parse payload
  const payloadResult = args.nextString();
  const payload = payloadResult.isErr() ? '' : payloadResult.unwrap();
  const payloadSize = payload.length as u32;
  const maxPayload = _getMaxPayload(tier);
  assert(payloadSize <= maxPayload, 'Payload too large for this tier');
  assert(!_containsPipe(payload), 'Payload cannot contain pipe character');
  
  // Parse arweave
  const arweaveResult = args.nextString();
  const arweaveTxId = arweaveResult.isErr() ? '' : arweaveResult.unwrap();
  if (arweaveTxId.length > 0) assert(tier >= TIER_VAULT_PRO, 'Arweave requires PRO+');
  assert(!_containsPipe(arweaveTxId), 'ArweaveTxId cannot contain pipe');
  
  // Parse encrypted key
  const keyResult = args.nextString();
  const encryptedKey = keyResult.isErr() ? '' : keyResult.unwrap();
  assert(!_containsPipe(encryptedKey), 'EncryptedKey cannot contain pipe');
  
  // Parse subscription payment
  const subscriptionPaymentResult = args.nextU64();
  let subscriptionPayment: u64 = 0;
  
  if (subscriptionPaymentResult.isOk()) {
    subscriptionPayment = subscriptionPaymentResult.unwrap();
  } else {
    // Fallback: calculate from rate
    subscriptionPayment = _usdToMassa(_getSubscriptionPriceUsd(tier));
  }
  
  // Check minimum subscription price
  const minSubscription = _getMinSubscriptionMassa(tier);
  if (tier > TIER_FREE) {
    assert(subscriptionPayment >= minSubscription, 'Payment below minimum');
  }
  
  // Calculate amounts - validate gas meets minimum safety floor
  const minGasDeposit = _calcMinGasDeposit(interval);
  const totalDeductions = subscriptionPayment + ORACLE_FEE + minGasDeposit;
  assert(transferred >= totalDeductions, 'Insufficient funds for subscription + gas');
  
  // Gas deposit = everything beyond subscription + oracle + vault balance
  // Frontend sends recommended amount; contract accepts anything above minimum
  let userBalance: u64 = 0;
  let gasDeposit: u64 = 0;
  
  // Parse optional gas deposit hint from frontend
  const gasHintResult = args.nextU64();
  if (gasHintResult.isOk()) {
    const hintedGas = gasHintResult.unwrap();
    // Use hinted gas if it's above minimum, otherwise use minimum
    gasDeposit = hintedGas >= minGasDeposit ? hintedGas : minGasDeposit;
    const neededForGas = subscriptionPayment + ORACLE_FEE + gasDeposit;
    assert(transferred >= neededForGas, 'Insufficient funds for requested gas level');
    userBalance = transferred - neededForGas;
  } else {
    // No gas hint: deduct subscription + oracle + min gas, rest is vault balance
    gasDeposit = minGasDeposit;
    userBalance = transferred - totalDeductions;
  }
  
  // Parse optional explicit vault balance
  const vaultBalanceResult = args.nextU64();
  if (vaultBalanceResult.isOk()) {
    const explicitBalance = vaultBalanceResult.unwrap();
    if (explicitBalance > 0) {
      assert(userBalance >= explicitBalance, 'Vault balance exceeds available funds');
      const excess = userBalance - explicitBalance;
      userBalance = explicitBalance;
      if (excess > 0) {
        _addRevenue(excess);
        generateEvent('EXCESS_TO_REVENUE:' + caller + ':' + excess.toString());
      }
    }
  }
  
  // Check max balance
  const maxBalance = _getMaxBalance(tier);
  assert(userBalance <= maxBalance, 'Balance exceeds tier limit');
  
  // Send subscription payment to admin
  if (subscriptionPayment > 0) {
    const admin = _getAdmin();
    if (admin.length > 0) {
      transferCoins(new Address(admin), subscriptionPayment);
      // Revenue NOT tracked — MAS already left contract via transferCoins
      generateEvent('SUBSCRIPTION_PAID:' + caller + ':tier=' + tier.toString() + ':amount=' + subscriptionPayment.toString());
    }
  }
  
  const now = Context.timestamp();
  const unlockDate = now + interval;
  
  // Calculate subscription expiry
  let subscriptionExpiry: u64 = 0;
  if (tier == TIER_FREE) {
    subscriptionExpiry = U64.MAX_VALUE; // FREE never expires
  } else {
    subscriptionExpiry = now + SUBSCRIPTION_PERIOD;
  }
  
  // Vault data: 12 fields
  // tier|unlockDate|interval|lastPing|isActive|vaultBalance|heirs|payload|arweave|encKey|subscriptionExpiry|lastFeeCollection
  const vaultData = tier.toString() + '|' + 
    unlockDate.toString() + '|' + 
    interval.toString() + '|' + 
    now.toString() + '|' +  // lastPing
    '1|' +  // isActive
    userBalance.toString() + '|' + 
    heirsData + '|' + 
    payload + '|' + 
    arweaveTxId + '|' + 
    encryptedKey + '|' +
    subscriptionExpiry.toString() + '|' +
    now.toString();  // lastFeeCollection
  
  _saveVault(caller, vaultData);
  
  // Register heirs
  for (let i = 0; i < heirsArray.length; i++) {
    _addVaultToHeir(heirsArray[i], caller);
  }
  
  // Schedule ASC with the gas deposit provided by the user
  _scheduleASC(caller, unlockDate, gasDeposit);
  
  generateEvent('VAULT_CREATED:' + caller + ':tier=' + tier.toString() + ':unlockDate=' + unlockDate.toString() + ':subscriptionExpiry=' + subscriptionExpiry.toString() + ':gasDeposit=' + gasDeposit.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PING (with subscription check and AUM fee)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function ping(_binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const transferred = Context.transferredCoins();
  const data = _loadVault(caller);
  const parts = data.split('|');
  
  assert(parts.length >= 12, 'Invalid vault data');
  assert(parts[4] == '1', 'Vault inactive');
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  assert(now < unlockDate, 'Vault expired, cannot ping');
  
  // Check subscription
  assert(_isSubscriptionActive(parts, now), 'SUBSCRIPTION_EXPIRED');
  
  // Calculate AUM fee (owner pays, not from vault balance)
  const tier = U8.parseInt(parts[0]);
  const feeBps = _getAumFeeBps(tier);
  const balance = U64.parseInt(parts[5]);
  const lastCollection = U64.parseInt(parts[11]);
  const aumFee = _calculateAumFee(balance, feeBps, lastCollection, now);
  // Process gas/deposit - owner MUST pay gas, never take from inheritance
  const interval = U64.parseInt(parts[2]);
  
  // Validate minimum gas threshold
  const minGas = _calcMinGasDeposit(interval);
  const minRequired = minGas + ORACLE_FEE + aumFee;
  
  assert(transferred >= minRequired, 'Must pay gas + AUM fee (minimum threshold)');
  
  // Gas funding = transferred minus oracle fee and AUM fee
  // Frontend sends recommended amount based on network conditions
  const gasFunding = transferred - ORACLE_FEE - aumFee;
  
  // Track excess above minimum as admin-withdrawable gas surplus
  if (gasFunding > minGas) {
    const excess = gasFunding - minGas;
    _addGasExcess(excess);
    generateEvent('GAS_EXCESS_ADDED:' + caller + ':' + excess.toString());
  }
  
  // Transfer AUM fee to admin (paid by owner, not from vault)
  if (aumFee > 0) {
    const admin = _getAdmin();
    if (admin.length > 0) {
      transferCoins(new Address(admin), aumFee);
      _addAumFees(aumFee);
    }
    parts[11] = now.toString(); // Update lastFeeCollection
    generateEvent("AUM_FEE_COLLECTED:" + caller + ":" + aumFee.toString());
  }
  
  // Check max balance
  const maxBalance = _getMaxBalance(tier);
  assert(balance <= maxBalance, 'Balance exceeds tier limit');
  
  _cancelASC(caller);
  
  const newUnlockDate = now + interval;
  parts[1] = newUnlockDate.toString();
  parts[3] = now.toString(); // lastPing
  parts[5] = balance.toString(); // Balance unchanged - owner paid AUM fee
  
  _saveVault(caller, parts.join('|'));
  _scheduleASC(caller, newUnlockDate, gasFunding);
  
  generateEvent('PING:' + caller + ':newUnlock=' + newUnlockDate.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEPOSIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function deposit(_binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const amount = Context.transferredCoins();
  assert(amount > 0, 'No coins sent');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault inactive');
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  assert(now < unlockDate, 'Vault expired');
  
  // Block deposit if subscription expired — funds would be locked
  assert(_isSubscriptionActive(parts, now), 'Subscription expired, renew before depositing');
  
  const currentBalance = U64.parseInt(parts[5]);
  const newBalance = currentBalance + amount;
  
  // Check max balance
  const tier = U8.parseInt(parts[0]);
  const maxBalance = _getMaxBalance(tier);
  assert(newBalance <= maxBalance, 'Balance exceeds tier limit');
  
  parts[5] = newBalance.toString();
  _saveVault(caller, parts.join('|'));
  
  generateEvent('DEPOSIT:' + caller + ':' + amount.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RENEW SUBSCRIPTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * renewSubscription - pay to extend subscription
 * 
 * Arguments:
 * - subscriptionPayment: u64 (payment in nanoMAS)
 * 
 * If subscription active: extends from current expiry
 * If subscription expired: extends from now
 */
export function renewSubscription(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const transferred = Context.transferredCoins();
  const data = _loadVault(caller);
  const parts = data.split('|');
  
  assert(parts.length >= 12, 'Invalid vault data');
  assert(parts[4] == '1', 'Vault inactive');
  
  const tier = U8.parseInt(parts[0]);
  assert(tier > TIER_FREE, 'FREE tier has no subscription');
  
  // Parse expected payment
  const args = new Args(binaryArgs);
  const subscriptionPaymentResult = args.nextU64();
  let subscriptionPayment: u64 = 0;
  
  if (subscriptionPaymentResult.isOk()) {
    subscriptionPayment = subscriptionPaymentResult.unwrap();
  } else {
    subscriptionPayment = _usdToMassa(_getSubscriptionPriceUsd(tier));
  }
  
  // Check minimum
  const minSubscription = _getMinSubscriptionMassa(tier);
  assert(subscriptionPayment >= minSubscription, 'Payment below minimum');
  assert(transferred >= subscriptionPayment, 'Insufficient payment');
  
  // Calculate new expiry
  const now = Context.timestamp();
  const currentExpiry = U64.parseInt(parts[10]);
  let newExpiry: u64 = 0;
  
  if (now < currentExpiry) {
    // Still active: extend from current expiry
    newExpiry = currentExpiry + SUBSCRIPTION_PERIOD;
  } else {
    // Expired: extend from now
    newExpiry = now + SUBSCRIPTION_PERIOD;
  }
  
  parts[10] = newExpiry.toString();
  _saveVault(caller, parts.join('|'));
  
  // Send payment to admin
  const admin = _getAdmin();
  if (admin.length > 0) {
    transferCoins(new Address(admin), subscriptionPayment);
    // Revenue NOT tracked — MAS already left contract via transferCoins
  }
  
  // Refund excess
  if (transferred > subscriptionPayment) {
    transferCoins(new Address(caller), transferred - subscriptionPayment);
  }
  
  generateEvent('SUBSCRIPTION_RENEWED:' + caller + ':newExpiry=' + newExpiry.toString() + ':amount=' + subscriptionPayment.toString());
}

/**
 * Create vault with USDC payment
 */
export function createVaultWithUsdc(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  const heirsData = args.nextString().unwrap();
  assert(!_containsPipe(heirsData), 'Heirs data cannot contain pipe');
  const interval = args.nextU64().unwrap();
  const payload = args.nextString().unwrap();
  const arweaveTxId = args.nextString().unwrap();
  const encryptedKey = args.nextString().unwrap();
  assert(!_containsPipe(arweaveTxId), 'ArweaveTxId cannot contain pipe');
  assert(!_containsPipe(encryptedKey), 'EncryptedKey cannot contain pipe');
  
  assert(tier >= TIER_FREE && tier <= TIER_LEGATE, 'Invalid tier');
  assert(interval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short');
  assert(interval <= MAX_HEARTBEAT_INTERVAL, 'Interval too long (max 1 year)');
  
  // Check existing vault
  if (_vaultExists(caller)) {
    const oldData = _loadVault(caller);
    const oldParts = oldData.split('|');
    assert(oldParts[4] == '0', 'Vault already active');
    _deleteDeferredCallId(caller);
  }
  
  // Validate payload size
  const maxPayload = _getMaxPayload(tier);
  assert(payload.length <= i32(maxPayload), 'Payload too large');
  assert(!_containsPipe(payload), 'Payload cannot contain pipe character');
  
  const usdcPrice = _getSubscriptionPriceUsdc(tier);
  // USDC transfer deferred to after state save (checks-effects-interactions)
  
  const transferred = Context.transferredCoins();
  const minGasDeposit = _calcMinGasDeposit(interval);
  const minGas = minGasDeposit + ORACLE_FEE;
  assert(transferred >= minGas, 'Insufficient MAS for gas');
  // Use all MAS beyond oracle fee for gas + vault balance
  const availableForGas = transferred - ORACLE_FEE;
  const gasDeposit = availableForGas > minGasDeposit ? availableForGas : minGasDeposit;
  const userBalance = transferred > ORACLE_FEE + gasDeposit ? transferred - ORACLE_FEE - gasDeposit : 0;
  
  // Parse optional explicit vault balance (last MAS arg)
  const vaultBalanceResultUsdc = args.nextU64();
  let finalUserBalance: u64 = userBalance;
  if (vaultBalanceResultUsdc.isOk()) {
    const explicitBal = vaultBalanceResultUsdc.unwrap();
    if (explicitBal > 0) {
      assert(userBalance >= explicitBal, 'Vault balance exceeds available');
      const excessUsdc = userBalance - explicitBal;
      finalUserBalance = explicitBal;
      if (excessUsdc > 0) {
        _addRevenue(excessUsdc);
        generateEvent('EXCESS_TO_REVENUE:' + caller + ':' + excessUsdc.toString());
      }
    }
  }
  
  const heirsSplit = heirsData.split(',');
  const heirsArray: string[] = [];
  for (let j = 0; j < heirsSplit.length; j++) {
    const heir = heirsSplit[j];
    assert(heir.length > 0, 'Heir address cannot be empty');
    assert(!_containsPipe(heir), 'Heir address cannot contain pipe');
    assert(!heir.includes(','), 'Heir address cannot contain comma');
    assert(heir != caller, 'Cannot be your own heir');
    for (let k = 0; k < heirsArray.length; k++) {
      assert(heirsArray[k] != heir, 'Duplicate heir address');
    }
    heirsArray.push(heir);
  }
  assert(heirsArray.length > 0, 'At least one heir required');
  const maxHeirs = _getMaxHeirs(tier);
  assert(heirsArray.length <= i32(maxHeirs), 'Too many heirs');
  
  const now = Context.timestamp();
  const unlockDate = now + interval;
  const subscriptionExpiry = tier == TIER_FREE ? U64.MAX_VALUE : now + SUBSCRIPTION_PERIOD;
  
  const vaultData = tier.toString() + '|' + unlockDate.toString() + '|' + interval.toString() + '|' + now.toString() + '|1|' + finalUserBalance.toString() + '|' + heirsData + '|' + payload + '|' + arweaveTxId + '|' + encryptedKey + '|' + subscriptionExpiry.toString() + '|' + now.toString();
  _saveVault(caller, vaultData);
  
  for (let i = 0; i < heirsArray.length; i++) {
    if (heirsArray[i].length > 0) _addVaultToHeir(heirsArray[i], caller);
  }
  _scheduleASC(caller, unlockDate, gasDeposit);

  // Interactions last: USDC transfer after all state changes
  if (usdcPrice > 0) {
    _transferUsdcDirect(caller, _getAdmin(), usdcPrice);
  }
  generateEvent('VAULT_CREATED_USDC:' + caller + ':tier=' + tier.toString());
}

/**
 * Renew subscription with USDC
 */
export function renewSubscriptionWithUsdc(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault inactive');
  
  const tier = U8.parseInt(parts[0]);
  assert(tier > TIER_FREE, 'FREE tier no subscription');
  
  const usdcPrice = _getSubscriptionPriceUsdc(tier);
  
  const now = Context.timestamp();
  const currentExpiry = U64.parseInt(parts[10]);
  const newExpiry = now < currentExpiry ? currentExpiry + SUBSCRIPTION_PERIOD : now + SUBSCRIPTION_PERIOD;
  
  parts[10] = newExpiry.toString();
  _saveVault(caller, parts.join('|'));

  // Interactions last: USDC transfer after state save
  _transferUsdcDirect(caller, _getAdmin(), usdcPrice);
  generateEvent('SUBSCRIPTION_RENEWED_USDC:' + caller + ':newExpiry=' + newExpiry.toString());
}

/**
 * Claim inheritance with USDC (if subscription expired)
 */
export function claimInheritanceWithUsdc(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const args = new Args(binaryArgs);
  const ownerAddress = args.nextString().unwrap();
  
  assert(_vaultExists(ownerAddress), 'No vault');
  const data = _loadVault(ownerAddress);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault inactive');
  
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  let isHeir = false;
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i] == caller) { isHeir = true; break; }
  }
  assert(isHeir, 'Not an heir');
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  assert(now >= unlockDate, 'Vault still locked');
  
  const tier = U8.parseInt(parts[0]);
  const subscriptionExpiry = U64.parseInt(parts[10]);
  let claimUsdcPrice: u64 = 0;
  if (tier > TIER_FREE && now >= subscriptionExpiry) {
    claimUsdcPrice = _getSubscriptionPriceUsdc(tier);
  }
  
  const feeCollected = _collectAumFee(parts, now);
  const vaultBalance = U64.parseInt(parts[5]);
  const validHeirs: string[] = [];
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i].length > 0) validHeirs.push(heirs[i]);
  }
  const perHeir = vaultBalance / u64(validHeirs.length);
  const remainder = vaultBalance % u64(validHeirs.length);
  
  for (let i = 0; i < validHeirs.length; i++) {
    let amount = perHeir;
    if (i == 0) amount += remainder;
    if (amount > 0) transferCoins(new Address(validHeirs[i]), amount);
    _removeVaultFromHeir(validHeirs[i], ownerAddress);
  }
  
  _saveDistributedAmount(ownerAddress, vaultBalance, perHeir, validHeirs.length, feeCollected, parts.length > 7 ? parts[7] : '', parts.length > 8 ? parts[8] : '', parts.length > 9 ? parts[9] : '');
  for (let i = 0; i < validHeirs.length; i++) {
    _addDistributedToHeir(validHeirs[i], ownerAddress);
  }
  
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(ownerAddress, parts.join('|'));
  _cancelASC(ownerAddress);

  // Interactions last: USDC transfer after all state changes
  if (claimUsdcPrice > 0) {
    _transferUsdcDirect(caller, _getAdmin(), claimUsdcPrice);
  }
  generateEvent('INHERITANCE_CLAIMED_USDC:' + ownerAddress + ':by=' + caller);
}

export function getSubscriptionPriceUsdc(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return new Args().add(_getSubscriptionPriceUsdc(tier)).serialize();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TRIGGER DISTRIBUTION (ASC callback)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function triggerDistribution(binaryArgs: StaticArray<u8>): void {
  // SECURITY: Only ASC self-calls allowed. External callers must use manualTrigger.
  assert(Context.caller().toString() == Context.callee().toString(), 'Only ASC self-call allowed');

  const receivedCoins = Context.transferredCoins();
  if (receivedCoins < ORACLE_FEE) {
    generateEvent('TRIGGER_REJECTED:insufficient_gas');
    return;
  }
  
  const args = new Args(binaryArgs);
  const ownerResult = args.nextString();
  if (ownerResult.isErr()) {
    generateEvent('TRIGGER_REJECTED:invalid_args');
    return;
  }
  
  const owner = ownerResult.unwrap();
  if (!_vaultExists(owner)) {
    generateEvent('TRIGGER_REJECTED:no_vault');
    return;
  }
  
  const data = _loadVault(owner);
  const parts = data.split('|');
  
  if (parts.length < 12) {
    generateEvent('TRIGGER_REJECTED:invalid_data');
    return;
  }
  
  if (parts[4] != '1') {
    generateEvent('TRIGGER_SKIPPED:inactive');
    return;
  }
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  
  if (now < unlockDate) {
    // Not yet time - reschedule for next check (chain of deferred calls)
    // Safety: ensure enough gas remains for next deferred call
    if (receivedCoins < MIN_GAS_PER_CALL) {
      generateEvent('ASC_CHAIN_BROKEN:' + owner + ':insufficientGas=' + receivedCoins.toString() + ':unlockDate=' + unlockDate.toString());
      // Don't reschedule - vault remains active, heirs can use manualTrigger after unlockDate
      return;
    }
    _scheduleASC(owner, unlockDate, receivedCoins);
    generateEvent('ASC_RESCHEDULED:' + owner + ':nextCheck=' + (now + MAX_DEFERRED_INTERVAL).toString() + ':unlockDate=' + unlockDate.toString() + ':gasRemaining=' + receivedCoins.toString());
    return;
  }
  
  // Check subscription
  if (!_isSubscriptionActive(parts, now)) {
    // Subscription expired - DON'T distribute, wait for heir to pay
    generateEvent('VAULT_UNLOCKED_PENDING_SUBSCRIPTION:' + owner);
    return;
  }
  
  // Execute distribution
  _executeDistribution(owner, parts, receivedCoins, now);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CLAIM INHERITANCE (for heirs)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * claimInheritance - heir claims after vault unlocks
 * 
 * Arguments:
 * - ownerAddress: string
 * - subscriptionPayment: u64 (if subscription expired, heir pays)
 */
export function claimInheritance(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const args = new Args(binaryArgs);
  
  const ownerAddress = args.nextString().unwrap();
  assert(_vaultExists(ownerAddress), 'No vault');
  
  const transferred = Context.transferredCoins();
  const data = _loadVault(ownerAddress);
  const parts = data.split('|');
  
  assert(parts.length >= 12, 'Invalid vault data');
  assert(parts[4] == '1', 'Vault inactive');
  
  // Check caller is heir
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  let isHeir = false;
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i] == caller) {
      isHeir = true;
      break;
    }
  }
  assert(isHeir, 'Not an heir');
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  assert(now >= unlockDate, 'Vault not yet unlocked');
  
  // Check subscription
  const tier = U8.parseInt(parts[0]);
  if (!_isSubscriptionActive(parts, now) && tier > TIER_FREE) {
    // Heir must pay subscription
    const subscriptionPaymentResult = args.nextU64();
    let subscriptionPayment: u64 = 0;
    
    if (subscriptionPaymentResult.isOk()) {
      subscriptionPayment = subscriptionPaymentResult.unwrap();
    } else {
      subscriptionPayment = _usdToMassa(_getSubscriptionPriceUsd(tier));
    }
    
    const minSubscription = _getMinSubscriptionMassa(tier);
    assert(subscriptionPayment >= minSubscription, 'Payment below minimum');
    assert(transferred >= subscriptionPayment, 'Heir must pay subscription');
    
    // Send to admin
    const admin = _getAdmin();
    if (admin.length > 0) {
      transferCoins(new Address(admin), subscriptionPayment);
      // Revenue NOT tracked — MAS already left contract via transferCoins
    }
    
    generateEvent('SUBSCRIPTION_PAID_BY_HEIR:' + caller + ':owner=' + ownerAddress + ':amount=' + subscriptionPayment.toString());
  }
  
  // Execute distribution
  _executeDistribution(ownerAddress, parts, 0, now);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXECUTE DISTRIBUTION (internal)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _executeDistribution(owner: string, parts: string[], receivedCoins: u64, now: u64): void {
  // Collect final AUM fee
  const feeCollected = _collectAumFee(parts, now);
  if (feeCollected > 0) {
    generateEvent('AUM_FEE_COLLECTED:' + owner + ':' + feeCollected.toString());
  }
  
  const vaultBalance = U64.parseInt(parts[5]);
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  
  let validHeirs: string[] = [];
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i].length > 0) validHeirs.push(heirs[i]);
  }
  
  // Distribute only vault balance to heirs, gas deposit stays on contract
  const totalToDistribute = vaultBalance;
  
  if (totalToDistribute > 0 && validHeirs.length > 0) {
    const share = totalToDistribute / (validHeirs.length as u64);
    const remainder = totalToDistribute % (validHeirs.length as u64);
    
    for (let i = 0; i < validHeirs.length; i++) {
      let amount = share;
      if (i == 0) amount += remainder;
      
      if (amount > 0) {
        transferCoins(new Address(validHeirs[i]), amount);
        generateEvent('INHERITANCE_SENT:' + validHeirs[i] + ':' + amount.toString());
      }
    }
    
    _saveDistributedAmount(owner, totalToDistribute, share, validHeirs.length, feeCollected, parts.length > 7 ? parts[7] : "", parts.length > 8 ? parts[8] : "", parts.length > 9 ? parts[9] : "");
  }
  
  // Deactivate vault
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(owner, parts.join('|'));
  _deleteDeferredCallId(owner);
  
  // Update heir tracking
  for (let i = 0; i < validHeirs.length; i++) {
    _addDistributedToHeir(validHeirs[i], owner);
    _removeVaultFromHeir(validHeirs[i], owner);
  }
  
  generateEvent('VAULT_UNLOCKED:' + owner);
  generateEvent('DISTRIBUTION_COMPLETE:' + owner + ':total=' + totalToDistribute.toString() + ':fee=' + feeCollected.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEACTIVATE VAULT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function deactivateVault(_binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Already inactive');
  
  _cancelASC(caller);
  
  // Collect final AUM fee before returning funds
  const now = Context.timestamp();
  const feeCollected = _collectAumFee(parts, now);
  if (feeCollected > 0) {
    generateEvent('AUM_FEE_COLLECTED:' + caller + ':' + feeCollected.toString());
  }
  
  // Return remaining balance
  const vaultBalance = U64.parseInt(parts[5]);
  if (vaultBalance > 0) {
    transferCoins(new Address(caller), vaultBalance);
  }
  
  // Remove from heir lists
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i].length > 0) _removeVaultFromHeir(heirs[i], caller);
  }
  
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(caller, parts.join('|'));
  
  generateEvent('VAULT_DEACTIVATED:' + caller);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UPDATE PAYLOAD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function updatePayload(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault not active');
  
  const args = new Args(binaryArgs);
  const newPayload = args.nextString().unwrap();
  const arweaveTxId = args.nextString().unwrap();
  const encryptedKey = args.nextString().unwrap();
  
  const tier = U8.parseInt(parts[0]);
  const payloadSize = newPayload.length as u32;
  const maxPayload = _getMaxPayload(tier);
  assert(payloadSize <= maxPayload, 'Payload too large');
  assert(!_containsPipe(newPayload), 'Payload cannot contain pipe character');
  assert(!_containsPipe(arweaveTxId), 'ArweaveTxId cannot contain pipe');
  assert(!_containsPipe(encryptedKey), 'EncryptedKey cannot contain pipe');
  
  if (arweaveTxId.length > 0) {
    assert(tier >= TIER_VAULT_PRO, 'Arweave requires PRO+');
  assert(!_containsPipe(arweaveTxId), 'ArweaveTxId cannot contain pipe');
  }
  
  parts[7] = newPayload;
  parts[8] = arweaveTxId;
  parts[9] = encryptedKey;
  
  _saveVault(caller, parts.join('|'));
  generateEvent('PAYLOAD_UPDATED:' + caller);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UPDATE HEIRS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function updateHeirs(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault not active');
  
  const tier = U8.parseInt(parts[0]);
  const maxHeirs = _getMaxHeirs(tier);
  
  // Remove old heirs from tracking
  const oldHeirsStr = parts[6];
  const oldHeirs = oldHeirsStr.split(',');
  for (let i = 0; i < oldHeirs.length; i++) {
    if (oldHeirs[i].length > 0) _removeVaultFromHeir(oldHeirs[i], caller);
  }
  
  // Parse new heirs
  const args = new Args(binaryArgs);
  const heirsCount = args.nextU32().unwrap();
  assert(heirsCount <= maxHeirs as u32, 'Too many heirs');
  assert(heirsCount > 0, 'Need at least 1 heir');
  
  let newHeirsData = '';
  let newHeirsArray: string[] = [];
  for (let i: u32 = 0; i < heirsCount; i++) {
    const heir = args.nextString().unwrap();
    assert(heir != caller, 'Cannot be own heir');
    assert(!_containsPipe(heir), 'Heir address cannot contain pipe');
    assert(!heir.includes(','), 'Heir address cannot contain comma');
    assert(heir.length > 0, 'Heir address cannot be empty');
    for (let j = 0; j < newHeirsArray.length; j++) {
      assert(newHeirsArray[j] != heir, 'Duplicate heir address');
    }
    newHeirsArray.push(heir);
    newHeirsData += (i > 0 ? ',' : '') + heir;
    _addVaultToHeir(heir, caller);
  }
  
  parts[6] = newHeirsData;
  _saveVault(caller, parts.join('|'));
  
  generateEvent('HEIRS_UPDATED:' + caller);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UPDATE INTERVAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function updateInterval(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault not active');
  
  const now = Context.timestamp();
  assert(_isSubscriptionActive(parts, now), 'Subscription expired');
  
  const args = new Args(binaryArgs);
  const newInterval = args.nextU64().unwrap();
  assert(newInterval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short');
  assert(newInterval <= MAX_HEARTBEAT_INTERVAL, 'Interval too long (max 1 year)');
  
  // User must send gas for new ASC registration
  const transferred = Context.transferredCoins();
  const minGas = _calcMinGasDeposit(newInterval) + ORACLE_FEE;
  assert(transferred >= minGas, 'Must send gas for ASC reschedule');
  const gasFunding = transferred - ORACLE_FEE;
  
  // Cancel old ASC (coins returned to contract as gas excess)
  _cancelASC(caller);
  
  // Recalculate unlockDate from lastPing + newInterval
  const lastPing = U64.parseInt(parts[3]);
  const newUnlockDate = lastPing + newInterval;
  
  // If new unlockDate is already in the past, use now + newInterval
  const effectiveUnlockDate = newUnlockDate > now ? newUnlockDate : now + newInterval;
  
  parts[1] = effectiveUnlockDate.toString();
  parts[2] = newInterval.toString();
  _saveVault(caller, parts.join('|'));
  
  // Schedule new ASC with updated timing
  _scheduleASC(caller, effectiveUnlockDate, gasFunding);
  
  generateEvent('INTERVAL_UPDATED:' + caller + ':' + newInterval.toString() + ':newUnlock=' + effectiveUnlockDate.toString());
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// READ-ONLY FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function getVault(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  assert(_vaultExists(owner), 'No vault');
  return Storage.get(stringToBytes(_getVaultKey(owner)));
}

export function getRate(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getMassaUsdRate());
}

export function getSubscriptionPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return u64ToBytes(_usdToMassa(_getSubscriptionPriceUsd(tier)));
}

export function getMinSubscriptionPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return u64ToBytes(_getMinSubscriptionMassa(tier));
}

export function getAumFeeRate(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return u64ToBytes(_getAumFeeBps(tier));
}

export function getAccruedFee(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  assert(_vaultExists(owner), 'No vault');
  
  const data = _loadVault(owner);
  const parts = data.split('|');
  
  const tier = U8.parseInt(parts[0]);
  const feeBps = _getAumFeeBps(tier);
  const balance = U64.parseInt(parts[5]);
  const lastCollection = U64.parseInt(parts[11]);
  const now = Context.timestamp();
  
  const fee = _calculateAumFee(balance, feeBps, lastCollection, now);
  return u64ToBytes(fee);
}

export function getSubscriptionExpiry(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  assert(_vaultExists(owner), 'No vault');
  
  const data = _loadVault(owner);
  const parts = data.split('|');
  
  return u64ToBytes(U64.parseInt(parts[10]));
}

export function getVaultStatus(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  
  if (!_vaultExists(owner)) return stringToBytes('NOT_FOUND');
  
  const data = _loadVault(owner);
  const parts = data.split('|');
  
  if (parts[4] == '0') return stringToBytes('DISTRIBUTED');
  
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  const subscriptionActive = _isSubscriptionActive(parts, now);
  
  if (now >= unlockDate) {
    if (subscriptionActive) return stringToBytes('UNLOCKED_READY');
    else return stringToBytes('UNLOCKED_PENDING_PAYMENT');
  } else {
    if (subscriptionActive) return stringToBytes('ACTIVE');
    else return stringToBytes('FROZEN');
  }
}

export function getTotalRevenue(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getTotalRevenue());
}

export function getTotalAumFees(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getTotalAumFees());
}

export function hasVault(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  return u64ToBytes(_vaultExists(owner) ? 1 : 0);
}

export function getTimeUntilUnlock(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  assert(_vaultExists(owner), 'No vault');
  const data = _loadVault(owner);
  const parts = data.split('|');
  const unlockDate = U64.parseInt(parts[1]);
  const now = Context.timestamp();
  if (now >= unlockDate) return u64ToBytes(0);
  return u64ToBytes(unlockDate - now);
}

export function getDeferredCallId(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  return stringToBytes(_getDeferredCallId(owner));
}

export function getVaultsForHeir(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const heir = args.nextString().unwrap();
  const key = stringToBytes(_getHeirVaultsKey(heir));
  if (!Storage.has(key)) return stringToBytes('');
  return Storage.get(key);
}

export function getDistributedVaultsForHeir(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const heir = args.nextString().unwrap();
  const key = stringToBytes(_getDistributedHeirKey(heir));
  if (!Storage.has(key)) return stringToBytes('');
  return Storage.get(key);
}

export function getDistributedInfo(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  const key = stringToBytes(_getDistributedKey(owner));
  if (!Storage.has(key)) return stringToBytes('');
  return Storage.get(key);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function updateOracle(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  const args = new Args(binaryArgs);
  const newOracle = args.nextString().unwrap();
  Storage.set(stringToBytes(ORACLE_KEY), stringToBytes(newOracle));
  generateEvent('ORACLE_UPDATED:' + newOracle);
}

export function proposeAdmin(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  const args = new Args(binaryArgs);
  const newAdmin = args.nextString().unwrap();
  Storage.set(stringToBytes(PENDING_ADMIN_KEY), stringToBytes(newAdmin));
  generateEvent('ADMIN_PROPOSED:' + newAdmin);
}

export function acceptAdmin(_: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const key = stringToBytes(PENDING_ADMIN_KEY);
  assert(Storage.has(key), 'No pending admin transfer');
  const pending = bytesToString(Storage.get(key));
  assert(caller == pending, 'Only proposed admin can accept');
  Storage.set(stringToBytes(ADMIN_KEY), stringToBytes(caller));
  Storage.del(key);
  generateEvent('ADMIN_TRANSFERRED:' + caller);
}

export function adminWithdraw(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  
  const args = new Args(binaryArgs);
  const amount = args.nextU64().unwrap();
  
  // SECURITY: Only allow withdrawing protocol revenue, not user funds!
  const availableRevenue = _getTotalRevenue();
  assert(amount <= availableRevenue, 'Cannot withdraw more than protocol revenue');
  
  // Subtract from tracked revenue
  _subtractRevenue(amount);
  // Safety: ensure contract keeps enough for all vaults
  assert(balance() >= amount, "Insufficient contract balance");
  
  transferCoins(new Address(caller), amount);
  generateEvent('ADMIN_WITHDRAW:' + amount.toString() + ':remaining=' + (_getTotalRevenue()).toString());
}

// Admin withdraw accumulated gas excess (returned coins from cancelled ASCs)
export function adminWithdrawGasExcess(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  
  const args = new Args(binaryArgs);
  const amount = args.nextU64().unwrap();
  
  const available = _getGasExcess();
  assert(amount <= available, 'Cannot withdraw more than gas excess');
  
  // Safety: ensure contract keeps enough for all vaults
  const contractBal = balance();
  assert(contractBal >= amount, 'Insufficient contract balance');
  _subtractGasExcess(amount);
  transferCoins(new Address(caller), amount);
  generateEvent('ADMIN_GAS_EXCESS_WITHDRAW:' + amount.toString() + ':remaining=' + _getGasExcess().toString());
}
// adminEmergencyWithdraw removed - was duplicate of adminWithdraw


export function manualTrigger(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  const args = new Args(binaryArgs);
  const ownerAddress = args.nextString().unwrap();
  
  // Vault must exist
  assert(_vaultExists(ownerAddress), 'No vault');
  
  const data = _loadVault(ownerAddress);
  const parts = data.split('|');
  
  // Only admin, owner, or a beneficiary of this vault can trigger
  const isAdmin = caller == _getAdmin();
  const isOwner = caller == ownerAddress;
  let isHeir = false;
  const heirsStr = parts[6];
  const heirsArr = heirsStr.split(',');
  for (let i = 0; i < heirsArr.length; i++) {
    if (heirsArr[i] == caller) { isHeir = true; break; }
  }
  assert(isAdmin || isOwner || isHeir, 'Only admin, owner, or heir can trigger');
  
  // SECURITY: Must be past unlockDate to prevent breaking ASC chain
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  assert(now >= unlockDate, 'Vault not yet unlocked, cannot trigger manually');
  
  // Vault must be active
  assert(parts[4] == '1', 'Vault is not active');
  
  // Check subscription
  assert(_isSubscriptionActive(parts, now), 'Subscription expired, heir must pay via claimInheritance');
  
  // Execute distribution directly (bypass triggerDistribution which is ASC-only)
  _executeDistribution(ownerAddress, parts, 0, now);
}
