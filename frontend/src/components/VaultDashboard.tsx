import { useState, useEffect } from 'react';
import { NotificationSettings } from './NotificationSettings';
import { TIER_NAMES, formatMassa, calculateGasEstimate, ORACLE_FEE, AUM_FEE_BPS, ONE_DAY_MS } from '../utils/contract';
import type { VaultData } from '../utils/contract';

interface VaultDashboardProps {
  walletAddress: string;
  vault: VaultData;
  timeUntilUnlock: number;
  onPing: () => Promise<void>;
  onDeposit: (amount: number) => Promise<void>;
  onDeactivate: () => Promise<void>;
  loading: boolean;
}

const c = {
  bg: '#0a0a0b', bgCard: '#1A1A1F', bgMuted: '#252529',
  text: '#ffffff', textSecondary: '#a0a0a8', textMuted: '#606068',
  green: '#22c55e', purple: '#8b5cf6', danger: '#ef4444', border: '#2a2a30',
};

export function VaultDashboard({ vault, walletAddress, timeUntilUnlock, onPing, onDeposit, onDeactivate, loading }: VaultDashboardProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [countdown, setCountdown] = useState(timeUntilUnlock);

  useEffect(() => {
    setCountdown(timeUntilUnlock);
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1000)), 1000);
    return () => clearInterval(timer);
  }, [timeUntilUnlock]);

  const days = Math.floor(countdown / 86400000);
  const hours = Math.floor((countdown % 86400000) / 3600000);
  const minutes = Math.floor((countdown % 3600000) / 60000);
  const intervalDays = vault.interval / 86400000;
  const YEAR_MS = 365 * ONE_DAY_MS;
  const feeBps = AUM_FEE_BPS[vault.tier];
  const aumFeePercent = feeBps / 100;
  const balanceNum = Number(vault.balance);
  const timeSinceCollection = Date.now() - vault.lastFeeCollection;
  const expectedAumFee = feeBps > 0 ? (balanceNum * feeBps / 10000) * (timeSinceCollection / YEAR_MS) : 0;
  const subscriptionExpiry = new Date(vault.subscriptionExpiry);
  const subscriptionPrice = [0, 9.99, 29.99, 89.99][vault.tier];
  const keyData = vault.encryptedKey ? (() => { try { return JSON.parse(vault.encryptedKey); } catch { return null; } })() : null;
  const hasFiles = vault.arweaveTxId && keyData?.files?.length > 0;
  const formatTime = () => { if (days > 0) return `${days}d ${hours}h`; if (hours > 0) return `${hours}h ${minutes}m`; return `${minutes}m`; };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ backgroundColor: c.bgCard, borderRadius: '16px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ backgroundColor: c.purple, color: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>{TIER_NAMES[vault.tier]}</span>
            {feeBps > 0 && <span style={{ color: c.textMuted, fontSize: '14px' }}>{aumFeePercent}% AUM fee</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '2px' }}>STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.green }} />
              <span style={{ color: c.green, fontWeight: '500', fontSize: '14px' }}>Active</span>
            </div>
          </div>
        </div>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
          <div style={{ padding: '24px', textAlign: 'center', borderRight: `1px solid ${c.border}` }}>
            <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: c.text }}>{formatMassa(vault.balance)} MAS</div>
          </div>
          <div style={{ padding: '24px', textAlign: 'center', borderRight: `1px solid ${c.border}` }}>
            <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Until Unlock</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: c.text }}>{formatTime()}</div>
            <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '4px' }}>Interval: {intervalDays.toFixed(intervalDays < 1 ? 4 : 0)}d</div>
          </div>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heirs</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: c.text }}>{vault.heirs.length}</div>
          </div>
        </div>
        {/* Designated Heirs */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Designated Heirs</div>
          {vault.heirs.map((heir, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: c.bgMuted, borderRadius: '8px', marginBottom: i < vault.heirs.length - 1 ? '8px' : 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <code style={{ fontSize: '14px', color: c.textSecondary, fontFamily: 'monospace' }}>{heir.slice(0, 12)}...{heir.slice(-8)}</code>
            </div>
          ))}
        </div>
        {/* Attached Files */}
        {hasFiles && (
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
            <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attached Files</div>
            {keyData.files.map((file: { name: string; size: number }, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: c.bgMuted, borderRadius: '8px', marginBottom: idx < keyData.files.length - 1 ? '8px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>ðŸ“„</span>
                  <span style={{ color: c.text, fontSize: '14px' }}>{file.name}</span>
                </div>
                <span style={{ color: c.textMuted, fontSize: '13px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ))}
            <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '10px' }}>Encrypted on Arweave: {vault.arweaveTxId.slice(0, 16)}...</div>
          </div>
        )}
        {/* Subscription */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subscription</div>
          <div style={{ color: c.text, fontSize: '14px', marginBottom: '4px' }}>Expires: <strong>{subscriptionExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
          <div style={{ color: c.textSecondary, fontSize: '14px' }}>Annual fee: <strong>${subscriptionPrice}/year</strong></div>
        </div>
        {/* Action Buttons */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: '12px' }}>
          <button onClick={onPing} disabled={loading} style={{ flex: 2, padding: '16px', backgroundColor: c.green, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : "Ping (I'm alive)"}
          </button>
          <button onClick={() => setShowDeposit(!showDeposit)} style={{ flex: 1, padding: '16px', backgroundColor: c.bgMuted, color: c.text, border: `1px solid ${c.border}`, borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>Deposit</button>
          <button onClick={() => setShowNotificationSettings(true)} style={{ flex: 1, padding: '16px', backgroundColor: c.bgMuted, color: c.text, border: `1px solid ${c.border}`, borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>Alerts</button>
          <button onClick={onDeactivate} disabled={loading} style={{ padding: '16px', backgroundColor: c.bgMuted, color: c.danger, border: `1px solid ${c.danger}33`, borderRadius: '10px', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        {/* Transaction Fee Info */}
        <div style={{ padding: '0 24px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: c.textMuted }}>Gas fee: ~{(calculateGasEstimate(vault.interval).recommended + ORACLE_FEE).toFixed(2)} MAS (incl. ×1.3 safety buffer){feeBps > 0 && ` + AUM: ~${(expectedAumFee / 1e9).toFixed(4)} MAS`}</span>
        </div>
        {/* Deposit Popup */}
        {showDeposit && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ backgroundColor: c.bgMuted, borderRadius: '10px', padding: '16px', display: 'flex', gap: '12px' }}>
              <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Amount in MAS" style={{ flex: 1, padding: '12px', backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '14px', outline: 'none' }} />
              <button onClick={() => { onDeposit(Number(depositAmount)); setShowDeposit(false); setDepositAmount(''); }} disabled={!depositAmount || loading} style={{ padding: '12px 24px', backgroundColor: c.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        )}
      </div>
      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <NotificationSettings vaultOwner={walletAddress} tier={vault.tier} heirs={vault.heirs} onClose={() => setShowNotificationSettings(false)} />
        </div>
      )}
    </div>
  );
}
