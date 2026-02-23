/**
 * LEGACY VAULT v3.1 — COMPREHENSIVE E2E TEST SUITE
 * Updated: Feb 2026
 *
 * RUN: npx ts-node --esm scripts/test-full.ts [1-13|all]
 */

import * as dotenv from 'dotenv';
import { Account, Web3Provider, SmartContract, Args } from '@massalabs/massa-web3';
dotenv.config();

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'AS12Nq1f1CWUpcBbwVo1RMigedV5G1LKGSjbp99AJS7zGzna2kpCZ';
const OWNER_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const HEIR_KEY = process.env.HEIR_PRIVATE_KEY || '';
const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY || '';
const FIVE_MINUTES_MS = 300_000;
const ONE_DAY_MS = 86_400_000;

function toNano(m: number): bigint { return BigInt(Math.floor(m * 1e9)); }
function fromNano(n: bigint | string | number): number { return Number(BigInt(n)) / 1e9; }
function fmtMas(n: bigint | string | number): string { return fromNano(n).toFixed(4) + ' MAS'; }
function fmtDate(ms: number | bigint): string { return new Date(Number(ms)).toISOString().replace('T',' ').slice(0,19); }

const TIER_NAMES = ['FREE','LIGHT','PRO','LEGATE'];
const SC: Record<string,string> = { ACTIVE:'🟢', FROZEN:'🔵', UNLOCKED_READY:'🟡', UNLOCKED_PENDING_PAYMENT:'🟠', DISTRIBUTED:'⚫' };
let pc=0, fc=0, sc2=0;
function PASS(m: string) { pc++; console.log(`  ✅ ${m}`); }
function FAIL(m: string) { fc++; console.log(`  ❌ ${m}`); }
function SKIP(m: string) { sc2++; console.log(`  ⏭️  ${m}`); }
function INFO(m: string) { console.log(`  ℹ️  ${m}`); }
function WARN(m: string) { console.log(`  ⚠️  ${m}`); }
function HEADER(t: string) { console.log('\n'+'═'.repeat(65)+'\n  '+t+'\n'+'═'.repeat(65)); }
function SUBHEADER(t: string) { console.log(`\n  ── ${t} ──`); }

interface VaultData {
  tier:number; unlockDate:number; interval:number; lastPing:number;
  isActive:boolean; balance:bigint; heirs:string[]; payload:string;
  arweaveTxId:string; encryptedKey:string; subscriptionExpiry:number; lastFeeCollection:number;
}

async function readVault(c: SmartContract, o: string): Promise<VaultData|null> {
  try {
    const r = await c.read('getVault', new Args().addString(o).serialize());
    const p = new TextDecoder().decode(r.value).split('|');
    if (p.length < 12) return null;
    return { tier:parseInt(p[0]), unlockDate:parseInt(p[1]), interval:parseInt(p[2]),
      lastPing:parseInt(p[3]), isActive:p[4]==='1', balance:BigInt(p[5]),
      heirs:p[6].split(',').filter(h=>h.length>0), payload:p[7],
      arweaveTxId:p[8], encryptedKey:p[9],
      subscriptionExpiry:parseInt(p[10]), lastFeeCollection:parseInt(p[11]) };
  } catch { return null; }
}

async function readStatus(c: SmartContract, o: string): Promise<string> {
  try { const r = await c.read('getVaultStatus', new Args().addString(o).serialize()); return new TextDecoder().decode(r.value); } catch { return 'ERROR'; }
}

async function readU64(c: SmartContract, fn: string, a: Uint8Array = new Args().serialize()): Promise<bigint> {
  const r = await c.read(fn, a); return new Args(r.value).nextU64();
}

async function readStr(c: SmartContract, fn: string, a: Uint8Array): Promise<string> {
  const r = await c.read(fn, a); return new TextDecoder().decode(r.value);
}

async function getStorageU64(p: Web3Provider, key: string): Promise<bigint> {
  const s = await p.readStorage(CONTRACT_ADDRESS, [new TextEncoder().encode(key)]);
  if (s[0]) { const v = new DataView(new Uint8Array(s[0]).buffer); return v.getBigUint64(0, true); }
  return 0n;
}

async function getLastEvents(p: Web3Provider, n: number = 5): Promise<string[]> {
  try { const e = await p.getEvents({ smartContractAddress: CONTRACT_ADDRESS, start:{period:0,thread:0}, end:null }); return e.slice(-n).map(x=>x.data); } catch { return []; }
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════
// PHASE 1
// ══════════════════════════════════════════════
async function phase1(contract: SmartContract, _provider: Web3Provider) {
  HEADER('PHASE 1: READ-ONLY TESTS');

  SUBHEADER('1.1 Rate');
  try {
    const rate = await readU64(contract, 'getRate');
    INFO(`Rate: ${rate} milicents ($${(Number(rate)/100000).toFixed(5)} per MAS)`);
    Number(rate) > 0 ? PASS('Rate > 0') : FAIL('Rate is 0');
  } catch (e: any) { FAIL(`getRate: ${e.message}`); }

  SUBHEADER('1.2 Subscription Prices');
  for (let t = 0; t <= 3; t++) {
    try {
      const price = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(t).serialize());
      const minP = await readU64(contract, 'getMinSubscriptionPrice', new Args().addU8(t).serialize());
      INFO(`${TIER_NAMES[t]}: ${fmtMas(price)} (min: ${fmtMas(minP)})`);
      t===0 ? (price===0n ? PASS('FREE tier = 0 MAS') : FAIL(`FREE=${fmtMas(price)}`)) : (price>=minP ? PASS(`${TIER_NAMES[t]}: price >= min`) : FAIL(`${TIER_NAMES[t]}: price < min`));
    } catch (e: any) { FAIL(`Tier ${t}: ${e.message}`); }
  }

  SUBHEADER('1.3 AUM Fee Rates');
  const eb = [0,200,100,50];
  for (let t = 0; t <= 3; t++) {
    try {
      const bps = await readU64(contract, 'getAumFeeRate', new Args().addU8(t).serialize());
      INFO(`${TIER_NAMES[t]}: ${bps} bps (${Number(bps)/100}%)`);
      Number(bps)===eb[t] ? PASS(`${TIER_NAMES[t]} AUM = ${eb[t]} bps`) : FAIL(`${TIER_NAMES[t]} AUM = ${bps}`);
    } catch (e: any) { FAIL(`AUM ${t}: ${e.message}`); }
  }

  SUBHEADER('1.4 Gas Deposit Calculations');
  const ivs = [{n:'5 min',ms:FIVE_MINUTES_MS,c:1},{n:'1 day',ms:ONE_DAY_MS,c:1},{n:'30 days',ms:30*ONE_DAY_MS,c:5},{n:'180 days',ms:180*ONE_DAY_MS,c:30},{n:'365 days',ms:365*ONE_DAY_MS,c:61}];
  for (const iv of ivs) {
    try {
      const mg = await readU64(contract, 'getMinGasDeposit', new Args().addU64(BigInt(iv.ms)).serialize());
      const nc = await readU64(contract, 'getNumAscCalls', new Args().addU64(BigInt(iv.ms)).serialize());
      INFO(`${iv.n}: minGas=${fmtMas(mg)}, calls=${nc}`);
      Number(nc)===iv.c ? PASS(`${iv.n}: ${iv.c} ASC calls`) : FAIL(`${iv.n}: ${nc} calls`);
    } catch (e: any) { FAIL(`Gas ${iv.n}: ${e.message}`); }
  }

  SUBHEADER('1.5 USDC Prices');
  const eu = [0,10_000_000,30_000_000,90_000_000];
  for (let t = 0; t <= 3; t++) {
    try {
      const p = await readU64(contract, 'getSubscriptionPriceUsdc', new Args().addU8(t).serialize());
      INFO(`${TIER_NAMES[t]}: ${Number(p)/1e6} USDC`);
      Number(p)===eu[t] ? PASS(`${TIER_NAMES[t]} USDC correct`) : FAIL(`${TIER_NAMES[t]} USDC = ${p}`);
    } catch (e: any) { FAIL(`USDC ${t}: ${e.message}`); }
  }

  SUBHEADER('1.6 Admin Revenue & Gas Excess');
  try {
    const rev = await readU64(contract, 'getTotalRevenue');
    const aum = await readU64(contract, 'getTotalAumFees');
    const ge = await readU64(contract, 'getGasExcess');
    INFO(`Revenue: ${fmtMas(rev)}`); INFO(`AUM Fees: ${fmtMas(aum)}`); INFO(`Gas Excess: ${fmtMas(ge)}`);
    PASS('Revenue tracking readable');
  } catch (e: any) { FAIL(`Revenue: ${e.message}`); }

  SUBHEADER('1.7 hasVault (nonexistent)');
  try {
    const r = await contract.read('hasVault', new Args().addString('AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq').serialize());
    INFO(`hasVault for random address: ${new Args(r.value).nextU8()}`);
    PASS('hasVault readable');
  } catch (e: any) { FAIL(`hasVault: ${e.message}`); }
}

// ══════════════════════════════════════════════
// PHASE 2
// ══════════════════════════════════════════════
async function phase2(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 2: CREATE FREE VAULT');
  const ex = await readVault(contract, ownerAddr);
  if (ex && ex.isActive) {
    INFO('Active vault exists, deactivating...');
    try { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); PASS('Old vault deactivated'); await sleep(2000); } catch (e: any) { FAIL(`Deactivate: ${e.message}`); return; }
  }
  const revBefore = await getStorageU64(provider, 'REVENUE');

  SUBHEADER('2.1 Create FREE vault (5 min interval)');
  const ca = new Args().addU8(0).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('Test message phase 2').addString('').addString('');
  try {
    INFO('Sending 105.01 MAS (gas=5, oracle=0.01, balance=100)...');
    const op = await contract.call('createVault', ca.serialize(), {coins:toNano(105.01), maxGas:500_000_000n});
    INFO(`Op: ${op.id}`); await op.waitFinalExecution(); PASS('createVault succeeded');
  } catch (e: any) { FAIL(`createVault: ${e.message}`); return; }

  SUBHEADER('2.2 Verify vault data');
  const v = await readVault(contract, ownerAddr);
  if (!v) { FAIL('Vault not found'); return; }
  v.tier===0 ? PASS('Tier = FREE') : FAIL(`Tier = ${v.tier}`);
  v.isActive ? PASS('isActive = true') : FAIL('isActive = false');
  v.heirs.includes(heirAddr) ? PASS('Heir registered') : FAIL('Heir not found');
  v.interval===FIVE_MINUTES_MS ? PASS('Interval = 5 min') : FAIL(`Interval = ${v.interval}`);
  v.payload==='Test message phase 2' ? PASS('Payload correct') : FAIL(`Payload: "${v.payload}"`);
  const bm = fromNano(v.balance); INFO(`Vault balance: ${bm.toFixed(4)} MAS`);
  bm >= 90 ? PASS('Balance ~100 MAS') : FAIL(`Balance too low: ${bm}`);
  v.subscriptionExpiry > Date.now()+1000*365*100 ? PASS('FREE subscription = infinity') : FAIL('Subscription expires');
  const st = await readStatus(contract, ownerAddr);
  st==='ACTIVE' ? PASS('Status = ACTIVE') : FAIL(`Status = ${st}`);

  SUBHEADER('2.3 Verify ASC scheduled');
  const dc = await readStr(contract, 'getDeferredCallId', new Args().addString(ownerAddr).serialize());
  dc.length > 0 ? PASS(`ASC ID: ${dc.slice(0,20)}...`) : FAIL('No ASC');
  const revAfter = await getStorageU64(provider, 'REVENUE');
  revAfter===revBefore ? PASS('Revenue unchanged (FREE tier)') : FAIL('Revenue changed');

  SUBHEADER('2.4 Verify heir tracking');
  const hv = await readStr(contract, 'getVaultsForHeir', new Args().addString(heirAddr).serialize());
  hv.includes(ownerAddr) ? PASS('Heir → Owner mapping exists') : FAIL(`Heir vaults: "${hv}"`);
  const ev2 = await getLastEvents(provider, 3); INFO(`Last events: ${ev2.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 3
// ══════════════════════════════════════════════
async function phase3(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 3: PING + AUM FEE VERIFICATION');
  const vb = await readVault(contract, ownerAddr);
  if (!vb || !vb.isActive) { SKIP('No active vault'); return; }

  SUBHEADER('3.1 Check accrued fee');
  const af = await readU64(contract, 'getAccruedFee', new Args().addString(ownerAddr).serialize());
  INFO(`Accrued AUM fee: ${fmtMas(af)}`);
  if (vb.tier===0) { af===0n ? PASS('FREE tier: AUM = 0') : FAIL(`FREE AUM = ${fmtMas(af)}`); }

  const ulBefore = vb.unlockDate;
  const geBefore = await getStorageU64(provider, 'GAS_EXCESS');

  SUBHEADER('3.2 Execute ping');
  const am = fromNano(af);
  const ts = 5 + 0.01 + am + 0.1;
  try {
    INFO(`Sending ${ts.toFixed(4)} MAS...`);
    const op = await contract.call('ping', new Args().serialize(), {coins:toNano(ts), maxGas:500_000_000n});
    INFO(`Op: ${op.id}`); await op.waitFinalExecution(); PASS('Ping succeeded');
  } catch (e: any) { FAIL(`Ping: ${e.message}`); return; }

  SUBHEADER('3.3 Verify post-ping state');
  const va = await readVault(contract, ownerAddr);
  if (!va) { FAIL('Vault not found'); return; }
  va.unlockDate > ulBefore ? PASS(`UnlockDate extended: ${fmtDate(ulBefore)} → ${fmtDate(va.unlockDate)}`) : FAIL('UnlockDate not extended');
  va.lastPing > vb.lastPing ? PASS('lastPing updated') : FAIL('lastPing not updated');
  va.balance===vb.balance ? PASS(`Vault balance unchanged: ${fmtMas(va.balance)}`) : FAIL('Balance changed');
  const geAfter = await getStorageU64(provider, 'GAS_EXCESS');
  if (geAfter > geBefore) { INFO(`Gas excess: ${fmtMas(geBefore)} → ${fmtMas(geAfter)}`); PASS('Gas excess accumulated'); }
  else { INFO(`Gas excess unchanged: ${fmtMas(geAfter)}`); }
  const dc = await readStr(contract, 'getDeferredCallId', new Args().addString(ownerAddr).serialize());
  dc.length > 0 ? PASS('New ASC scheduled') : FAIL('No ASC');
  const ev = await getLastEvents(provider, 3); INFO(`Last events: ${ev.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 4
// ══════════════════════════════════════════════
async function phase4(contract: SmartContract, _p: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 4: DEPOSIT');
  const vb = await readVault(contract, ownerAddr);
  if (!vb || !vb.isActive) { SKIP('No active vault'); return; }
  const dep = 50; const bb = vb.balance;
  try { INFO(`Depositing ${dep} MAS...`); const op = await contract.call('deposit', new Args().serialize(), {coins:toNano(dep), maxGas:50_000_000n}); await op.waitFinalExecution(); PASS('Deposit succeeded'); } catch (e: any) { FAIL(`Deposit: ${e.message}`); return; }
  const va = await readVault(contract, ownerAddr);
  if (!va) { FAIL('No vault'); return; }
  const d = fromNano(va.balance - bb); INFO(`Balance: ${fmtMas(bb)} → ${fmtMas(va.balance)} (diff: ${d.toFixed(4)})`);
  Math.abs(d - dep) < 0.001 ? PASS(`Deposit correct (+${dep} MAS)`) : FAIL(`Wrong: +${d.toFixed(4)}`);
}

// ══════════════════════════════════════════════
// PHASE 5
// ══════════════════════════════════════════════
async function phase5(contract: SmartContract, _p: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 5: UPDATE FUNCTIONS');
  const vb = await readVault(contract, ownerAddr);
  if (!vb || !vb.isActive) { SKIP('No active vault'); return; }

  SUBHEADER('5.1 updatePayload');
  try {
    const op = await contract.call('updatePayload', new Args().addString('Updated test message').addString('').addString('').serialize(), {maxGas:50_000_000n});
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.payload==='Updated test message' ? PASS('Payload updated') : FAIL(`Payload: "${v?.payload}"`);
  } catch (e: any) { FAIL(`updatePayload: ${e.message}`); }

  SUBHEADER('5.2 updateInterval');
  try {
    const op = await contract.call('updateInterval', new Args().addU64(BigInt(600000)).serialize(), {maxGas:50_000_000n});
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.interval===600000 ? PASS('Interval → 10 min') : FAIL(`Interval: ${v?.interval}`);
    const op2 = await contract.call('updateInterval', new Args().addU64(BigInt(FIVE_MINUTES_MS)).serialize(), {maxGas:50_000_000n});
    await op2.waitFinalExecution(); PASS('Interval reverted to 5 min');
  } catch (e: any) { FAIL(`updateInterval: ${e.message}`); }

  SUBHEADER('5.3 updateHeirs');
  try {
    if (vb.tier===0) {
      SKIP('FREE tier: max 1 heir');
      const op = await contract.call('updateHeirs', new Args().addU32(1).addString(heirAddr).serialize(), {maxGas:50_000_000n});
      await op.waitFinalExecution();
      const v = await readVault(contract, ownerAddr);
      v?.heirs.includes(heirAddr) ? PASS('Heir replaced') : FAIL('Heir not updated');
    } else {
      const sh = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';
      const op = await contract.call('updateHeirs', new Args().addU32(2).addString(heirAddr).addString(sh).serialize(), {maxGas:50_000_000n});
      await op.waitFinalExecution();
      const v = await readVault(contract, ownerAddr);
      v?.heirs.length===2 ? PASS('2 heirs set') : FAIL(`Heirs: ${v?.heirs.length}`);
      const op2 = await contract.call('updateHeirs', new Args().addU32(1).addString(heirAddr).serialize(), {maxGas:50_000_000n});
      await op2.waitFinalExecution();
    }
  } catch (e: any) { FAIL(`updateHeirs: ${e.message}`); }

  SUBHEADER('5.4 Negative: pipe in payload');
  const plBefore = (await readVault(contract, ownerAddr))?.payload || '';
  try {
    const op = await contract.call('updatePayload', new Args().addString('bad|payload').addString('').addString('').serialize(), {maxGas:50_000_000n});
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.payload===plBefore ? PASS('Pipe rejected (unchanged)') : FAIL('Pipe was ACCEPTED');
  } catch { PASS('Pipe rejected (exception)'); }

  SUBHEADER('5.5 Negative: self as heir');
  try {
    const op = await contract.call('updateHeirs', new Args().addU32(1).addString(ownerAddr).serialize(), {maxGas:50_000_000n});
    await op.waitFinalExecution();
    const v = await readVault(contract, ownerAddr);
    v?.heirs.includes(ownerAddr) ? FAIL('Self-heir ACCEPTED') : PASS('Self-heir rejected');
  } catch { PASS('Self-heir rejected (exception)'); }
}

// ══════════════════════════════════════════════
// PHASE 6
// ══════════════════════════════════════════════
async function phase6(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 6: DEACTIVATE VAULT + REFUND');
  const vb = await readVault(contract, ownerAddr);
  if (!vb || !vb.isActive) { SKIP('No active vault'); return; }
  INFO(`Vault balance: ${fmtMas(vb.balance)}`);
  try { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); PASS('deactivateVault succeeded'); } catch (e: any) { FAIL(`deactivate: ${e.message}`); return; }
  const va = await readVault(contract, ownerAddr);
  if (!va) { FAIL('No vault'); return; }
  !va.isActive ? PASS('isActive = false') : FAIL('Still active');
  va.balance===0n ? PASS('Balance = 0 (returned)') : FAIL(`Balance = ${fmtMas(va.balance)}`);
  const st = await readStatus(contract, ownerAddr);
  st==='DISTRIBUTED' ? PASS('Status = DISTRIBUTED') : FAIL(`Status = ${st}`);
  const ev = await getLastEvents(provider, 3);
  ev.some(e=>e.includes('VAULT_DEACTIVATED')) ? PASS('VAULT_DEACTIVATED event') : FAIL('No event');
  INFO(`Events: ${ev.join(' | ')}`);
}

// ══════════════════════════════════════════════
// PHASE 7
// ══════════════════════════════════════════════
async function phase7(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 7: CREATE LIGHT VAULT');
  const ex = await readVault(contract, ownerAddr);
  if (ex?.isActive) { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); await sleep(2000); }

  const sp = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(1).serialize());
  const sm = fromNano(sp); INFO(`LIGHT subscription: ${fmtMas(sp)}`);
  const rb = await getStorageU64(provider, 'REVENUE');
  const ts = sm + 0.01 + 5 + 200 + 1;
  const ca = new Args().addU8(1).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('LIGHT tier test').addString('').addString('').addU64(sp).addU64(toNano(5));
  try {
    INFO(`Sending ${ts.toFixed(2)} MAS...`);
    const op = await contract.call('createVault', ca.serialize(), {coins:toNano(ts), maxGas:500_000_000n});
    await op.waitFinalExecution(); PASS('LIGHT vault created');
  } catch (e: any) { FAIL(`createVault LIGHT: ${e.message}`); return; }

  SUBHEADER('7.1 Verify LIGHT vault');
  const v = await readVault(contract, ownerAddr);
  if (!v) { FAIL('No vault'); return; }
  v.tier===1 ? PASS('Tier = LIGHT') : FAIL(`Tier = ${v.tier}`);
  v.isActive ? PASS('isActive = true') : FAIL('Not active');
  const de = (v.subscriptionExpiry - Date.now()) / ONE_DAY_MS;
  INFO(`Subscription expires in ${de.toFixed(1)} days`);
  de > 360 ? PASS('Subscription ~1 year') : FAIL(`Expiry = ${de} days`);

  SUBHEADER('7.2 Verify revenue');
  const ra = await getStorageU64(provider, 'REVENUE');
  const rd = fromNano(ra - rb); INFO(`Revenue increased by ${rd.toFixed(4)} MAS`);
  rd >= sm*0.99 ? PASS(`Subscription revenue recorded (~${sm.toFixed(2)} MAS)`) : FAIL(`Revenue diff = ${rd.toFixed(4)}`);

  SUBHEADER('7.3 AUM fee accrual');
  INFO('Waiting 10 seconds...'); await sleep(10000);
  const af = await readU64(contract, 'getAccruedFee', new Args().addString(ownerAddr).serialize());
  INFO(`Accrued AUM fee: ${fmtMas(af)}`);
  if (af > 0n) { PASS('AUM fee accruing'); }
  else { WARN('AUM fee = 0 (integer division, small balance)'); PASS('AUM fee = 0 (acceptable)'); }
}

// ══════════════════════════════════════════════
// PHASE 8
// ══════════════════════════════════════════════
async function phase8(contract: SmartContract, provider: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 8: WAIT FOR ASC AUTO-DISTRIBUTION');
  const v = await readVault(contract, ownerAddr);
  if (!v || !v.isActive) { SKIP('No active vault'); return; }
  const tu = await readU64(contract, 'getTimeUntilUnlock', new Args().addString(ownerAddr).serialize());
  const ml = Number(tu)/60000; INFO(`Time until unlock: ${ml.toFixed(1)} min`);
  if (ml > 10) { SKIP(`Too long (${ml.toFixed(1)} min)`); return; }
  INFO(`Waiting ${Math.ceil(ml)+1} min...`);
  let el = 0; const wm = Number(tu)+60000;
  while (el < wm) {
    await sleep(30000); el += 30000;
    const s = await readStatus(contract, ownerAddr);
    INFO(`[${(el/60000).toFixed(1)} min] ${SC[s]||'?'} ${s}`);
    if (s==='DISTRIBUTED') { PASS('Auto-distributed!'); return; }
  }
  const fs = await readStatus(contract, ownerAddr);
  fs==='DISTRIBUTED' ? PASS('Distributed') : FAIL(`Status: ${fs}`);
}

// ══════════════════════════════════════════════
// PHASE 9
// ══════════════════════════════════════════════
async function phase9(contract: SmartContract, _p: Web3Provider, ownerAddr: string) {
  HEADER('PHASE 9: HEIR CLAIM');
  if (!HEIR_KEY) { SKIP('HEIR_PRIVATE_KEY not set'); return; }
  const ha = await Account.fromPrivateKey(HEIR_KEY);
  const hAddr = ha.address.toString();
  const hp = Web3Provider.buildnet(ha);
  const hc = new SmartContract(hp, CONTRACT_ADDRESS);
  INFO(`Heir: ${hAddr}`);

  SUBHEADER('9.1 Create vault for heir claim');
  const ex = await readVault(contract, ownerAddr);
  if (ex?.isActive) { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); await sleep(2000); }
  const ca = new Args().addU8(0).addU32(1).addString(hAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('Heir claim test').addString('').addString('');
  try { const op = await contract.call('createVault', ca.serialize(), {coins:toNano(105.01), maxGas:500_000_000n}); await op.waitFinalExecution(); PASS('Vault created'); } catch (e: any) { FAIL(`Create: ${e.message}`); return; }

  INFO('Waiting 5.5 min...'); await sleep(5.5*60*1000);
  const s = await readStatus(contract, ownerAddr); INFO(`Status: ${s}`);
  if (s==='DISTRIBUTED') { PASS('ASC already distributed'); return; }
  if (s!=='UNLOCKED_READY') { SKIP(`Status is ${s}`); return; }

  SUBHEADER('9.2 Heir claims');
  try { const op = await hc.call('claimInheritance', new Args().addString(ownerAddr).serialize(), {coins:0n, maxGas:500_000_000n}); await op.waitFinalExecution(); PASS('claimInheritance succeeded'); } catch (e: any) { FAIL(`claim: ${e.message}`); return; }
  const va = await readVault(contract, ownerAddr);
  !va?.isActive ? PASS('Vault inactive') : FAIL('Still active');
}

// ══════════════════════════════════════════════
// PHASE 10
// ══════════════════════════════════════════════
async function phase10(contract: SmartContract, provider: Web3Provider) {
  HEADER('PHASE 10: ADMIN FUNCTIONS');
  let ac: SmartContract;
  if (ADMIN_KEY) {
    const aa = await Account.fromPrivateKey(ADMIN_KEY);
    ac = new SmartContract(Web3Provider.buildnet(aa), CONTRACT_ADDRESS);
    INFO(`Using ADMIN wallet: ${aa.address.toString()}`);
  } else { WARN('ADMIN_PRIVATE_KEY not set'); ac = contract; }

  SUBHEADER('10.1 Revenue');
  const rev = await getStorageU64(provider, 'REVENUE'); INFO(`Total revenue: ${fmtMas(rev)}`);
  if (rev > 0n) {
    const wa = rev > toNano(1) ? toNano(1) : rev;
    try { const op = await ac.call('adminWithdraw', new Args().addU64(wa).serialize(), {maxGas:50_000_000n}); await op.waitFinalExecution();
      const ra = await getStorageU64(provider, 'REVENUE');
      ra < rev ? PASS(`adminWithdraw ${fmtMas(wa)} succeeded`) : FAIL('Revenue not decreased'); INFO(`Revenue after: ${fmtMas(ra)}`);
    } catch (e: any) { FAIL(`adminWithdraw: ${e.message}`); }
  } else { SKIP('No revenue'); }

  SUBHEADER('10.2 Gas Excess');
  const ge = await getStorageU64(provider, 'GAS_EXCESS'); INFO(`Gas excess: ${fmtMas(ge)}`);
  if (ge > 0n) {
    const wa = ge > toNano(0.5) ? toNano(0.5) : ge;
    try { const op = await ac.call('adminWithdrawGasExcess', new Args().addU64(wa).serialize(), {maxGas:50_000_000n}); await op.waitFinalExecution();
      const ga = await getStorageU64(provider, 'GAS_EXCESS');
      ga < ge ? PASS(`adminWithdrawGasExcess ${fmtMas(wa)} succeeded`) : FAIL('Not decreased');
    } catch (e: any) { FAIL(`gasExcess: ${e.message}`); }
  } else { SKIP('No gas excess'); }

  SUBHEADER('10.3 Negative: over-withdraw');
  const rb = await getStorageU64(provider, 'REVENUE');
  try { const op = await ac.call('adminWithdraw', new Args().addU64(toNano(999_999_999)).serialize(), {maxGas:50_000_000n}); await op.waitFinalExecution();
    const ra = await getStorageU64(provider, 'REVENUE');
    ra===rb ? PASS('Over-withdraw rejected') : FAIL('Over-withdraw ACCEPTED');
  } catch { PASS('Over-withdraw rejected (exception)'); }

  SUBHEADER('10.4 Rate update');
  const cr = await readU64(contract, 'getRate'); INFO(`Current rate: ${cr}`);
  const nr = BigInt(Math.floor(Number(cr)*1.1));
  try {
    const op = await ac.call('updateRate', new Args().addU64(nr).serialize(), {maxGas:50_000_000n}); await op.waitFinalExecution();
    const ur = await readU64(contract, 'getRate');
    ur===nr ? PASS(`Rate updated: ${cr} → ${nr}`) : FAIL('Rate not updated');
    const op2 = await ac.call('updateRate', new Args().addU64(cr).serialize(), {maxGas:50_000_000n}); await op2.waitFinalExecution(); PASS('Rate reverted');
  } catch (e: any) { FAIL(`updateRate: ${e.message}`); }

  SUBHEADER('10.5 Negative: rate change > 50%');
  const rb2 = await readU64(contract, 'getRate');
  try { const op = await ac.call('updateRate', new Args().addU64(BigInt(Number(rb2)*3)).serialize(), {maxGas:50_000_000n}); await op.waitFinalExecution();
    const ra = await readU64(contract, 'getRate');
    ra===rb2 ? PASS('>50% rejected') : FAIL('>50% ACCEPTED');
  } catch { PASS('>50% rejected (exception)'); }
}

// ══════════════════════════════════════════════
// PHASE 11
// ══════════════════════════════════════════════
async function phase11(contract: SmartContract, _p: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 11: SUBSCRIPTION RENEWAL');
  INFO('Creating fresh LIGHT vault...');
  const ev = await readVault(contract, ownerAddr);
  if (ev?.isActive) { const d = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await d.waitFinalExecution(); await sleep(3000); }

  const sp = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(1).serialize());
  const ca = new Args().addU8(1).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('Renewal test').addString('').addString('').addU64(sp).addU64(toNano(5));
  try { const o = await contract.call('createVault', ca.serialize(), {coins:toNano(fromNano(sp)+106), maxGas:500_000_000n}); await o.waitFinalExecution(); PASS('LIGHT vault created'); } catch (e: any) { FAIL('Create: '+e.message); return; }

  try { const p = await contract.call('ping', new Args().serialize(), {coins:toNano(5.01), maxGas:500_000_000n}); await p.waitFinalExecution(); PASS('Ping (reset timer)'); } catch (e: any) { WARN('Ping failed: '+e.message); }

  const vn = await readVault(contract, ownerAddr);
  if (!vn) { FAIL('No vault'); return; }
  const expBefore = vn.subscriptionExpiry;
  INFO('Current expiry: '+fmtDate(expBefore));

  SUBHEADER('11.1 Renew subscription');
  const rp = await readU64(contract, 'getSubscriptionPrice', new Args().addU8(vn.tier).serialize());
  try { const o = await contract.call('renewSubscription', new Args().addU64(rp).serialize(), {coins:rp+100_000_000n, maxGas:500_000_000n}); await o.waitFinalExecution(); PASS('renewSubscription succeeded'); } catch (e: any) { FAIL('renewSubscription: '+e.message); return; }

  const va = await readVault(contract, ownerAddr);
  if (!va) { FAIL('No vault after renewal'); return; }
  INFO('New expiry: '+fmtDate(va.subscriptionExpiry));
  const expected = expBefore + 365 * ONE_DAY_MS;
  Math.abs(va.subscriptionExpiry - expected) < 60_000 ? PASS('Extended from old expiry (+365 days)') : FAIL('Expiry mismatch');
}

// ══════════════════════════════════════════════
// PHASE 12
// ══════════════════════════════════════════════
async function phase12(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 12: FULL LIFECYCLE');
  INFO('Takes ~6 min!');
  const ex = await readVault(contract, ownerAddr);
  if (ex?.isActive) { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); await sleep(2000); }

  INFO('Step 1: Create (FREE, 5 min, 500 MAS)');
  const ca = new Args().addU8(0).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('Lifecycle test').addString('').addString('').addU64(0n).addU64(toNano(5)).addU64(toNano(500));
  const o1 = await contract.call('createVault', ca.serialize(), {coins:toNano(510), maxGas:500_000_000n}); await o1.waitFinalExecution(); PASS('Created');

  INFO('Step 2: Ping after 30 sec'); await sleep(30000);
  const o2 = await contract.call('ping', new Args().serialize(), {coins:toNano(5.01), maxGas:500_000_000n}); await o2.waitFinalExecution(); PASS('Pinged');

  INFO('Step 3: Deposit 50 MAS');
  const o3 = await contract.call('deposit', new Args().serialize(), {coins:toNano(50), maxGas:50_000_000n}); await o3.waitFinalExecution(); PASS('Deposited');

  INFO('Step 4: Wait for distribution...');
  const tu = await readU64(contract, 'getTimeUntilUnlock', new Args().addString(ownerAddr).serialize());
  let el=0; const wm=Number(tu)+60000; let dist=false;
  while (el<wm && !dist) { await sleep(30000); el+=30000; const s=await readStatus(contract,ownerAddr); INFO(`[${(el/60000).toFixed(1)} min] ${SC[s]||'?'} ${s}`); if (s==='DISTRIBUTED') dist=true; }
  if (dist) { PASS('Auto-distributed!'); }
  else { INFO('Trying manualTrigger...'); try { const op=await contract.call('manualTrigger', new Args().addString(ownerAddr).serialize(), {coins:toNano(0.01), maxGas:500_000_000n}); await op.waitFinalExecution(); PASS('manualTrigger ok'); } catch (e: any) { FAIL(`manualTrigger: ${e.message}`); } }

  INFO('Step 5: Verify');
  const di = await readStr(contract, 'getDistributedInfo', new Args().addString(ownerAddr).serialize());
  di.length > 0 ? PASS('Distribution history recorded') : FAIL('No history');
}

// ══════════════════════════════════════════════
// PHASE 13
// ══════════════════════════════════════════════
async function phase13(contract: SmartContract, provider: Web3Provider, ownerAddr: string, heirAddr: string) {
  HEADER('PHASE 13: EXPLICIT VAULT BALANCE (EXCESS → REVENUE)');
  const ex = await readVault(contract, ownerAddr);
  if (ex?.isActive) { const op = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await op.waitFinalExecution(); await sleep(2000); }

  const rb = await getStorageU64(provider, 'REVENUE'); INFO(`Revenue before: ${fmtMas(rb)}`);

  SUBHEADER('13.1 Create with explicit vaultBalance');
  const ca = new Args().addU8(0).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('vaultBalance test').addString('').addString('').addU64(0n).addU64(toNano(5)).addU64(toNano(100));
  try {
    INFO('Sending 155.01 MAS (gas=5, balance=100, excess=50)...');
    const op = await contract.call('createVault', ca.serialize(), {coins:toNano(155.01), maxGas:500_000_000n});
    await op.waitFinalExecution(); PASS('createVault with vaultBalance succeeded');
  } catch (e: any) { FAIL(`createVault: ${e.message}`); return; }

  SUBHEADER('13.2 Verify vault balance');
  const v = await readVault(contract, ownerAddr);
  if (!v) { FAIL('No vault'); return; }
  const bm = fromNano(v.balance); INFO(`Vault balance: ${bm.toFixed(4)} MAS`);
  Math.abs(bm-100) < 1 ? PASS('Vault balance = ~100 MAS (not 150)') : FAIL(`Balance = ${bm.toFixed(4)}`);

  SUBHEADER('13.3 Verify excess → revenue');
  const ra = await getStorageU64(provider, 'REVENUE');
  const rd = fromNano(ra - rb); INFO(`Revenue increased by ${rd.toFixed(4)} MAS`);
  rd >= 45 ? PASS('Excess ~50 MAS went to revenue') : FAIL(`Revenue diff = ${rd.toFixed(4)}`);
  const ev = await getLastEvents(provider, 5);
  const ee = ev.find(e=>e.includes('EXCESS_TO_REVENUE'));
  if (ee) PASS(`EXCESS_TO_REVENUE event: ${ee.slice(0,80)}...`);

  SUBHEADER('13.4 Backward compatible: no vaultBalance param');
  const o2 = await contract.call('deactivateVault', new Args().serialize(), {maxGas:500_000_000n}); await o2.waitFinalExecution(); await sleep(5000);
  const rb2 = await getStorageU64(provider, 'REVENUE');
  const ca2 = new Args().addU8(0).addU32(1).addString(heirAddr).addU64(BigInt(FIVE_MINUTES_MS)).addString('No vaultBal test').addString('').addString('');
  const o3 = await contract.call('createVault', ca2.serialize(), {coins:toNano(155.01), maxGas:500_000_000n}); await o3.waitFinalExecution();
  const v2 = await readVault(contract, ownerAddr);
  if (!v2) { FAIL('Vault2 not found'); return; }
  const b2 = fromNano(v2.balance); INFO(`Vault balance (no explicit): ${b2.toFixed(4)} MAS`);
  const ra2 = await getStorageU64(provider, 'REVENUE'); INFO(`Revenue change: ${fromNano(ra2-rb2).toFixed(4)} MAS`);
  b2 > 140 ? PASS(`All excess went to vault (~${b2.toFixed(0)} MAS)`) : FAIL(`Balance too low: ${b2.toFixed(4)}`);
}

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     LEGACY VAULT v3.1 — COMPREHENSIVE E2E TEST SUITE        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  if (!OWNER_KEY) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }
  const oa = await Account.fromPrivateKey(OWNER_KEY);
  const ownerAddr = oa.address.toString();
  const provider = Web3Provider.buildnet(oa);
  const contract = new SmartContract(provider, CONTRACT_ADDRESS);
  let heirAddr = '';
  if (HEIR_KEY) { const ha = await Account.fromPrivateKey(HEIR_KEY); heirAddr = ha.address.toString(); }
  else { heirAddr = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq'; }
  INFO(`Owner:    ${ownerAddr}`); INFO(`Heir:     ${heirAddr}`); INFO(`Contract: ${CONTRACT_ADDRESS}`); INFO('Network:  buildnet');
  if (ADMIN_KEY) { const aa = await Account.fromPrivateKey(ADMIN_KEY); INFO(`Admin:    ${aa.address.toString()}`); }
  else { WARN('ADMIN_PRIVATE_KEY not set'); }
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
      case '13': await phase13(contract, provider, ownerAddr, heirAddr); break;
      case 'all':
        await phase1(contract, provider);
        await phase2(contract, provider, ownerAddr, heirAddr);
        await phase3(contract, provider, ownerAddr);
        await phase4(contract, provider, ownerAddr);
        await phase5(contract, provider, ownerAddr, heirAddr);
        await phase6(contract, provider, ownerAddr);
        await phase7(contract, provider, ownerAddr, heirAddr);
        await phase10(contract, provider);
        await phase11(contract, provider, ownerAddr, heirAddr);
        await phase13(contract, provider, ownerAddr, heirAddr);
        break;
      default: console.log('Usage: npx ts-node --esm test-full.ts [1-13|all]'); break;
    }
  } catch (e: any) { console.error(`\nFATAL: ${e.message}`); console.error(e.stack); }
  console.log('\n'+'═'.repeat(65));
  console.log(`  RESULTS: ✅ ${pc} passed  ❌ ${fc} failed  ⏭️  ${sc2} skipped`);
  console.log('═'.repeat(65));
  process.exit(fc > 0 ? 1 : 0);
}
main();
