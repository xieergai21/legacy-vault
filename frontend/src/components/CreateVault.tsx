import { useState } from 'react';
import { useMasPrice } from '../hooks/useMasPrice';
import { TIER_NAMES, SUBSCRIPTION_PRICES_USD, calculateGasEstimate, ONE_DAY_MS, ORACLE_FEE, MAX_BALANCE_MAS } from '../utils/contract';
import { FileUpload } from './FileUpload';
import { prepareFilesForUpload, uploadEncryptedFile } from '../utils/arweave';

interface CreateVaultProps {
  onUpdatePayload: (payload: string, arweaveTxId: string, encryptedKey: string) => Promise<string>;
  onSubmit: (tier: number, heirs: string[], intervalDays: number, payload: string, amount: number, tierPaymentMas: number, arweaveTxId?: string, encryptedKey?: string) => Promise<void>;
  loading: boolean;
  massaAddress: string;
}

const c = {
  bg: '#0F0F12', bgCard: '#1A1A1F', bgMuted: '#252529',
  text: '#F0F0F2', textSecondary: '#A0A0A8', textMuted: '#606068',
  accent: '#3B82F6', green: '#22C55E', border: '#2A2A30',
};

const TIER_LIMITS = {
  maxHeirs: [1, 3, 10, 255],
  maxPayload: [25, 1024, 2048, 2048],
  hasArweave: [false, false, true, true],
  arweaveLimit: ['--', '--', '50 MB', '1 GB'],
  features: [
    ["25 char on-chain text", "AES-256 encryption", "Up to 1 heir", "Max 10K MAS", "0% AUM fee"],
    ["1 KB text (1024 char)", "AES-256 encryption", "Up to 3 heirs", "Max 200K MAS", "1% AUM fee", "âœ“ Email alerts"],
    ["2 KB notes (2048 char)", "Up to 10 heirs", "Max 2M MAS", "0.5% AUM fee", "âœ“ Email alerts", "âœ“ 50 MB file storage"],
    ["2 KB notes (2048 char)", "Unlimited heirs", "Unlimited MAS", "0.25% AUM fee", "âœ“ Email alerts", "âœ“ 1 GB file storage", "Dynamic distribution (soon)"],
  ],
};
const TIER_PRICES = ['Free', '$9.99', '$29.99', '$89.99'];
const TIER_SUBTITLES = ['forever', 'per year', 'per year', 'per year'];
const AUM_FEES = [0, 1, 0.5, 0.25];
const INTERVALS = [
  { label: '5min', days: 0.003472 }, { label: '1d', days: 1 }, { label: '7d', days: 7 }, { label: '14d', days: 14 },
  { label: '1mo', days: 30 }, { label: '3mo', days: 90 }, { label: '6mo', days: 180 }, { label: '1yr', days: 365 },
];

export function CreateVault({ onSubmit, onUpdatePayload, loading, massaAddress: _massaAddress }: CreateVaultProps) {
  const [tier, setTier] = useState(2);
  const [heirs, setHeirs] = useState<string[]>([]);
  const [intervalDays, setIntervalDays] = useState(14);
  const [deposit, setDeposit] = useState(100);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mas' | 'usdc'>('mas');
  
  const { price: _masPrice, usdToMas } = useMasPrice();
  const maxHeirs = TIER_LIMITS.maxHeirs[tier];
  const maxPayload = TIER_LIMITS.maxPayload[tier];
  const hasArweave = TIER_LIMITS.hasArweave[tier];
  const maxBalance = MAX_BALANCE_MAS[tier];
  const maxBalanceDisplay = maxBalance === Infinity ? 'Unlimited' : `${(maxBalance / 1000).toFixed(0)}K`;
  
  const gasEstimate = calculateGasEstimate(intervalDays * ONE_DAY_MS);
  const gasFees = gasEstimate.recommended + ORACLE_FEE;
  const tierPriceUsd = SUBSCRIPTION_PRICES_USD[tier];
  const tierPriceMas = usdToMas(tierPriceUsd);
  const totalMas = tierPriceMas + deposit + gasFees;
  
  const addHeir = () => { if (heirs.length < maxHeirs) setHeirs([...heirs, '']); };
  const removeHeir = (i: number) => { setHeirs(heirs.filter((_, idx) => idx !== i)); };
  const updateHeir = (i: number, v: string) => { const h = [...heirs]; h[i] = v; setHeirs(h); };
  const handleTierChange = (t: number) => {
    setTier(t);
    if (heirs.length > TIER_LIMITS.maxHeirs[t]) setHeirs(heirs.slice(0, TIER_LIMITS.maxHeirs[t]));
    if (message.length > TIER_LIMITS.maxPayload[t]) setMessage(message.slice(0, TIER_LIMITS.maxPayload[t]));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validHeirs = heirs.filter(h => h.trim());
    if (validHeirs.length === 0) { alert('Please add at least one heir'); return; }
    
    let preparedFiles: { encryptedBundle: Uint8Array; encryptionKey: string; iv: string; metadata: any[] } | null = null;
    
    // Step 1: Prepare files (encrypt) but don't upload yet
    if (files.length > 0 && hasArweave) {
      setUploadStatus('Preparing files...');
      try {
        preparedFiles = await prepareFilesForUpload(files);
        setUploadStatus('Files ready. Creating vault...');
      } catch (err) { setUploadStatus('File preparation failed'); return; }
    }
    
    // Step 2: Create vault (pay subscription)
    const payload = preparedFiles ? JSON.stringify({ message, hasFiles: true }) : message;
    await onSubmit(tier, validHeirs, intervalDays, payload, totalMas, tierPriceMas, '', '');
    
    // Step 3: Upload files to Arweave AFTER vault is created
    if (preparedFiles) {
      setUploadStatus('Uploading files to Arweave...');
      try {
        const arweaveTxId = await uploadEncryptedFile(preparedFiles.encryptedBundle, _massaAddress);
        const encryptedKeyStr = JSON.stringify({ key: preparedFiles.encryptionKey, iv: preparedFiles.iv, files: preparedFiles.metadata });
        // Update vault with arweave data
        await onUpdatePayload(payload, arweaveTxId, encryptedKeyStr);
        setUploadStatus('Files uploaded successfully!');
      } catch (err) { setUploadStatus('Upload failed, but vault created. You can add files later.'); }
    }
  };
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', color: c.text, marginBottom: '8px' }}>Create Your Vault</h1>
        <p style={{ color: c.textMuted, fontSize: '14px' }}>Secure your digital assets for your heirs with annual subscription</p>
      </div>
      
      {/* Select Plan */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '16px' }}>Select Plan</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {TIER_NAMES.map((name, i) => (
            <div key={i} onClick={() => handleTierChange(i)} style={{
              position: 'relative', padding: '20px 16px', backgroundColor: c.bgCard,
              border: tier === i ? `2px solid ${c.green}` : `1px solid ${c.border}`, borderRadius: '12px', cursor: 'pointer',
            }}>
              {i === 2 && <span style={{ position: 'absolute', top: '-10px', right: '12px', backgroundColor: c.green, color: c.bg, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Popular</span>}
              <div style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: c.bgMuted, borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: c.textSecondary, marginBottom: '12px' }}>{name}</div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: c.text, marginBottom: '4px' }}>{TIER_PRICES[i]}</div>
              <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '16px' }}>{TIER_SUBTITLES[i]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TIER_LIMITS.features[i].map((f, j) => (
                  <div key={j} style={{ fontSize: '12px', color: f.startsWith('âœ“') ? c.green : f.includes('soon') ? c.textMuted : c.textSecondary }}>{f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Heirs */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text }}>Heirs ({heirs.length}/{maxHeirs})</h3>
          {heirs.length < maxHeirs && <button type="button" onClick={addHeir} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px solid ${c.accent}`, borderRadius: '8px', color: c.accent, fontSize: '13px', cursor: 'pointer' }}>+ Add Heir</button>}
        </div>
        {heirs.length === 0 ? (
          <div onClick={addHeir} style={{ padding: '16px', backgroundColor: c.bgMuted, borderRadius: '8px', color: c.textMuted, fontSize: '14px', cursor: 'pointer' }}>AU1... or AS1...</div>
        ) : heirs.map((heir, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={heir} onChange={(e) => updateHeir(i, e.target.value)} placeholder="AU1... or AS1..." style={{ flex: 1, padding: '14px 16px', backgroundColor: c.bgMuted, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '14px', outline: 'none' }} />
            <button type="button" onClick={() => removeHeir(i)} style={{ padding: '14px 16px', backgroundColor: c.bgMuted, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.textMuted, cursor: 'pointer' }}>Ã—</button>
          </div>
        ))}
      </div>
      
      {/* Check-in Interval */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '8px' }}>Check-in Interval</h3>
        <p style={{ fontSize: '13px', color: c.textMuted, marginBottom: '16px' }}>How often do you need to ping to confirm you're alive?</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {INTERVALS.map((opt) => (
            <button key={opt.label} type="button" onClick={() => setIntervalDays(opt.days)} style={{
              padding: '12px 20px', backgroundColor: intervalDays === opt.days ? c.accent : c.bgMuted,
              border: `1px solid ${intervalDays === opt.days ? c.accent : c.border}`, borderRadius: '8px',
              color: intervalDays === opt.days ? '#fff' : c.textSecondary, fontSize: '14px',
              fontWeight: intervalDays === opt.days ? '600' : '400', cursor: 'pointer',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>
      
      {/* Initial Deposit */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '16px' }}>Initial Deposit</h3>
        <input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} min="1" style={{ width: '100%', padding: '14px 16px', backgroundColor: c.bgMuted, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
        <p style={{ fontSize: '12px', color: c.textMuted, marginTop: '8px' }}>Max for this tier: {maxBalanceDisplay} MAS</p>
      </div>
      
      {/* Legacy Message */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '4px' }}>Legacy Message <span style={{ color: c.textMuted, fontWeight: '400' }}>(optional)</span></h3>
        <p style={{ fontSize: '13px', color: c.textMuted, marginBottom: '16px' }}>A personal message that will be revealed to your heirs</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, maxPayload))} placeholder="Write a message for your heirs..." style={{ width: '100%', minHeight: '120px', padding: '14px 16px', backgroundColor: c.bgMuted, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        <p style={{ fontSize: '12px', color: c.textMuted, textAlign: 'right', marginTop: '8px' }}>{message.length} / {maxPayload} characters</p>
      </div>
      
      {/* Encrypted Files */}
      {hasArweave && (
        <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '4px' }}>Encrypted Files <span style={{ color: c.textMuted, fontWeight: '400' }}>(optional)</span></h3>
          <p style={{ fontSize: '13px', color: c.textMuted, marginBottom: '16px' }}>Upload files to be encrypted and stored on Arweave. Max {TIER_LIMITS.arweaveLimit[tier]}.</p>
          <FileUpload maxSize={tier === 3 ? 1024 * 1024 * 1024 : 50 * 1024 * 1024} onFilesSelected={setFiles} />
          {uploadStatus && <p style={{ fontSize: '13px', color: c.green, marginTop: '12px' }}>{uploadStatus}</p>}
        </div>
      )}
      
      {/* Payment Method */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '16px' }}>Payment Method</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button type="button" onClick={() => setPaymentMethod('mas')} style={{ padding: '20px', backgroundColor: c.bgMuted, border: paymentMethod === 'mas' ? `2px solid ${c.green}` : `1px solid ${c.border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: c.text, marginBottom: '4px' }}>MAS</div>
            <div style={{ fontSize: '12px', color: paymentMethod === 'mas' ? c.green : c.textMuted }}>Native token</div>
          </button>
          <button type="button" onClick={() => setPaymentMethod('usdc')} style={{ padding: '20px', backgroundColor: c.bgMuted, border: paymentMethod === 'usdc' ? `2px solid ${c.green}` : `1px solid ${c.border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: c.text, marginBottom: '4px' }}>USDC</div>
            <div style={{ fontSize: '12px', color: paymentMethod === 'usdc' ? c.green : c.textMuted }}>Stablecoin</div>
          </button>
        </div>
      </div>
      
      {/* Payment Summary */}
      <div style={{ backgroundColor: c.bgCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '20px' }}>Payment Summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.textSecondary, fontSize: '14px' }}>Annual Subscription ({TIER_NAMES[tier]})</span><span style={{ color: c.textSecondary, fontSize: '14px' }}>${tierPriceUsd.toFixed(2)} <span style={{ color: c.textMuted }}>â‰ˆ {Math.round(tierPriceMas)} MAS</span></span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.textSecondary, fontSize: '14px' }}>Initial Deposit</span><span style={{ color: c.text, fontSize: '14px' }}>{deposit} MAS</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: c.textSecondary, fontSize: '14px' }}>Gas + Network Fees</span>
              <span style={{ color: c.textMuted, fontSize: '11px' }}>{gasEstimate.numCalls} ASC call{gasEstimate.numCalls > 1 ? 's' : ''} × {gasEstimate.perCallCost.toFixed(2)} MAS + buffer (×1.3 safety)</span>
            </div>
            <span style={{ color: c.text, fontSize: '14px' }}>{gasFees.toFixed(2)} MAS</span>
          </div>
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.text, fontSize: '16px', fontWeight: '600' }}>Total</span><span style={{ color: c.text, fontSize: '16px', fontWeight: '600' }}>â‰ˆ {Math.round(totalMas)} MAS</span></div>
        </div>
        {AUM_FEES[tier] > 0 && <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: c.bgMuted, borderRadius: '8px', fontSize: '13px', color: c.textMuted }}>ðŸ’¡ {AUM_FEES[tier]}% annual AUM fee will be collected on each ping from your vault balance</div>}
      </div>
      
      {/* Links */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' }}>
        <a href="https://massa.net/get-massa" target="_blank" rel="noopener noreferrer" style={{ color: c.textMuted, fontSize: '14px', textDecoration: 'none' }}>Buy MAS â†’</a>
        <a href="https://bridge.massa.net" target="_blank" rel="noopener noreferrer" style={{ color: c.textMuted, fontSize: '14px', textDecoration: 'none' }}>Massa Bridge â†’</a>
      </div>
      
      {/* Submit */}
      <button onClick={handleSubmit} disabled={loading || heirs.filter(h => h.trim()).length === 0} style={{ width: '100%', padding: '18px', backgroundColor: loading ? c.bgMuted : c.green, border: 'none', borderRadius: '12px', color: loading ? c.textMuted : '#fff', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Creating Vault...' : 'Create Vault'}
      </button>
    </div>
  );
}
