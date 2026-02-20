/**
 * LEGACY VAULT v3.0 — COMPREHENSIVE E2E TEST SUITE
 * 
 * Тестирует ВСЕ функции контракта на buildnet.
 * 
 * ТРЕБОВАНИЯ:
 * - .env с DEPLOYER_PRIVATE_KEY (owner/admin кошелёк)
 * - .env с HEIR_PRIVATE_KEY (второй кошелёк для heir тестов)
 * - .env с CONTRACT_ADDRESS
 * - Оба кошелька с балансом >= 15,000 MAS на buildnet
 * 
 * ЗАПУСК:
 *   npx ts-node --esm test-full.ts [phase]
 * 
 * Фазы:
 *   1  — Read-only: rate, prices, statuses
 *   2  — Create FREE vault (5-min interval)
 *   3  — Ping + AUM fee verification
 *   4  — Deposit + balance check
 *   5  — Update payload, heirs, interval
 *   6  — Deactivate + refund verification
 *   7  — Create LIGHT vault (subscription + AUM)
 *   8  — Wait for ASC auto-distribution (5 min)
 *   9  — Heir claim (manual) — requires HEIR_PRIVATE_KEY
 *   10 — Admin functions (withdraw, gas excess)
 *   11 — Subscription renewal
 *   12 — Full lifecycle: create → ping → wait → distribute → heir reads history
 *   all — Run phases 1-7, 10-11 (skip waiting phases)
 */

import * as dotenv from 'dotenv';
import {
  Account,
  Web3Provider,
  SmartContract,
  Args,
} from '@massalabs/massa-web3';

dotenv.config();

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'AS12KEe3PbozW3eQeit2MqFWRWenQhsDcY1xncUDKqGchujdSkD9s';
const OWNER_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const HEIR_KEY = process.env.HEIR_PRIVATE_KEY || '';

const FIVE_MINUTES_MS = 300_000;
const ONE_DAY_MS = 86_400_000;

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function toNano(massa: number): bigint {
  return BigInt(Math.floor(massa * 1_000_000_000));
}

function fromNano(nano: bigint | string | number): number {
  const bn = BigInt(nano);
  return Number(bn) / 1_000_000_000;
}

function fmtMas(nano: bigint | string | number): string {
  return fromNano(nano).toFixed(4) + ' MAS';
}

function fmtDate(ms: number | bigint): string {
  return new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19);
}

const TIER_NAMES = ['FREE', 'LIGHT', 'PRO', 'LEGATE'];
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '🟢', FROZEN: '🔵', UNLOCKED_READY: '🟡',
  UNLOCKED_PENDING_PAYMENT: '🟠', DISTRIBUTED: '⚫', NOT_FOUND: '⚪',
};

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function PASS(msg: string) { passCount++; console.log(`  ✅ ${msg}`); }
function FAIL(msg: string) { failCount++; console.log(`  ❌ ${msg}`); }
function SKIP(msg: string) { skipCount++; console.log(`  ⏭️  ${msg}`); }
function INFO(msg: string) { console.log(`  ℹ️  ${msg}`); }
function HEADER(title: string) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${title}`);
  console.log('═'.repeat(65));
}
function SUBHEADER(title: string) { console.log(`\n  ── ${title} ──`); }

// ══════════════════════════════════════════════
// CORE: Read vault data
// ══════════════════════════════════════════════

interface VaultData {
  tier: number; unlockDate: number; interval: number; lastPing: number;
  isActive: boolean; balance: bigint; heirs: string[]; payload: string;
  arweaveTxId: string; encryptedKey: string; subscriptionExpiry: number;
  lastFeeCollection: number;
}

async function readVault(contract: SmartContract, owner: string): Promise<VaultData | null> {
  try {
    const res = await contract.read('getVault', new Args().addString(owner).serialize());
    const raw = new TextDecoder().decode(res.value);
    const p = raw.split('|');
    if (p.length < 12) return null;
    return {
      tier: parseInt(p[0]), unlockDate: parseInt(p[1]), interval: parseInt(p[2]),
      lastPing: parseInt(p[3]), isActive: p[4] === '1', balance: BigInt(p[5]),
      heirs: p[6].split(',').filter(h => h.length > 0), payload: p[7],
      arweaveTxId: p[8], encryptedKey: p[9],
      subscriptionExpiry: parseInt(p[10]), lastFeeCollection: parseInt(p[11]),
    };
  } catch { return null; }
}

async function readStatus(contract: SmartContract, owner: string): Promise<string> {
  try {
    const res = await contract.read('getVaultStatus', new Args().addString(owner).serialize());
    return new TextDecoder().decode(res.value);
  } catch { return 'ERROR'; }
}

async function readU64(contract: SmartContract, fn: string, args: Uint8Array = new Args().serialize()): Promise<bigint> {
  const res = await contract.read(fn, args);
  return new Args(res.value).nextU64();
}

async function readStr(contract: SmartContract, fn: string, args: Uint8Array): Promise<string> {
  const res = await contract.read(fn, args);
  return new TextDecoder().decode(res.value);
}

async function getStorageU64(provider: Web3Provider, key: string): Promise<bigint> {
  const storage = await provider.readStorage(CONTRACT_ADDRESS, [new TextEncoder().encode(key)]);
  if (storage[0]) {
    const view = new DataView(new Uint8Array(storage[0]).buffer);
    return view.getBigUint64(0, true);
  }
  return 0n;
}

async function getLastEvents(provider: Web3Provider, count: number = 5): Promise<string[]> {
  try {
    const events = await provider.getEvents({
      smartContractAddress: CONTRACT_ADDRESS,
      start: { period: 0, thread: 0 },
      end: null,
    });
    return events.slice(-count).map(e => e.data);
  } catch { return []; }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════
// PHASE 1: Read-Only Tests
// ══════════════════════════════════════════════

async function phase1(contract: SmartContract, _provider: Web3Provider) {
  HEADER('PHASE 1: READ-ONLY TESTS');

  // 1.1 Rate
  SUBHEADER('1.1 Rate');
  try {
    const rate = await readU64(contract, 'getRate');
    const usdPerMas = Number(rate) / 100000;
    INFO(`Rate: ${rate} milicents ($${usdPerMas.toFixed(5)} per MAS)`);
    Number(rate) > 0 ? PASS('Rate > 0') : FAIL('Rate is 0');
  } catch (e: any) { FAIL(`getRate: ${e.message}`); }

  // 1.2 Subscription prices
  SUBHEADER('1.2 Subscription Prices');
  for (let tier = 0; tier <= 3; tier++) {
    try {
      const price = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(tier).serialize());
      const minPrice = await readU64(contract, 'getMinSubscriptionPrice', new Args().addU8(tier).serialize());
      INFO(`${TIER_NAMES[tier]}: ${fmtMas(price)} (min: ${fmtMas(minPrice)})`);

      if (tier === 0) {
        price === 0n ? PASS('FREE tier = 0 MAS') : FAIL(`FREE tier = ${fmtMas(price)}`);
      } else {
        price >= minPrice ? PASS(`${TIER_NAMES[tier]}: price >= min`) : FAIL(`${TIER_NAMES[tier]}: price < min!`);
      }
    } catch (e: any) { FAIL(`Tier ${tier}: ${e.message}`); }
  }

  // 1.3 AUM fee rates
  SUBHEADER('1.3 AUM Fee Rates');
  const expectedBps = [0, 200, 100, 50];
  for (let tier = 0; tier <= 3; tier++) {
    try {
      const bps = await readU64(contract, 'getAumFeeRate', new Args().addU8(tier).serialize());
      INFO(`${TIER_NAMES[tier]}: ${bps} bps (${Number(bps) / 100}%)`);
      Number(bps) === expectedBps[tier]
        ? PASS(`${TIER_NAMES[tier]} AUM = ${expectedBps[tier]} bps`)
        : FAIL(`${TIER_NAMES[tier]} AUM = ${bps}, expected ${expectedBps[tier]}`);
    } catch (e: any) { FAIL(`AUM tier ${tier}: ${e.message}`); }
  }

  // 1.4 Gas calculations
  SUBHEADER('1.4 Gas Deposit Calculations');
  const intervals = [
    { name: '5 min', ms: FIVE_MINUTES_MS, expectedCalls: 1 },
    { name: '1 day', ms: ONE_DAY_MS, expectedCalls: 1 },
    { name: '30 days', ms: 30 * ONE_DAY_MS, expectedCalls: 5 },
  ];
  for (const iv of intervals) {
    try {
      const minGas = await readU64(contract, 'getMinGasDeposit', new Args().addU64(BigInt(iv.ms)).serialize());
      const numCalls = await readU64(contract, 'getNumAscCalls', new Args().addU64(BigInt(iv.ms)).serialize());
      INFO(`${iv.name}: minGas=${fmtMas(minGas)}, calls=${numCalls}`);
      Number(numCalls) === iv.expectedCalls
        ? PASS(`${iv.name}: ${iv.expectedCalls} ASC calls`)
        : FAIL(`${iv.name}: ${numCalls} calls, expected ${iv.expectedCalls}`);
    } catch (e: any) { FAIL(`Gas calc ${iv.name}: ${e.message}`); }
  }

  // 1.5 USDC prices
  SUBHEADER('1.5 USDC Prices');
  const expectedUsdc = [0, 10_000_000, 30_000_000, 90_000_000]; // 6 decimals
  for (let tier = 0; tier <= 3; tier++) {
    try {
      const price = await readU64(contract, 'getSubscriptionPriceUsdc', new Args().addU8(tier).serialize());
      INFO(`${TIER_NAMES[tier]}: ${Number(price) / 1_000_000} USDC`);
      Number(price) === expectedUsdc[tier]
        ? PASS(`${TIER_NAMES[tier]} USDC correct`)
        : FAIL(`${TIER_NAMES[tier]} USDC = ${price}, expected ${expectedUsdc[tier]}`);
    } catch (e: any) { FAIL(`USDC tier ${tier}: ${e.message}`); }
  }

  // 1.6 Revenue & gas excess
  SUBHEADER('1.6 Admin Revenue & Gas Excess');
  try {
    const revenue = await readU64(contract, 'getTotalRevenue');
    const aumFees = await readU64(contract, 'getTotalAumFees');
    const gasExcess = await readU64(contract, 'getGasExcess');
    INFO(`Revenue: ${fmtMas(revenue)}`);
    INFO(`AUM Fees: ${fmtMas(aumFees)}`);
    INFO(`Gas Excess: ${fmtMas(gasExcess)}`);
    PASS('Revenue tracking readable');
  } catch (e: any) { FAIL(`Revenue: ${e.message}`); }
}

// ══════════════════════════════════════════════
// PHASE 2: Create FREE Vault
// ══════════════════════════════════════════════

async function phase2(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 2: CREATE FREE VAULT');

  // Check if vault already exists
  const existingVault = await readVault(contract, ownerAddr);
  if (existingVault && existingVault.isActive) {
    INFO('Active vault already exists, deactivating first...');
    try {
      const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
      await op.waitFinalExecution();
      PASS('Old vault deactivated');
      await sleep(2000);
    } catch (e: any) { FAIL(`Deactivate old: ${e.message}`); return; }
  }

  // Record balances before
  const revenueBefore = await getStorageU64(provider, 'REVENUE');

  // Create vault: FREE tier, 5-min interval, 1 heir
  SUBHEADER('2.1 Create FREE vault (5 min interval)');
  const gasDeposit = 5; // MAS
  const vaultBalance = 100; // MAS
  const totalSend = gasDeposit + 0.01 + vaultBalance; // gas + oracle + balance

  const createArgs = new Args()
    .addU8(0)                          // tier: FREE
    .addU32(1)                         // 1 heir
    .addString(heirAddr)               // heir address
    .addU64(BigInt(FIVE_MINUTES_MS))   // 5 min interval
    .addString('Test message phase 2') // payload
    .addString('')                     // arweave
    .addString('')                     // encKey
    .addU64(0n)                        // subscriptionPayment (FREE)
    .addU64(toNano(gasDeposit))        // gasHint
    .addU64(toNano(vaultBalance));     // explicit vaultBalance

  try {
    INFO(`Sending ${totalSend} MAS (gas=${gasDeposit}, oracle=0.01, balance=${vaultBalance})...`);
    const op = await contract.call('createVault', createArgs.serialize(), {
      coins: toNano(totalSend),
      maxGas: 500_000_000n,
    });
    INFO(`Op: ${op.id}`);
    await op.waitFinalExecution();
    PASS('createVault succeeded');
  } catch (e: any) { FAIL(`createVault: ${e.message}`); return; }

  // Verify vault data
  SUBHEADER('2.2 Verify vault data');
  const vault = await readVault(contract, ownerAddr);
  if (!vault) { FAIL('Vault not found after creation'); return; }

  vault.tier === 0 ? PASS('Tier = FREE') : FAIL(`Tier = ${vault.tier}`);
  vault.isActive ? PASS('isActive = true') : FAIL('isActive = false');
  vault.heirs.includes(heirAddr) ? PASS('Heir registered') : FAIL('Heir not found');
  vault.interval === FIVE_MINUTES_MS ? PASS('Interval = 5 min') : FAIL(`Interval = ${vault.interval}`);
  vault.payload === 'Test message phase 2' ? PASS('Payload correct') : FAIL(`Payload: ${vault.payload}`);

  // Balance should be vaultBalance (100 MAS, possibly slightly less due to gas calc)
  const balMas = fromNano(vault.balance);
  INFO(`Vault balance: ${balMas.toFixed(4)} MAS`);
  balMas >= 90 ? PASS(`Balance ~${vaultBalance} MAS`) : FAIL(`Balance too low: ${balMas}`);

  // Subscription expiry for FREE = max u64
  vault.subscriptionExpiry > Date.now() + 1000 * 365 * 100
    ? PASS('FREE subscription = infinity')
    : FAIL(`Subscription expires: ${fmtDate(vault.subscriptionExpiry)}`);

  // Status
  const status = await readStatus(contract, ownerAddr);
  status === 'ACTIVE' ? PASS('Status = ACTIVE') : FAIL(`Status = ${status}`);

  // Deferred call ID
  SUBHEADER('2.3 Verify ASC scheduled');
  const dcId = await readStr(contract, 'getDeferredCallId', new Args().addString(ownerAddr).serialize());
  dcId.length > 0 ? PASS(`ASC ID: ${dcId.slice(0, 20)}...`) : FAIL('No ASC scheduled');

  // Revenue unchanged (FREE = no subscription)
  const revenueAfter = await getStorageU64(provider, 'REVENUE');
  revenueAfter === revenueBefore
    ? PASS('Revenue unchanged (FREE tier)')
    : FAIL(`Revenue changed: ${fmtMas(revenueBefore)} → ${fmtMas(revenueAfter)}`);

  // Heir tracking
  SUBHEADER('2.4 Verify heir tracking');
  const heirVaults = await readStr(contract, 'getVaultsForHeir', new Args().addString(heirAddr).serialize());
  heirVaults.includes(ownerAddr)
    ? PASS('Heir → Owner mapping exists')
    : FAIL(`Heir vaults: "${heirVaults}"`);

  // Events
  const events = await getLastEvents(provider, 3);
  INFO(`Last events: ${events.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 3: Ping + AUM Fee
// ══════════════════════════════════════════════

async function phase3(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 3: PING + AUM FEE VERIFICATION');

  const vaultBefore = await readVault(contract, ownerAddr);
  if (!vaultBefore || !vaultBefore.isActive) { SKIP('No active vault'); return; }

  // For FREE tier, AUM = 0
  const isFree = vaultBefore.tier === 0;

  SUBHEADER('3.1 Check accrued fee');
  const accruedFee = await readU64(contract, 'getAccruedFee', new Args().addString(ownerAddr).serialize());
  INFO(`Accrued AUM fee: ${fmtMas(accruedFee)}`);
  if (isFree) {
    accruedFee === 0n ? PASS('FREE tier: AUM = 0') : FAIL(`FREE tier AUM = ${fmtMas(accruedFee)}`);
  }

  // Record state before ping
  const unlockBefore = vaultBefore.unlockDate;
  const revenueBefore = await getStorageU64(provider, 'REVENUE');
  const aumBefore = await getStorageU64(provider, 'AUM_FEES');
  const gasExcessBefore = await getStorageU64(provider, 'GAS_EXCESS');

  SUBHEADER('3.2 Execute ping');
  const gasAmount = 5; // MAS
  const aumFeeMas = fromNano(accruedFee);
  const totalSend = gasAmount + 0.01 + aumFeeMas + 0.1; // extra buffer

  try {
    INFO(`Sending ${totalSend.toFixed(4)} MAS (gas=${gasAmount}, oracle=0.01, AUM=${aumFeeMas.toFixed(4)}, buffer=0.1)...`);
    const op = await contract.call('ping', new Args().serialize(), {
      coins: toNano(totalSend),
      maxGas: 500_000_000n,
    });
    INFO(`Op: ${op.id}`);
    await op.waitFinalExecution();
    PASS('Ping succeeded');
  } catch (e: any) { FAIL(`Ping: ${e.message}`); return; }

  // Verify vault updated
  SUBHEADER('3.3 Verify post-ping state');
  const vaultAfter = await readVault(contract, ownerAddr);
  if (!vaultAfter) { FAIL('Vault not found after ping'); return; }

  vaultAfter.unlockDate > unlockBefore
    ? PASS(`UnlockDate extended: ${fmtDate(unlockBefore)} → ${fmtDate(vaultAfter.unlockDate)}`)
    : FAIL('UnlockDate not extended');

  vaultAfter.lastPing > vaultBefore.lastPing
    ? PASS('lastPing updated')
    : FAIL('lastPing not updated');

  // Vault balance should NOT change on ping (AUM paid from wallet)
  vaultAfter.balance === vaultBefore.balance
    ? PASS(`Vault balance unchanged: ${fmtMas(vaultAfter.balance)}`)
    : FAIL(`Vault balance changed: ${fmtMas(vaultBefore.balance)} → ${fmtMas(vaultAfter.balance)}`);

  // For paid tiers, check AUM fees went to admin
  if (!isFree) {
    const aumAfter = await getStorageU64(provider, 'AUM_FEES');
    aumAfter > aumBefore
      ? PASS(`AUM fees increased: ${fmtMas(aumBefore)} → ${fmtMas(aumAfter)}`)
      : FAIL('AUM fees not increased');
  }

  // Check gas excess
  const gasExcessAfter = await getStorageU64(provider, 'GAS_EXCESS');
  if (gasExcessAfter > gasExcessBefore) {
    INFO(`Gas excess increased: ${fmtMas(gasExcessBefore)} → ${fmtMas(gasExcessAfter)}`);
  }

  // New ASC scheduled
  const dcId = await readStr(contract, 'getDeferredCallId', new Args().addString(ownerAddr).serialize());
  dcId.length > 0 ? PASS('New ASC scheduled') : FAIL('No ASC after ping');

  // Events
  const events = await getLastEvents(provider, 3);
  INFO(`Last events: ${events.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 4: Deposit
// ══════════════════════════════════════════════

async function phase4(contract: SmartContract, _provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 4: DEPOSIT');

  const vaultBefore = await readVault(contract, ownerAddr);
  if (!vaultBefore || !vaultBefore.isActive) { SKIP('No active vault'); return; }

  const depositAmount = 50; // MAS
  const balBefore = vaultBefore.balance;

  try {
    INFO(`Depositing ${depositAmount} MAS...`);
    const op = await contract.call('deposit', new Args().serialize(), {
      coins: toNano(depositAmount),
      maxGas: 50_000_000n,
    });
    await op.waitFinalExecution();
    PASS('Deposit succeeded');
  } catch (e: any) { FAIL(`Deposit: ${e.message}`); return; }

  const vaultAfter = await readVault(contract, ownerAddr);
  if (!vaultAfter) { FAIL('Vault not found'); return; }

  const diff = fromNano(vaultAfter.balance - balBefore);
  INFO(`Balance: ${fmtMas(balBefore)} → ${fmtMas(vaultAfter.balance)} (diff: ${diff.toFixed(4)} MAS)`);
  Math.abs(diff - depositAmount) < 0.001
    ? PASS(`Deposit amount correct (+${depositAmount} MAS)`)
    : FAIL(`Deposit amount wrong: expected +${depositAmount}, got +${diff.toFixed(4)}`);
}

// ══════════════════════════════════════════════
// PHASE 5: Update Functions
// ══════════════════════════════════════════════

async function phase5(contract: SmartContract, _provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 5: UPDATE FUNCTIONS');

  const vaultBefore = await readVault(contract, ownerAddr);
  if (!vaultBefore || !vaultBefore.isActive) { SKIP('No active vault'); return; }

  // 5.1 Update payload
  SUBHEADER('5.1 updatePayload');
  try {
    const newPayload = 'Updated test message';
    const op = await contract.call('updatePayload',
      new Args().addString(newPayload).addString('').addString('').serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.payload === newPayload ? PASS('Payload updated') : FAIL(`Payload: "${v?.payload}"`);
  } catch (e: any) { FAIL(`updatePayload: ${e.message}`); }

  // 5.2 Update interval
  SUBHEADER('5.2 updateInterval');
  try {
    const newInterval = BigInt(10 * 60 * 1000); // 10 min
    const op = await contract.call('updateInterval',
      new Args().addU64(newInterval).serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.interval === Number(newInterval) ? PASS('Interval → 10 min') : FAIL(`Interval: ${v?.interval}`);

    // Revert to 5 min for subsequent tests
    const op2 = await contract.call('updateInterval',
      new Args().addU64(BigInt(FIVE_MINUTES_MS)).serialize(),
      { maxGas: 50_000_000n });
    await op2.waitFinalExecution();
    PASS('Interval reverted to 5 min');
  } catch (e: any) { FAIL(`updateInterval: ${e.message}`); }

  // 5.3 Update heirs
  SUBHEADER('5.3 updateHeirs');
  try {
    // Can only test if tier allows > 1 heir... FREE = 1 heir max
    if (vaultBefore.tier === 0) {
      SKIP('FREE tier: max 1 heir, skipping multi-heir test');
      // But we can replace the heir
      const op = await contract.call('updateHeirs',
        new Args().addU32(1).addString(heirAddr).serialize(),
        { maxGas: 50_000_000n });
      await op.waitFinalExecution();
      const v = await readVault(contract, ownerAddr);
      v?.heirs.includes(heirAddr) ? PASS('Heir replaced successfully') : FAIL('Heir not updated');
    } else {
      const secondHeir = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';
      const op = await contract.call('updateHeirs',
        new Args().addU32(2).addString(heirAddr).addString(secondHeir).serialize(),
        { maxGas: 50_000_000n });
      await op.waitFinalExecution();
      const v = await readVault(contract, ownerAddr);
      v?.heirs.length === 2 ? PASS('2 heirs set') : FAIL(`Heirs: ${v?.heirs.length}`);

      // Revert to 1 heir
      const op2 = await contract.call('updateHeirs',
        new Args().addU32(1).addString(heirAddr).serialize(),
        { maxGas: 50_000_000n });
      await op2.waitFinalExecution();
    }
  } catch (e: any) { FAIL(`updateHeirs: ${e.message}`); }

  // 5.4 Negative test: pipe character in payload
  SUBHEADER('5.4 Negative: pipe in payload');
  try {
    const op = await contract.call('updatePayload',
      new Args().addString('bad|payload').addString('').addString('').serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    FAIL('Should have rejected pipe in payload');
  } catch {
    PASS('Pipe character rejected');
  }

  // 5.5 Negative test: owner as heir
  SUBHEADER('5.5 Negative: self as heir');
  try {
    const op = await contract.call('updateHeirs',
      new Args().addU32(1).addString(ownerAddr).serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    FAIL('Should have rejected self as heir');
  } catch {
    PASS('Self-heir rejected');
  }
}

// ══════════════════════════════════════════════
// PHASE 6: Deactivate + Refund
// ══════════════════════════════════════════════

async function phase6(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 6: DEACTIVATE VAULT + REFUND');

  const vaultBefore = await readVault(contract, ownerAddr);
  if (!vaultBefore || !vaultBefore.isActive) { SKIP('No active vault'); return; }

  const balanceBefore = vaultBefore.balance;
  INFO(`Vault balance before deactivation: ${fmtMas(balanceBefore)}`);

  try {
    const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
    await op.waitFinalExecution();
    PASS('deactivateVault succeeded');
  } catch (e: any) { FAIL(`deactivateVault: ${e.message}`); return; }

  // Verify
  const vaultAfter = await readVault(contract, ownerAddr);
  if (!vaultAfter) { FAIL('Vault not found'); return; }

  !vaultAfter.isActive ? PASS('isActive = false') : FAIL('Still active');
  vaultAfter.balance === 0n ? PASS('Balance = 0 (returned to owner)') : FAIL(`Balance = ${fmtMas(vaultAfter.balance)}`);

  const status = await readStatus(contract, ownerAddr);
  status === 'DISTRIBUTED' ? PASS('Status = DISTRIBUTED') : FAIL(`Status = ${status}`);

  // Events
  const events = await getLastEvents(provider, 3);
  const hasDeactivated = events.some(e => e.includes('VAULT_DEACTIVATED'));
  hasDeactivated ? PASS('VAULT_DEACTIVATED event') : FAIL('No deactivation event');
  INFO(`Events: ${events.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 7: Create LIGHT Vault (Paid Subscription + AUM)
// ══════════════════════════════════════════════

async function phase7(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 7: CREATE LIGHT VAULT (PAID SUBSCRIPTION)');

  // Clean up if needed
  const existing = await readVault(contract, ownerAddr);
  if (existing && existing.isActive) {
    INFO('Active vault exists, deactivating...');
    const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
    await op.waitFinalExecution();
    await sleep(2000);
  }

  // Get subscription price
  const subPrice = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(1).serialize());
  const subMas = fromNano(subPrice);
  INFO(`LIGHT subscription: ${fmtMas(subPrice)}`);

  const revenueBefore = await getStorageU64(provider, 'REVENUE');

  // Create LIGHT vault
  const gasDeposit = 5;
  const vaultBalance = 200;
  const totalSend = subMas + 0.01 + gasDeposit + vaultBalance + 1; // +1 buffer

  const createArgs = new Args()
    .addU8(1)                          // LIGHT
    .addU32(1)
    .addString(heirAddr)
    .addU64(BigInt(FIVE_MINUTES_MS))   // 5 min
    .addString('LIGHT tier test')
    .addString('')
    .addString('')
    .addU64(subPrice)                  // subscriptionPayment
    .addU64(toNano(gasDeposit));       // gasHint

  try {
    INFO(`Sending ${totalSend.toFixed(2)} MAS (sub=${subMas.toFixed(2)}, gas=${gasDeposit}, balance=${vaultBalance})...`);
    const op = await contract.call('createVault', createArgs.serialize(), {
      coins: toNano(totalSend),
      maxGas: 500_000_000n,
    });
    await op.waitFinalExecution();
    PASS('LIGHT vault created');
  } catch (e: any) { FAIL(`createVault LIGHT: ${e.message}`); return; }

  // Verify
  SUBHEADER('7.1 Verify LIGHT vault');
  const vault = await readVault(contract, ownerAddr);
  if (!vault) { FAIL('Vault not found'); return; }

  vault.tier === 1 ? PASS('Tier = LIGHT') : FAIL(`Tier = ${vault.tier}`);
  vault.isActive ? PASS('isActive = true') : FAIL('Not active');

  // Subscription should expire in ~365 days
  const daysUntilExpiry = (vault.subscriptionExpiry - Date.now()) / ONE_DAY_MS;
  INFO(`Subscription expires in ${daysUntilExpiry.toFixed(1)} days`);
  daysUntilExpiry > 360 ? PASS('Subscription ~1 year') : FAIL(`Expiry = ${daysUntilExpiry} days`);

  // Revenue increased by subscription
  SUBHEADER('7.2 Verify revenue');
  const revenueAfter = await getStorageU64(provider, 'REVENUE');
  const revenueDiff = fromNano(revenueAfter - revenueBefore);
  INFO(`Revenue increased by ${revenueDiff.toFixed(4)} MAS`);
  revenueDiff >= subMas * 0.99  // allow tiny rounding
    ? PASS(`Subscription revenue recorded (~${subMas.toFixed(2)} MAS)`)
    : FAIL(`Revenue diff = ${revenueDiff.toFixed(4)}, expected ~${subMas.toFixed(2)}`);

  // AUM fee should accrue over time
  SUBHEADER('7.3 AUM fee accrual');
  INFO('Waiting 5 seconds for fee to accrue...');
  await sleep(5000);
  const accruedFee = await readU64(contract, 'getAccruedFee', new Args().addString(ownerAddr).serialize());
  INFO(`Accrued AUM fee after 5 sec: ${fmtMas(accruedFee)}`);
  accruedFee > 0n ? PASS('AUM fee accruing') : FAIL('AUM fee = 0 after 5 sec');
}

// ══════════════════════════════════════════════
// PHASE 8: Wait for ASC Auto-Distribution
// ══════════════════════════════════════════════

async function phase8(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 8: WAIT FOR ASC AUTO-DISTRIBUTION');
  INFO('⚠️  This phase requires a vault with 5-min interval and NO ping.');
  INFO('The ASC should fire automatically after the interval expires.');
  INFO('');

  const vault = await readVault(contract, ownerAddr);
  if (!vault || !vault.isActive) { SKIP('No active vault'); return; }

  const timeUntil = await readU64(contract, 'getTimeUntilUnlock', new Args().addString(ownerAddr).serialize());
  const minutesLeft = Number(timeUntil) / 60000;
  INFO(`Time until unlock: ${minutesLeft.toFixed(1)} minutes`);

  if (minutesLeft > 10) {
    SKIP(`Too long to wait (${minutesLeft.toFixed(1)} min). Run this phase when vault is close to unlock.`);
    return;
  }

  INFO(`Waiting ${Math.ceil(minutesLeft) + 1} minutes for ASC to fire...`);
  const waitMs = Number(timeUntil) + 60_000; // +1 min buffer
  
  // Poll every 30 seconds
  const pollInterval = 30_000;
  let elapsed = 0;
  while (elapsed < waitMs) {
    await sleep(pollInterval);
    elapsed += pollInterval;
    
    const status = await readStatus(contract, ownerAddr);
    INFO(`[${(elapsed / 60000).toFixed(1)} min] Status: ${STATUS_COLORS[status] || '?'} ${status}`);
    
    if (status === 'DISTRIBUTED') {
      PASS('Vault auto-distributed by ASC!');
      
      // Check distributed info
      const distInfo = await readStr(contract, 'getDistributedInfo', new Args().addString(ownerAddr).serialize());
      INFO(`Distribution info: ${distInfo}`);
      return;
    }
    
    if (status === 'UNLOCKED_READY') {
      INFO('Vault unlocked! ASC should distribute shortly...');
    }
  }

  const finalStatus = await readStatus(contract, ownerAddr);
  if (finalStatus === 'DISTRIBUTED') {
    PASS('Vault distributed');
  } else {
    FAIL(`Status after wait: ${finalStatus}. ASC may have failed.`);
    INFO('Check events and try manualTrigger');
  }
}

// ══════════════════════════════════════════════
// PHASE 9: Heir Claim (Manual)
// ══════════════════════════════════════════════

async function phase9(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 9: HEIR CLAIM');

  if (!HEIR_KEY) { SKIP('HEIR_PRIVATE_KEY not set in .env'); return; }

  const heirAccount = await Account.fromPrivateKey(HEIR_KEY);
  const heirAddr = heirAccount.address.toString();
  const heirProvider = Web3Provider.buildnet(heirAccount);
  const heirContract = new SmartContract(heirProvider, CONTRACT_ADDRESS);
  INFO(`Heir address: ${heirAddr}`);

  // Step 1: Owner creates vault for heir to claim
  SUBHEADER('9.1 Create vault for heir claim');
  const existing = await readVault(contract, ownerAddr);
  if (existing && existing.isActive) {
    const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
    await op.waitFinalExecution();
    await sleep(2000);
  }

  // Create FREE vault with 5-min interval
  const createArgs = new Args()
    .addU8(0).addU32(1).addString(heirAddr)
    .addU64(BigInt(FIVE_MINUTES_MS))
    .addString('Heir claim test').addString('').addString('');

  try {
    const op = await contract.call('createVault', createArgs.serialize(), {
      coins: toNano(105.01), maxGas: 500_000_000n,
    });
    await op.waitFinalExecution();
    PASS('Vault created for heir claim test');
  } catch (e: any) { FAIL(`Create: ${e.message}`); return; }

  // Step 2: Wait for unlock
  INFO('Waiting 5.5 minutes for vault to unlock...');
  await sleep(5.5 * 60 * 1000);

  const status = await readStatus(contract, ownerAddr);
  INFO(`Status after wait: ${status}`);

  if (status !== 'UNLOCKED_READY' && status !== 'DISTRIBUTED') {
    // If ASC already distributed, that's also fine
    SKIP(`Status is ${status}, not UNLOCKED_READY. May need to wait longer.`);
    return;
  }

  if (status === 'DISTRIBUTED') {
    PASS('ASC already distributed automatically');
    return;
  }

  // Step 3: Heir claims
  SUBHEADER('9.2 Heir claims inheritance');
  try {
    const op = await heirContract.call('claimInheritance',
      new Args().addString(ownerAddr).serialize(),
      { coins: 0n, maxGas: 500_000_000n });
    await op.waitFinalExecution();
    PASS('claimInheritance succeeded');
  } catch (e: any) { FAIL(`claimInheritance: ${e.message}`); return; }

  // Verify
  const vaultAfter = await readVault(contract, ownerAddr);
  !vaultAfter?.isActive ? PASS('Vault inactive after claim') : FAIL('Vault still active');

  const distInfo = await readStr(contract, 'getDistributedInfo', new Args().addString(ownerAddr).serialize());
  distInfo.length > 0 ? PASS(`Distribution recorded: ${distInfo.slice(0, 60)}...`) : FAIL('No distribution info');

  // Heir distributed vaults
  const distVaults = await readStr(heirContract, 'getDistributedVaultsForHeir', new Args().addString(heirAddr).serialize());
  distVaults.includes(ownerAddr)
    ? PASS('Heir → distributed vault mapping')
    : FAIL(`Distributed vaults: "${distVaults}"`);
}

// ══════════════════════════════════════════════
// PHASE 10: Admin Functions
// ══════════════════════════════════════════════

async function phase10(contract: SmartContract, provider: Web3Provider) {
  HEADER('PHASE 10: ADMIN FUNCTIONS');

  // 10.1 Check revenue
  SUBHEADER('10.1 Revenue');
  const revenue = await getStorageU64(provider, 'REVENUE');
  INFO(`Total revenue: ${fmtMas(revenue)}`);

  if (revenue > 0n) {
    // Try withdrawing 1 MAS
    const withdrawAmount = revenue > toNano(1) ? toNano(1) : revenue;
    try {
      const op = await contract.call('adminWithdraw',
        new Args().addU64(withdrawAmount).serialize(),
        { maxGas: 50_000_000n });
      await op.waitFinalExecution();
      PASS(`adminWithdraw ${fmtMas(withdrawAmount)} succeeded`);

      const revenueAfter = await getStorageU64(provider, 'REVENUE');
      INFO(`Revenue after withdraw: ${fmtMas(revenueAfter)}`);
      revenueAfter === revenue - withdrawAmount
        ? PASS('Revenue decreased correctly')
        : FAIL(`Revenue mismatch`);
    } catch (e: any) { FAIL(`adminWithdraw: ${e.message}`); }
  } else {
    SKIP('No revenue to withdraw');
  }

  // 10.2 Gas excess
  SUBHEADER('10.2 Gas Excess');
  const gasExcess = await getStorageU64(provider, 'GAS_EXCESS');
  INFO(`Gas excess: ${fmtMas(gasExcess)}`);

  if (gasExcess > 0n) {
    const withdrawAmount = gasExcess > toNano(0.5) ? toNano(0.5) : gasExcess;
    try {
      const op = await contract.call('adminWithdrawGasExcess',
        new Args().addU64(withdrawAmount).serialize(),
        { maxGas: 50_000_000n });
      await op.waitFinalExecution();
      PASS(`adminWithdrawGasExcess ${fmtMas(withdrawAmount)} succeeded`);
    } catch (e: any) { FAIL(`adminWithdrawGasExcess: ${e.message}`); }
  } else {
    SKIP('No gas excess to withdraw');
  }

  // 10.3 Negative: withdraw more than revenue
  SUBHEADER('10.3 Negative: over-withdraw');
  try {
    const op = await contract.call('adminWithdraw',
      new Args().addU64(toNano(999_999_999)).serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    FAIL('Should have rejected over-withdraw');
  } catch {
    PASS('Over-withdraw rejected');
  }

  // 10.4 Rate update
  SUBHEADER('10.4 Rate update');
  const currentRate = await readU64(contract, 'getRate');
  INFO(`Current rate: ${currentRate} milicents`);

  // Update to +10% (within ±50% limit)
  const newRate = BigInt(Math.floor(Number(currentRate) * 1.1));
  try {
    const op = await contract.call('updateRate',
      new Args().addU64(newRate).serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    const updatedRate = await readU64(contract, 'getRate');
    updatedRate === newRate ? PASS(`Rate updated: ${currentRate} → ${newRate}`) : FAIL('Rate not updated');

    // Revert rate
    const op2 = await contract.call('updateRate',
      new Args().addU64(currentRate).serialize(),
      { maxGas: 50_000_000n });
    await op2.waitFinalExecution();
    PASS('Rate reverted');
  } catch (e: any) { FAIL(`updateRate: ${e.message}`); }

  // 10.5 Negative: rate change > 50%
  SUBHEADER('10.5 Negative: rate change > 50%');
  try {
    const badRate = BigInt(Number(currentRate) * 3); // 200% increase
    const op = await contract.call('updateRate',
      new Args().addU64(badRate).serialize(),
      { maxGas: 50_000_000n });
    await op.waitFinalExecution();
    FAIL('Should reject >50% rate change');
    // Revert if somehow passed
    await contract.call('updateRate', new Args().addU64(currentRate).serialize(), { maxGas: 50_000_000n });
  } catch {
    PASS('>50% rate change rejected');
  }
}

// ══════════════════════════════════════════════
// PHASE 11: Subscription Renewal
// ══════════════════════════════════════════════

async function phase11(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 11: SUBSCRIPTION RENEWAL');

  // Need a paid vault
  const vault = await readVault(contract, ownerAddr);
  if (!vault || !vault.isActive || vault.tier === 0) {
    INFO('Creating LIGHT vault for renewal test...');
    const existing = await readVault(contract, ownerAddr);
    if (existing?.isActive) {
      const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
      await op.waitFinalExecution();
      await sleep(2000);
    }

    const subPrice = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(1).serialize());
    const createArgs = new Args()
      .addU8(1).addU32(1).addString(heirAddr)
      .addU64(BigInt(FIVE_MINUTES_MS))
      .addString('Renewal test').addString('').addString('')
      .addU64(subPrice);

    try {
      const op = await contract.call('createVault', createArgs.serialize(), {
        coins: toNano(fromNano(subPrice) + 106), maxGas: 500_000_000n,
      });
      await op.waitFinalExecution();
      PASS('LIGHT vault created for renewal test');
    } catch (e: any) { FAIL(`Create for renewal: ${e.message}`); return; }
  }

  // Get current expiry
  const vaultNow = await readVault(contract, ownerAddr);
  if (!vaultNow) { FAIL('No vault'); return; }
  const expiryBefore = vaultNow.subscriptionExpiry;
  INFO(`Current expiry: ${fmtDate(expiryBefore)}`);

  // Renew
  SUBHEADER('11.1 Renew subscription (active)');
  const subPrice = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(vaultNow.tier).serialize());
  try {
    const op = await contract.call('renewSubscription',
      new Args().addU64(subPrice).serialize(),
      { coins: subPrice + 100_000_000n, maxGas: 100_000_000n }); // +0.1 MAS buffer
    await op.waitFinalExecution();
    PASS('renewSubscription succeeded');
  } catch (e: any) { FAIL(`renewSubscription: ${e.message}`); return; }

  // Verify extended from old expiry (not from now)
  const vaultAfter = await readVault(contract, ownerAddr);
  if (!vaultAfter) { FAIL('No vault after renewal'); return; }

  const newExpiry = vaultAfter.subscriptionExpiry;
  INFO(`New expiry: ${fmtDate(newExpiry)}`);

  const expectedExpiry = expiryBefore + 365 * ONE_DAY_MS;
  const diff = Math.abs(newExpiry - expectedExpiry);
  diff < 60_000  // within 1 minute tolerance
    ? PASS(`Extended from old expiry (+365 days)`)
    : FAIL(`Expiry mismatch: expected ${fmtDate(expectedExpiry)}, got ${fmtDate(newExpiry)}`);

  // 11.2 Negative: renew FREE tier
  SUBHEADER('11.2 Negative: renew FREE tier');
  INFO('(skipping — would need a FREE vault)');
}

// ══════════════════════════════════════════════
// PHASE 12: Full Lifecycle
// ══════════════════════════════════════════════

async function phase12(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 12: FULL LIFECYCLE (create → ping → wait → distribute → history)');
  INFO('⚠️  This phase takes ~6 minutes!');
  INFO('');

  // Clean up
  const existing = await readVault(contract, ownerAddr);
  if (existing?.isActive) {
    const op = await contract.call('deactivateVault', new Args().serialize(), { maxGas: 500_000_000n });
    await op.waitFinalExecution();
    await sleep(2000);
  }

  // Step 1: Create FREE, 5-min, 500 MAS
  INFO('Step 1: Create vault (FREE, 5 min, 500 MAS)');
  const createArgs = new Args()
    .addU8(0).addU32(1).addString(heirAddr)
    .addU64(BigInt(FIVE_MINUTES_MS))
    .addString('Full lifecycle test').addString('').addString('');

  const op1 = await contract.call('createVault', createArgs.serialize(), {
    coins: toNano(505.01), maxGas: 500_000_000n,
  });
  await op1.waitFinalExecution();
  PASS('Vault created');

  // Step 2: Ping after 30 sec
  INFO('Step 2: Wait 30 sec, then ping...');
  await sleep(30_000);

  const op2 = await contract.call('ping', new Args().serialize(), {
    coins: toNano(5.01), maxGas: 500_000_000n,
  });
  await op2.waitFinalExecution();
  PASS('Ping succeeded');

  // Step 3: Deposit 50 MAS
  INFO('Step 3: Deposit 50 MAS');
  const op3 = await contract.call('deposit', new Args().serialize(), {
    coins: toNano(50), maxGas: 50_000_000n,
  });
  await op3.waitFinalExecution();
  
  const vaultNow = await readVault(contract, ownerAddr);
  INFO(`Balance: ${fmtMas(vaultNow!.balance)}`);
  PASS('Deposit succeeded');

  // Step 4: Wait for unlock (~5 min from last ping)
  INFO('Step 4: Waiting ~5.5 min for auto-distribution...');
  const timeUntil = await readU64(contract, 'getTimeUntilUnlock', new Args().addString(ownerAddr).serialize());
  const waitMs = Number(timeUntil) + 60_000;
  
  let distributed = false;
  let elapsed = 0;
  while (elapsed < waitMs && !distributed) {
    await sleep(30_000);
    elapsed += 30_000;
    const status = await readStatus(contract, ownerAddr);
    INFO(`[${(elapsed / 60000).toFixed(1)} min] ${STATUS_COLORS[status] || '?'} ${status}`);
    if (status === 'DISTRIBUTED') distributed = true;
  }

  if (distributed) {
    PASS('Auto-distribution successful!');
  } else {
    // Try manual trigger as fallback
    INFO('ASC may not have fired. Trying manualTrigger...');
    try {
      const op = await contract.call('manualTrigger',
        new Args().addString(ownerAddr).serialize(),
        { coins: toNano(0.01), maxGas: 500_000_000n });
      await op.waitFinalExecution();
      PASS('manualTrigger succeeded');
    } catch (e: any) {
      FAIL(`manualTrigger: ${e.message}`);
    }
  }

  // Step 5: Verify distribution
  INFO('Step 5: Verify distribution');
  const distInfo = await readStr(contract, 'getDistributedInfo', new Args().addString(ownerAddr).serialize());
  if (distInfo.length > 0) {
    const parts = distInfo.split('|');
    INFO(`Total distributed: ${fmtMas(BigInt(parts[0]))}`);
    INFO(`Per heir: ${fmtMas(BigInt(parts[1]))}`);
    INFO(`Heirs count: ${parts[2]}`);
    INFO(`Timestamp: ${fmtDate(parseInt(parts[3]))}`);
    INFO(`AUM fee collected: ${fmtMas(BigInt(parts[4]))}`);
    PASS('Distribution history recorded');
  } else {
    FAIL('No distribution history');
  }

  // Events
  const events = await getLastEvents(provider, 10);
  const distEvents = events.filter(e => e.includes('DISTRIBUTION') || e.includes('INHERITANCE'));
  INFO(`Distribution events: ${distEvents.length}`);
  for (const ev of distEvents) INFO(`  ${ev}`);
}

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     LEGACY VAULT v3.0 — COMPREHENSIVE E2E TEST SUITE        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (!OWNER_KEY) {
    console.error('❌ DEPLOYER_PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const ownerAccount = await Account.fromPrivateKey(OWNER_KEY);
  const ownerAddr = ownerAccount.address.toString();
  const provider = Web3Provider.buildnet(ownerAccount);
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);

  // Determine heir address
  let heirAddr = '';
  if (HEIR_KEY) {
    const heirAccount = await Account.fromPrivateKey(HEIR_KEY);
    heirAddr = heirAccount.address.toString();
  } else {
    heirAddr = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq'; // default test address
  }

  INFO(`Owner:    ${ownerAddr}`);
  INFO(`Heir:     ${heirAddr}`);
  INFO(`Contract: ${CONTRACT_ADDRESS}`);
  INFO(`Network:  buildnet`);

  const phase = process.argv[2] || 'all';
  INFO(`Running phase: ${phase}\n`);

  try {
    switch (phase) {
      case '1': await phase1(contract, provider); break;
      case '2': await phase2(contract, provider, ownerAddr, heirAddr); break;
      case '3': await phase3(contract, provider, ownerAddr); break;
      case '4': await phase4(contract, provider, ownerAddr); break;
      case '5': await phase5(contract, provider, ownerAddr, heirAddr); break;
      case '6': await phase6(contract, provider, ownerAddr); break;
      case '7': await phase7(contract, provider, ownerAddr, heirAddr); break;
      case '8': await phase8(contract, provider, ownerAddr); break;
      case '9': await phase9(contract, provider, ownerAddr); break;
      case '10': await phase10(contract, provider); break;
      case '11': await phase11(contract, provider, ownerAddr, heirAddr); break;
      case '12': await phase12(contract, provider, ownerAddr, heirAddr); break;
      case 'all':
        await phase1(contract, provider);
        await phase2(contract, provider, ownerAddr, heirAddr);
        await phase3(contract, provider, ownerAddr);
        await phase4(contract, provider, ownerAddr);
        await phase5(contract, provider, ownerAddr, heirAddr);
        await phase6(contract, provider, ownerAddr);
        await phase7(contract, provider, ownerAddr, heirAddr);
        // Skip 8 (waiting) and 9 (needs heir key + time)
        await phase10(contract, provider);
        await phase11(contract, provider, ownerAddr, heirAddr);
        break;
      default:
        console.log('Usage: npx ts-node --esm test-full.ts [1-12|all]');
        break;
    }
  } catch (e: any) {
    console.error(`\n💥 FATAL: ${e.message}`);
    console.error(e.stack);
  }

  // Summary
  console.log('\n' + '═'.repeat(65));
  console.log(`  📊 RESULTS: ✅ ${passCount} passed  ❌ ${failCount} failed  ⏭️  ${skipCount} skipped`);
  console.log('═'.repeat(65));

  process.exit(failCount > 0 ? 1 : 0);
}

main();
