/**
 * LEGACY VAULT - AUTONOMOUS SMART CONTRACT v2.1
 * Decentralized version with dynamic pricing and distribution history
 * 
 * Changes v2.1:
 * - Added distribution history for heirs (DISTRIBUTED_HEIR_PREFIX)
 * - Heirs can now find all vaults that were distributed to them
 * 
 * Changes v2:
 * - Removed dependency on internal RATE for price validation
 * - Frontend passes tierPayment as separate argument
 * - Contract accepts payment and sends to admin
 * - RATE used only for read-only functions (getTierPrice)
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
} from '@massalabs/massa-as-sdk';

import {
  Args,
  stringToBytes,
  bytesToString,
  u64ToBytes,
  bytesToU64,
} from '@massalabs/as-types';

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

// Prices in USD cents (for reference, not for validation)
const TIER_PRICE_FREE: u64 = 0;
const TIER_PRICE_LIGHT: u64 = 999;      // $9.99
const TIER_PRICE_VAULT_PRO: u64 = 2999; // $29.99
const TIER_PRICE_LEGATE: u64 = 8999;    // $89.99

// Minimum prices in MAS (protection against free usage of paid tiers)
const MIN_TIER_PRICE_LIGHT: u64 = 50_000_000_000;     // 50 MAS minimum
const MIN_TIER_PRICE_VAULT_PRO: u64 = 150_000_000_000; // 150 MAS minimum  
const MIN_TIER_PRICE_LEGATE: u64 = 450_000_000_000;   // 450 MAS minimum

const MAX_HEIRS_FREE: u8 = 1;
const MAX_HEIRS_LIGHT: u8 = 3;
const MAX_HEIRS_UNLIMITED: u8 = 255;

const MAX_PAYLOAD_FREE: u32 = 25;
const MAX_PAYLOAD_LIGHT: u32 = 1024;
const MAX_PAYLOAD_PRO: u32 = 2048;
const MAX_PAYLOAD_LEGATE: u32 = 2048;

const MIN_HEARTBEAT_INTERVAL: u64 = 86400000;
const PERIOD_DURATION_MS: u64 = 16000;
const MASSA_DECIMALS: u64 = 1_000_000_000;

export const MIN_AS_DEPOSIT: u64 = 5 * MASSA_DECIMALS;
export const ORACLE_FEE: u64 = 10_000_000;
export const DEFERRED_CALL_GAS: u64 = 100_000_000;

export const TIER_FREE: u8 = 0;
export const TIER_LIGHT: u8 = 1;
export const TIER_VAULT_PRO: u8 = 2;
export const TIER_LEGATE: u8 = 3;

// ===== KEY GENERATION FUNCTIONS =====

function _getVaultKey(address: string): string { return VAULT_PREFIX + address; }
function _getDeferredCallKey(address: string): string { return DEFERRED_CALL_PREFIX + address; }
function _getHeirVaultsKey(heir: string): string { return HEIR_VAULTS_PREFIX + heir; }
function _getDistributedKey(owner: string): string { return DISTRIBUTED_PREFIX + owner; }
function _getDistributedHeirKey(heir: string): string { return DISTRIBUTED_HEIR_PREFIX + heir; }
function _vaultExists(address: string): bool { return Storage.has(stringToBytes(_getVaultKey(address))); }

// ===== RATE AND PRICING FUNCTIONS =====

function _getMassaUsdRate(): u64 {
  const key = stringToBytes(RATE_KEY);
  if (Storage.has(key)) { return bytesToU64(Storage.get(key)); }
  return 5; // Default 5 cents ($0.05)
}

// For read-only: approximate tier price
function _usdToMassa(usdCents: u64): u64 {
  const rate = _getMassaUsdRate();
  if (rate == 0) return 0;
  return (usdCents * MASSA_DECIMALS) / rate;
}

function _getTierPriceUsd(tier: u8): u64 {
  if (tier == TIER_FREE) return TIER_PRICE_FREE;
  if (tier == TIER_LIGHT) return TIER_PRICE_LIGHT;
  if (tier == TIER_VAULT_PRO) return TIER_PRICE_VAULT_PRO;
  if (tier == TIER_LEGATE) return TIER_PRICE_LEGATE;
  return 0;
}

// Minimum price in MAS (protection)
function _getMinTierPriceMassa(tier: u8): u64 {
  if (tier == TIER_FREE) return 0;
  if (tier == TIER_LIGHT) return MIN_TIER_PRICE_LIGHT;
  if (tier == TIER_VAULT_PRO) return MIN_TIER_PRICE_VAULT_PRO;
  if (tier == TIER_LEGATE) return MIN_TIER_PRICE_LEGATE;
  return 0;
}

function _getMaxHeirs(tier: u8): u8 {
  if (tier == TIER_FREE) return MAX_HEIRS_FREE;
  if (tier == TIER_LIGHT) return MAX_HEIRS_LIGHT;
  return MAX_HEIRS_UNLIMITED;
}

// ===== ADMIN AND ORACLE FUNCTIONS =====

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

function _addRevenue(amount: u64): void {
  const current = _getTotalRevenue();
  Storage.set(stringToBytes(TOTAL_REVENUE_KEY), u64ToBytes(current + amount));
}

// ===== VAULT STORAGE FUNCTIONS =====

function _saveVault(owner: string, data: string): void { Storage.set(stringToBytes(_getVaultKey(owner)), stringToBytes(data)); }
function _loadVault(owner: string): string { return bytesToString(Storage.get(stringToBytes(_getVaultKey(owner)))); }
function _saveDeferredCallId(owner: string, callId: string): void { Storage.set(stringToBytes(_getDeferredCallKey(owner)), stringToBytes(callId)); }

function _getDeferredCallId(owner: string): string {
  const key = stringToBytes(_getDeferredCallKey(owner));
  if (!Storage.has(key)) return '';
  return bytesToString(Storage.get(key));
}

function _deleteDeferredCallId(owner: string): void {
  const key = stringToBytes(_getDeferredCallKey(owner));
  if (Storage.has(key)) { Storage.del(key); }
}

// ===== HEIR TRACKING FUNCTIONS =====

// Add vault to heir's active list
function _addVaultToHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getHeirVaultsKey(heir));
  let owners = '';
  if (Storage.has(key)) { owners = bytesToString(Storage.get(key)); }
  if (!owners.includes(owner)) {
    owners = owners.length > 0 ? owners + ',' + owner : owner;
    Storage.set(key, stringToBytes(owners));
  }
}

// Remove vault from heir's active list
function _removeVaultFromHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getHeirVaultsKey(heir));
  if (!Storage.has(key)) return;
  const owners = bytesToString(Storage.get(key));
  const ownerList = owners.split(',');
  let newList: string[] = [];
  for (let i = 0; i < ownerList.length; i++) {
    if (ownerList[i] != owner && ownerList[i].length > 0) { newList.push(ownerList[i]); }
  }
  if (newList.length > 0) { Storage.set(key, stringToBytes(newList.join(','))); }
  else { Storage.del(key); }
}

// Add vault to heir's distribution history
function _addDistributedToHeir(heir: string, owner: string): void {
  const key = stringToBytes(_getDistributedHeirKey(heir));
  let owners = '';
  if (Storage.has(key)) { owners = bytesToString(Storage.get(key)); }
  if (!owners.includes(owner)) {
    owners = owners.length > 0 ? owners + ',' + owner : owner;
    Storage.set(key, stringToBytes(owners));
  }
}

// Save distribution info for owner
function _saveDistributedAmount(owner: string, total: u64, perHeir: u64, heirsCount: i32): void {
  const data = total.toString() + '|' + perHeir.toString() + '|' + heirsCount.toString() + '|' + Context.timestamp().toString();
  Storage.set(stringToBytes(_getDistributedKey(owner)), stringToBytes(data));
}

// ===== DEFERRED CALL (ASC) FUNCTIONS =====

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
  const callId = deferredCallRegister(thisContract, 'triggerDistribution', targetSlot, DEFERRED_CALL_GAS, args.serialize(), gasDeposit);
  _saveDeferredCallId(ownerAddress, callId);
  generateEvent('ASC_SCHEDULED:' + ownerAddress + ':period=' + targetPeriod.toString());
}

function _cancelASC(ownerAddress: string): void {
  const callId = _getDeferredCallId(ownerAddress);
  if (callId.length > 0) {
    if (deferredCallExists(callId)) { deferredCallCancel(callId); }
    _deleteDeferredCallId(ownerAddress);
  }
}

// ===== CONSTRUCTOR =====

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
  generateEvent('CONTRACT_INITIALIZED:oracle=' + oracleAddress + ':admin=' + adminAddress);
}

// Oracle can update rate for read-only functions
export function updateRate(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(caller == _getOracle() || caller == _getAdmin(), 'Only oracle or admin');
  const args = new Args(binaryArgs);
  const newRate = args.nextU64().unwrap();
  assert(newRate > 0 && newRate < 1000000, 'Rate out of range');
  Storage.set(stringToBytes(RATE_KEY), u64ToBytes(newRate));
  generateEvent('RATE_UPDATED:' + newRate.toString());
}

// ===== MAIN VAULT FUNCTIONS =====

/**
 * createVault v2 - with explicit tier payment
 * 
 * Arguments:
 * - tier: u8
 * - heirsCount: u32
 * - heirs: string[] (heirsCount items)
 * - interval: u64 (ms)
 * - payload: string
 * - arweaveTxId: string
 * - encryptedKey: string
 * - tierPayment: u64 (tier payment in nanoMAS, calculated by frontend)
 * 
 * Transferred coins = tierPayment + MIN_AS_DEPOSIT + ORACLE_FEE + userBalance
 */
export function createVault(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
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
  
  const heirsCount = args.nextU32().unwrap();
  const maxHeirs = _getMaxHeirs(tier);
  assert(heirsCount <= maxHeirs as u32, 'Too many heirs');
  assert(heirsCount > 0, 'Need at least 1 heir');
  
  let heirsArray: string[] = [];
  let heirsData = '';
  for (let i: u32 = 0; i < heirsCount; i++) {
    const heir = args.nextString().unwrap();
    assert(heir != caller, 'Cannot be own heir');
    heirsArray.push(heir);
    heirsData += heir + ',';
  }
  
  const interval = args.nextU64().unwrap();
  assert(interval >= MIN_HEARTBEAT_INTERVAL, 'Interval too short');
  
  const payloadResult = args.nextString();
  const payload = payloadResult.isErr() ? '' : payloadResult.unwrap();
  const payloadSize = payload.length as u32;
  if (tier == 0) { assert(payloadSize <= MAX_PAYLOAD_FREE, 'Payload too large'); }
  else if (tier == 1) { assert(payloadSize <= MAX_PAYLOAD_LIGHT, 'Payload too large'); }
  else { assert(payloadSize <= MAX_PAYLOAD_PRO, 'Payload too large'); }
  
  const arweaveResult = args.nextString();
  const arweaveTxId = arweaveResult.isErr() ? '' : arweaveResult.unwrap();
  if (arweaveTxId.length > 0) { assert(tier >= 2, 'Arweave requires PRO+'); }
  
  const keyResult = args.nextString();
  const encryptedKey = keyResult.isErr() ? '' : keyResult.unwrap();
  
  // tierPayment passed explicitly from frontend
  const tierPaymentResult = args.nextU64();
  let tierPayment: u64 = 0;
  
  if (tierPaymentResult.isOk()) {
    tierPayment = tierPaymentResult.unwrap();
  } else {
    // Fallback: use old logic with RATE
    tierPayment = _usdToMassa(_getTierPriceUsd(tier));
  }
  
  // Check minimum price (protection against exploits)
  const minPrice = _getMinTierPriceMassa(tier);
  if (tier > 0) {
    assert(tierPayment >= minPrice, 'Payment below minimum');
  }
  
  // Calculation
  const totalDeductions = tierPayment + ORACLE_FEE + MIN_AS_DEPOSIT;
  assert(transferred >= totalDeductions, 'Insufficient funds');
  
  let userBalance: u64 = 0;
  if (transferred > totalDeductions) { 
    userBalance = transferred - totalDeductions; 
  }
  
  // Send payment to admin
  if (tierPayment > 0) {
    const admin = _getAdmin();
    if (admin.length > 0) { 
      transferCoins(new Address(admin), tierPayment);
      _addRevenue(tierPayment);
      generateEvent('TIER_PAID:' + caller + ':tier=' + tier.toString() + ':amount=' + tierPayment.toString());
    }
  }
  
  const now = Context.timestamp();
  const unlockDate = now + interval;
  const vaultData = tier.toString() + '|' + unlockDate.toString() + '|' + interval.toString() + '|' + now.toString() + '|1|' + userBalance.toString() + '|' + heirsData + '|' + payload + '|' + arweaveTxId + '|' + encryptedKey;
  _saveVault(caller, vaultData);
  
  for (let i = 0; i < heirsArray.length; i++) { _addVaultToHeir(heirsArray[i], caller); }
  _scheduleASC(caller, unlockDate, MIN_AS_DEPOSIT);
  
  generateEvent('VAULT_CREATED:' + caller + ':tier=' + tier.toString() + ':unlockDate=' + unlockDate.toString());
}

export function ping(binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  const transferred = Context.transferredCoins();
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts.length >= 10, 'Invalid vault');
  assert(parts[4] == '1', 'Vault inactive');
  const unlockDate = U64.parseInt(parts[1]);
  const now = Context.timestamp();
  assert(now < unlockDate, 'Vault expired, cannot ping');
  const interval = U64.parseInt(parts[2]);
  let currentBalance = U64.parseInt(parts[5]);
  let gasFunding: u64 = 0;
  if (transferred >= MIN_AS_DEPOSIT + ORACLE_FEE) {
    gasFunding = MIN_AS_DEPOSIT;
    currentBalance += transferred - MIN_AS_DEPOSIT - ORACLE_FEE;
  } else if (transferred >= ORACLE_FEE) {
    assert(currentBalance >= MIN_AS_DEPOSIT, 'Insufficient balance');
    currentBalance -= MIN_AS_DEPOSIT;
    currentBalance += transferred - ORACLE_FEE;
    gasFunding = MIN_AS_DEPOSIT;
  } else {
    assert(currentBalance >= MIN_AS_DEPOSIT + ORACLE_FEE, 'Insufficient balance');
    currentBalance -= (MIN_AS_DEPOSIT + ORACLE_FEE);
    gasFunding = MIN_AS_DEPOSIT;
  }
  _cancelASC(caller);
  const newUnlockDate = now + interval;
  parts[1] = newUnlockDate.toString();
  parts[3] = now.toString();
  parts[5] = currentBalance.toString();
  _saveVault(caller, parts.join('|'));
  _scheduleASC(caller, newUnlockDate, gasFunding);
  generateEvent('PING:' + caller + ':newUnlock=' + newUnlockDate.toString());
}

export function deposit(_binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  const amount = Context.transferredCoins();
  assert(amount > 0, 'No coins');
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Vault inactive');
  const unlockDate = U64.parseInt(parts[1]);
  const now = Context.timestamp();
  assert(now < unlockDate, 'Vault expired, cannot ping');
  const currentBalance = U64.parseInt(parts[5]);
  parts[5] = (currentBalance + amount).toString();
  _saveVault(caller, parts.join('|'));
  generateEvent('DEPOSIT:' + caller + ':' + amount.toString());
}

/**
 * triggerDistribution - called by deferred call when vault unlocks
 * Distributes funds to heirs and saves distribution history
 */
export function triggerDistribution(binaryArgs: StaticArray<u8>): void {
  const receivedCoins = Context.transferredCoins();
  if (receivedCoins < ORACLE_FEE) { generateEvent('TRIGGER_REJECTED:insufficient_gas'); return; }
  const args = new Args(binaryArgs);
  const ownerResult = args.nextString();
  if (ownerResult.isErr()) { generateEvent('TRIGGER_REJECTED:invalid_args'); return; }
  const owner = ownerResult.unwrap();
  if (!_vaultExists(owner)) { generateEvent('TRIGGER_REJECTED:no_vault'); return; }
  const data = _loadVault(owner);
  const parts = data.split('|');
  if (parts.length < 10) { generateEvent('TRIGGER_REJECTED:invalid_data'); return; }
  if (parts[4] != '1') { generateEvent('TRIGGER_SKIPPED:inactive'); return; }
  const now = Context.timestamp();
  const unlockDate = U64.parseInt(parts[1]);
  if (now < unlockDate) { generateEvent('TRIGGER_SKIPPED:not_yet'); return; }
  const vaultBalance = U64.parseInt(parts[5]);
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  let validHeirs: string[] = [];
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i].length > 0) { validHeirs.push(heirs[i]); }
  }
  const totalToDistribute = vaultBalance + receivedCoins;
  if (totalToDistribute > 0 && validHeirs.length > 0) {
    const share = totalToDistribute / (validHeirs.length as u64);
    const remainder = totalToDistribute % (validHeirs.length as u64);
    for (let i = 0; i < validHeirs.length; i++) {
      let amount = share;
      if (i == 0) { amount += remainder; }
      if (amount > 0) {
        transferCoins(new Address(validHeirs[i]), amount);
        generateEvent('INHERITANCE_SENT:' + validHeirs[i] + ':' + amount.toString());
      }
    }
    _saveDistributedAmount(owner, totalToDistribute, share, validHeirs.length);
  }
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(owner, parts.join('|'));
  _deleteDeferredCallId(owner);
  
  // Update heir tracking: move from active to distributed history
  for (let i = 0; i < validHeirs.length; i++) { 
    _addDistributedToHeir(validHeirs[i], owner);  // Add to distribution history
    _removeVaultFromHeir(validHeirs[i], owner);   // Remove from active vaults
  }
  
  generateEvent('VAULT_UNLOCKED:' + owner);
  generateEvent('DISTRIBUTION_COMPLETE:' + owner + ':total=' + totalToDistribute.toString());
}

export function deactivateVault(_binaryArgs: StaticArray<u8>): void {
  const caller = Context.caller().toString();
  assert(_vaultExists(caller), 'No vault');
  const data = _loadVault(caller);
  const parts = data.split('|');
  assert(parts[4] == '1', 'Already inactive');
  _cancelASC(caller);
  const vaultBalance = U64.parseInt(parts[5]);
  if (vaultBalance > 0) { transferCoins(new Address(caller), vaultBalance); }
  const heirsStr = parts[6];
  const heirs = heirsStr.split(',');
  for (let i = 0; i < heirs.length; i++) {
    if (heirs[i].length > 0) { _removeVaultFromHeir(heirs[i], caller); }
  }
  parts[4] = '0';
  parts[5] = '0';
  _saveVault(caller, parts.join('|'));
  generateEvent('VAULT_DEACTIVATED:' + caller);
}

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
  if (tier == 0) { assert(payloadSize <= MAX_PAYLOAD_FREE, 'Payload too large'); }
  else if (tier == 1) { assert(payloadSize <= MAX_PAYLOAD_LIGHT, 'Payload too large'); }
  else { assert(payloadSize <= MAX_PAYLOAD_PRO, 'Payload too large'); }
  
  if (arweaveTxId.length > 0) { assert(tier >= 2, 'Arweave requires PRO+'); }
  
  parts[7] = newPayload;
  parts[8] = arweaveTxId;
  parts[9] = encryptedKey;
  
  _saveVault(caller, parts.join('|'));
  generateEvent('PAYLOAD_UPDATED:' + caller);
}

// ===== READ-ONLY FUNCTIONS =====

export function getVault(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  assert(_vaultExists(owner), 'No vault');
  return Storage.get(stringToBytes(_getVaultKey(owner)));
}

export function getRate(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getMassaUsdRate());
}

export function getTierPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return u64ToBytes(_usdToMassa(_getTierPriceUsd(tier)));
}

export function getMinTierPrice(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tier = args.nextU8().unwrap();
  return u64ToBytes(_getMinTierPriceMassa(tier));
}

export function getTotalRevenue(_binaryArgs: StaticArray<u8>): StaticArray<u8> {
  return u64ToBytes(_getTotalRevenue());
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
  if (now >= unlockDate) { return u64ToBytes(0); }
  return u64ToBytes(unlockDate - now);
}

export function getDeferredCallId(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  return stringToBytes(_getDeferredCallId(owner));
}

// Get active vaults where address is listed as heir
export function getVaultsForHeir(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const heir = args.nextString().unwrap();
  const key = stringToBytes(_getHeirVaultsKey(heir));
  if (!Storage.has(key)) { return stringToBytes(''); }
  return Storage.get(key);
}

// Get distributed vaults where address received inheritance
export function getDistributedVaultsForHeir(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const heir = args.nextString().unwrap();
  const key = stringToBytes(_getDistributedHeirKey(heir));
  if (!Storage.has(key)) { return stringToBytes(''); }
  return Storage.get(key);
}

// Get distribution info for a vault owner
export function getDistributedInfo(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const owner = args.nextString().unwrap();
  const key = stringToBytes(_getDistributedKey(owner));
  if (!Storage.has(key)) { return stringToBytes(''); }
  return Storage.get(key);
}

// ===== ADMIN FUNCTIONS =====

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
