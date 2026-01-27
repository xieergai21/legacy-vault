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
} from '@massalabs/massa-as-sdk';

import {
  Args,
  stringToBytes,
  bytesToString,
  u64ToBytes,
  bytesToU64,
} from '@massalabs/as-types';

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════════════════════

const VAULT_PREFIX: string = 'VAULT_';
const ORACLE_KEY: string = 'ORACLE';
const RATE_KEY: string = 'RATE';
const ADMIN_KEY: string = 'ADMIN';
const INITIALIZED_KEY: string = 'INIT';
const DEFERRED_CALL_PREFIX: string = 'DC_';
const HEIR_VAULTS_PREFIX: string = 'HEIR_';
const DISTRIBUTED_PREFIX: string = 'DIST_';
const DISTRIBUTED_HEIR_PREFIX: string = 'DISTHEIR_';
const TOTAL_REVENUE_KEY: string = 'REVENUE';
const TOTAL_AUM_FEES_KEY: string = 'AUM_FEES';
const USDC_CONTRACT: string = "AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ";
const USDC_DECIMALS: u64 = 1_000_000; // USDC has 6 decimals

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - PRICING
// ═══════════════════════════════════════════════════════════════════════════

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
const AUM_FEE_LIGHT: u64 = 100;   // 1% annual
const AUM_FEE_PRO: u64 = 50;      // 0.5% annual
const AUM_FEE_LEGATE: u64 = 25;   // 0.25% annual
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
const MIN_HEARTBEAT_INTERVAL: u64 = 86400000; // 1 day in ms
const PERIOD_DURATION_MS: u64 = 16000;

export const MIN_AS_DEPOSIT: u64 = 5 * MASSA_DECIMALS; // 5 MAS for ASC gas
export const ORACLE_FEE: u64 = 10_000_000; // 0.01 MAS
export const DEFERRED_CALL_GAS: u64 = 100_000_000;

// Tiers
export const TIER_FREE: u8 = 0;
export const TIER_LIGHT: u8 = 1;
export const TIER_VAULT_PRO: u8 = 2;
export const TIER_LEGATE: u8 = 3;

// ═══════════════════════════════════════════════════════════════════════════
// KEY GENERATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function _getVaultKey(address: string): string { return VAULT_PREFIX + address; }
function _getDeferredCallKey(address: string): string { return DEFERRED_CALL_PREFIX + address; }
function _getHeirVaultsKey(heir: string): string { return HEIR_VAULTS_PREFIX + heir; }
function _getDistributedKey(owner: string): string { return DISTRIBUTED_PREFIX + owner; }
function _getDistributedHeirKey(heir: string): string { return DISTRIBUTED_HEIR_PREFIX + heir; }
function _vaultExists(address: string): bool { return Storage.has(stringToBytes(_getVaultKey(address))); }

// ═══════════════════════════════════════════════════════════════════════════
// RATE AND PRICING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function _getMassaUsdRate(): u64 {
  const key = stringToBytes(RATE_KEY);
  if (Storage.has(key)) return bytesToU64(Storage.get(key));
  return 5; // Default 5 cents ($0.05)
}

function _usdToMassa(usdCents: u64): u64 {
  const rate = _getMassaUsdRate();
  if (rate == 0) return 0;
  return (usdCents * MASSA_DECIMALS) / rate;
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

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN AND STORAGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════════════════════════
// HEIR TRACKING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function _addVaultToHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getHeirVaultsKey(heir));
  let owners = '';
  if (Storage.has(key)) owners = bytesToString(Storage.get(key));
  if (!owners.includes(owner)) {
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
  if (!owners.includes(owner)) {
    owners = owners.length > 0 ? owners + ',' + owner : owner;
    Storage.set(key, stringToBytes(owners));
  }
}

function _saveDistributedAmount(owner: string, total: u64, perHeir: u64, heirsCount: i32, feeCollected: u64): void {
  const data = total.toString() + '|' + perHeir.toString() + '|' + heirsCount.toString() + '|' + Context.timestamp().toString() + '|' + feeCollected.toString();
  Storage.set(stringToBytes(_getDistributedKey(owner)), stringToBytes(data));
}

// ═══════════════════════════════════════════════════════════════════════════
// AUM FEE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

function _calculateAumFee(balance: u64, feeBps: u64, lastCollection: u64, now: u64): u64 {
  if (feeBps == 0 || balance == 0) return 0;
  const timePassed = now - lastCollection;
  // fee = balance * (feeBps / 10000) * (timePassed / MS_PER_YEAR)
  // Reorder to avoid overflow: balance * feeBps * timePassed / (10000 * MS_PER_YEAR)
  const fee = (balance / 1000) * feeBps * (timePassed / 1000) / (BPS_DENOMINATOR * (MS_PER_YEAR / 1000000));
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
  
  // Transfer fee to admin
  const admin = _getAdmin();
  if (admin.length > 0 && fee > 0) {
    transferCoins(new Address(admin), fee);
    _addAumFees(fee);
  }
  
  return fee;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function _isSubscriptionActive(parts: string[], now: u64): bool {
  const tier = U8.parseInt(parts[0]);
  if (tier == TIER_FREE) return true; // FREE tier never expires
  const expiry = U64.parseInt(parts[10]);
  return now < expiry;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFERRED CALL (ASC) FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function _timestampToPeriod(timestampMs: u64): u64 {
  const nowPeriod = currentPeriod();
  const nowTimestamp = Context.timestamp();
  const diffMs = timestampMs - nowTimestamp;
  const diffPeriods = diffMs / PERIOD_DURATION_MS;
  return nowPeriod + diffPeriods;
}

function _scheduleASC(ownerAddress: string, unlockTimestamp: u64, gasDeposit: u64): void {
  const thisContract = Context.callee().toString();
  const args = new Args().add(ownerAddress);
  const targetPeriod = _timestampToPeriod(unlockTimestamp);
  const targetThread = currentThread();
  const targetSlot = new Slot(targetPeriod, targetThread);
  const callId = deferredCallRegister(thisContract, 'triggerDistribution', targetSlot,
  DEFERRED_CALL_GAS, args.serialize(), gasDeposit);
  _saveDeferredCallId(ownerAddress, callId);
  generateEvent('ASC_SCHEDULED:' + ownerAddress + ':period=' + targetPeriod.toString());
}

function _cancelASC(ownerAddress: string): void {
  const callId = _getDeferredCallId(ownerAddress);
  if (callId.length > 0) {
    if (deferredCallExists(callId)) deferredCallCancel(callId);
    _deleteDeferredCallId(ownerAddress);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR
// ═══════════════════════════════════════════════════════════════════════════

export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(callerHasWriteAccess(), 'Unauthorized');
  const args = new Args(binaryArgs);
  const oracleAddress = args.nextString().unwrap();
  const adminAddress = args.nextString().unwrap();
  Storage.set(stringToBytes(ORACLE_KEY), stringToBytes(oracleAddress));
  Storage.set(stringToBytes(ADMIN_KEY), stringToBytes(adminAddress));
  Storage.set(stringToBytes(RATE_KEY), u64ToBytes(5)); // Default 5 cents
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
  assert(newRate > 0 && newRate < 1000000, 'Rate out of range');
  Storage.set(stringToBytes(RATE_KEY), u64ToBytes(newRate));
  generateEvent('RATE_UPDATED:' + newRate.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE VAULT
// ═══════════════════════════════════════════════════════════════════════════

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
 * Transferred coins = subscriptionPayment + MIN_AS_DEPOSIT + ORACLE_FEE + userBalance
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
  assert(transferred >= MIN_AS_DEPOSIT, 'Send at least 5 MAS');
  
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
    heirsArray.push(heir);
    heirsData += heir + ',';
  }
  
  // Parse interval
  const interval = args.nextU64().unwrap();
  assert(interval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short (min 1 day)');
  
  // Parse payload
  const payloadResult = args.nextString();
  const payload = payloadResult.isErr() ? '' : payloadResult.unwrap();
  const payloadSize = payload.length as u32;
  const maxPayload = _getMaxPayload(tier);
  assert(payloadSize <= maxPayload, 'Payload too large for this tier');
  
  // Parse arweave
  const arweaveResult = args.nextString();
  const arweaveTxId = arweaveResult.isErr() ? '' : arweaveResult.unwrap();
  if (arweaveTxId.length > 0) assert(tier >= TIER_VAULT_PRO, 'Arweave requires PRO+');
  
  // Parse encrypted key
  const keyResult = args.nextString();
  const encryptedKey = keyResult.isErr() ? '' : keyResult.unwrap();
  
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
  
  // Calculate amounts
  const totalDeductions = subscriptionPayment + ORACLE_FEE + MIN_AS_DEPOSIT;
  assert(transferred >= totalDeductions, 'Insufficient funds');
  
  let userBalance: u64 = 0;
  if (transferred > totalDeductions) {
    userBalance = transferred - totalDeductions;
  }
  
  // Check max balance
  const maxBalance = _getMaxBalance(tier);
  assert(userBalance <= maxBalance, 'Balance exceeds tier limit');
  
  // Send subscription payment to admin
  if (subscriptionPayment > 0) {
    const admin = _getAdmin();
    if (admin.length > 0) {
      transferCoins(new Address(admin), subscriptionPayment);
      _addRevenue(subscriptionPayment);
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
  
  // Schedule ASC
  _scheduleASC(caller, unlockDate, MIN_AS_DEPOSIT);
  
  generateEvent('VAULT_CREATED:' + caller + ':tier=' + tier.toString() + ':unlockDate=' + unlockDate.toString() + ':subscriptionExpiry=' + subscriptionExpiry.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// PING (with subscription check and AUM fee)
// ═══════════════════════════════════════════════════════════════════════════

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
  
  // Collect AUM fee first
  const feeCollected = _collectAumFee(parts, now);
  if (feeCollected > 0) {
    generateEvent('AUM_FEE_COLLECTED:' + caller + ':' + feeCollected.toString());
  }
  
  // Process gas/deposit
  const interval = U64.parseInt(parts[2]);
  let currentBalance = U64.parseInt(parts[5]);
  let gasFunding: u64 = 0;
  
  if (transferred >= MIN_AS_DEPOSIT + ORACLE_FEE) {
    gasFunding = MIN_AS_DEPOSIT;
    currentBalance += transferred - MIN_AS_DEPOSIT - ORACLE_FEE;
  } else if (transferred >= ORACLE_FEE) {
    assert(currentBalance >= MIN_AS_DEPOSIT, 'Insufficient balance for gas');
    currentBalance -= MIN_AS_DEPOSIT;
    currentBalance += transferred - ORACLE_FEE;
    gasFunding = MIN_AS_DEPOSIT;
  } else {
    assert(currentBalance >= MIN_AS_DEPOSIT + ORACLE_FEE, 'Insufficient balance');
    currentBalance -= (MIN_AS_DEPOSIT + ORACLE_FEE);
    gasFunding = MIN_AS_DEPOSIT;
  }
  
  // Check max balance
  const tier = U8.parseInt(parts[0]);
  const maxBalance = _getMaxBalance(tier);
  assert(currentBalance <= maxBalance, 'Balance exceeds tier limit');
  
  _cancelASC(caller);
  
  const newUnlockDate = now + interval;
  parts[1] = newUnlockDate.toString();
  parts[3] = now.toString(); // lastPing
  parts[5] = currentBalance.toString();
  
  _saveVault(caller, parts.join('|'));
  _scheduleASC(caller, newUnlockDate, gasFunding);
  
  generateEvent('PING:' + caller + ':newUnlock=' + newUnlockDate.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPOSIT
// ═══════════════════════════════════════════════════════════════════════════

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
  
  // Note: deposit allowed even with expired subscription
  
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

// ═══════════════════════════════════════════════════════════════════════════
// RENEW SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

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
    _addRevenue(subscriptionPayment);
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
  const interval = args.nextU64().unwrap();
  const payload = args.nextString().unwrap();
  const arweaveTxId = args.nextString().unwrap();
  const encryptedKey = args.nextString().unwrap();
  
  assert(tier >= TIER_FREE && tier <= TIER_LEGATE, 'Invalid tier');
  
  const usdcPrice = _getSubscriptionPriceUsdc(tier);
  if (usdcPrice > 0) {
    _transferUsdcFrom(caller, usdcPrice);
    _transferUsdcTo(_getAdmin(), usdcPrice);
  }
  
  const transferred = Context.transferredCoins();
  const minGas = MIN_AS_DEPOSIT + ORACLE_FEE;
  assert(transferred >= minGas, 'Insufficient MAS for gas');
  const userBalance = transferred - minGas;
  
  const heirsArray = heirsData.split(',');
  const maxHeirs = _getMaxHeirs(tier);
  assert(heirsArray.length > 0 && heirsArray.length <= i32(maxHeirs), 'Invalid heirs');
  
  const now = Context.timestamp();
  const unlockDate = now + interval;
  const subscriptionExpiry = now + SUBSCRIPTION_PERIOD;
  
  const vaultData = tier.toString() + '|' + unlockDate.toString() + '|' + interval.toString() + '|' + now.toString() + '|1|' + userBalance.toString() + '|' + heirsData + '|' + payload + '|' + arweaveTxId + '|' + encryptedKey + '|' + subscriptionExpiry.toString() + '|' + now.toString();
  _saveVault(caller, vaultData);
  
  for (let i = 0; i < heirsArray.length; i++) {
    if (heirsArray[i].length > 0) _addVaultToHeir(heirsArray[i], caller);
  }
  _scheduleASC(caller, unlockDate, MIN_AS_DEPOSIT);
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
  _transferUsdcFrom(caller, usdcPrice);
  _transferUsdcTo(_getAdmin(), usdcPrice);
  
  const now = Context.timestamp();
  const currentExpiry = U64.parseInt(parts[10]);
  const newExpiry = now < currentExpiry ? currentExpiry + SUBSCRIPTION_PERIOD : now + SUBSCRIPTION_PERIOD;
  
  parts[10] = newExpiry.toString();
  _saveVault(caller, parts.join('|'));
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
  if (tier > TIER_FREE && now >= subscriptionExpiry) {
    const usdcPrice = _getSubscriptionPriceUsdc(tier);
    _transferUsdcFrom(caller, usdcPrice);
    _transferUsdcTo(_getAdmin(), usdcPrice);
  }
  
  const feeCollected = _collectAumFee(parts, now);
  const vaultBalance = U64.parseInt(parts[5]);
  const validHeirs = heirs.filter(h => h.length > 0);
  const perHeir = vaultBalance / u64(validHeirs.length);
  
  for (let i = 0; i < validHeirs.length; i++) {
    if (perHeir > 0) transferCoins(new Address(validHeirs[i]), perHeir);
    _removeVaultFromHeir(validHeirs[i], ownerAddress);
  }
  
  _saveDistributedAmount(ownerAddress, vaultBalance, perHeir, validHeirs.length, feeCollected);
  for (let i = 0; i < validHeirs.length; i++) {
    _addDistributedToHeir(validHeirs[i], ownerAddress);
  }
  
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(ownerAddress, parts.join('|'));
  _cancelASC(ownerAddress);
  generateEvent('INHERITANCE_CLAIMED_USDC:' + ownerAddress + ':by=' + caller);
}

export function getSubscriptionPriceUsdc(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return new Args().add(_getSubscriptionPriceUsdc(tier)).serialize();
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER DISTRIBUTION (ASC callback)
// ═══════════════════════════════════════════════════════════════════════════

export function triggerDistribution(binaryArgs: StaticArray<u8>): void {
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
    generateEvent('TRIGGER_SKIPPED:not_yet');
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

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM INHERITANCE (for heirs)
// ═══════════════════════════════════════════════════════════════════════════

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
      _addRevenue(subscriptionPayment);
    }
    
    generateEvent('SUBSCRIPTION_PAID_BY_HEIR:' + caller + ':owner=' + ownerAddress + ':amount=' + subscriptionPayment.toString());
  }
  
  // Execute distribution
  _executeDistribution(ownerAddress, parts, 0, now);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE DISTRIBUTION (internal)
// ═══════════════════════════════════════════════════════════════════════════

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
  
  const totalToDistribute = vaultBalance + receivedCoins;
  
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
    
    _saveDistributedAmount(owner, totalToDistribute, share, validHeirs.length, feeCollected);
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

// ═══════════════════════════════════════════════════════════════════════════
// DEACTIVATE VAULT
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════

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
  
  if (arweaveTxId.length > 0) {
    assert(tier >= TIER_VAULT_PRO, 'Arweave requires PRO+');
  }
  
  parts[7] = newPayload;
  parts[8] = arweaveTxId;
  parts[9] = encryptedKey;
  
  _saveVault(caller, parts.join('|'));
  generateEvent('PAYLOAD_UPDATED:' + caller);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE HEIRS
// ═══════════════════════════════════════════════════════════════════════════

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
  for (let i: u32 = 0; i < heirsCount; i++) {
    const heir = args.nextString().unwrap();
    assert(heir != caller, 'Cannot be own heir');
    newHeirsData += heir + ',';
    _addVaultToHeir(heir, caller);
  }
  
  parts[6] = newHeirsData;
  _saveVault(caller, parts.join('|'));
  
  generateEvent('HEIRS_UPDATED:' + caller);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE INTERVAL
// ═══════════════════════════════════════════════════════════════════════════

export function updateInterval(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault not active');
  
  const args = new Args(binaryArgs);
  const newInterval = args.nextU64().unwrap();
  assert(newInterval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short');
  
  parts[2] = newInterval.toString();
  _saveVault(caller, parts.join('|'));
  
  generateEvent('INTERVAL_UPDATED:' + caller + ':' + newInterval.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// READ-ONLY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function updateOracle(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  const args = new Args(binaryArgs);
  const newOracle = args.nextString().unwrap();
  Storage.set(stringToBytes(ORACLE_KEY), stringToBytes(newOracle));
  generateEvent('ORACLE_UPDATED:' + newOracle);
}

export function transferAdmin(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  const args = new Args(binaryArgs);
  const newAdmin = args.nextString().unwrap();
  Storage.set(stringToBytes(ADMIN_KEY), stringToBytes(newAdmin));
  generateEvent('ADMIN_TRANSFERRED:' + newAdmin);
}

export function adminWithdraw(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getAdmin(), 'Only admin');
  const args = new Args(binaryArgs);
  const amount = args.nextU64().unwrap();
  transferCoins(new Address(caller), amount);
  generateEvent('ADMIN_WITHDRAW:' + amount.toString());
}

export function manualTrigger(binaryArgs: StaticArray<u8>): void {
  triggerDistribution(binaryArgs);
}
