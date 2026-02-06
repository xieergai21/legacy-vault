import { useState } from 'react';
import { useMasPrice } from '../hooks/useMasPrice';

interface PaymentChoiceProps {
  tierPriceUsd: number;
  gasTankMas: number;
  extraMas: number;
  tierName: string;
  onPayMas: (totalMas: number) => void;
  onPayUsdt: (usdtAmount: number, masFees: number) => void;
  loading?: boolean;
}

const c = {
  bg: '#0F0F12',
  bgCard: '#1A1A1F',
  bgMuted: '#252529',
  text: '#F0F0F2',
  textSecondary: '#A0A0A8',
  textMuted: '#606068',
  accent: '#E8E8EC',
  success: '#4ADE80',
  border: '#2A2A30',
};

export function PaymentChoice({ tierPriceUsd, gasTankMas, extraMas, tierName, onPayMas, onPayUsdt, loading }: PaymentChoiceProps) {
  const [selected, setSelected] = useState<'mas' | 'usdt' | null>(null);
  const { price: masPrice, loading: priceLoading, usdToMas, lastUpdate } = useMasPrice();

  const tierPriceMas = usdToMas(tierPriceUsd);
  const totalMas = tierPriceMas + gasTankMas + extraMas;
  const totalMasWithBuffer = totalMas * 1.02;
  const masFees = gasTankMas + extraMas;

  if (tierPriceUsd === 0) return null;

  const handleCreateVault = () => {
    if (selected === 'mas') onPayMas(totalMasWithBuffer);
    else if (selected === 'usdt') onPayUsdt(tierPriceUsd, masFees);
  };

  return (
    <div style={{ marginTop: '24px', marginBottom: '24px' }}>
      <div style={{ padding: '32px', background: c.bgCard, borderRadius: '16px', border: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 style={{ color: c.text, fontSize: '15px', fontWeight: 500, margin: 0 }}>Select Payment Method</h3>
          {lastUpdate && <span style={{ color: c.textMuted, fontSize: '12px', fontFamily: 'monospace' }}>Updated {lastUpdate.toLocaleTimeString()}</span>}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {/* MAS Option */}
          <button type="button" onClick={() => setSelected('mas')} style={{
            flex: 1, padding: '24px', background: selected === 'mas' ? c.bgMuted : 'transparent',
            border: selected === 'mas' ? `1px solid ${c.accent}` : `1px solid ${c.border}`,
            borderRadius: '12px', cursor: 'pointer', textAlign: 'left', position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', width: '20px', height: '20px', borderRadius: '50%', border: selected === 'mas' ? `2px solid ${c.accent}` : `2px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selected === 'mas' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.accent }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.textSecondary} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h8"/></svg>
              <span style={{ color: c.text, fontWeight: 500 }}>Pay with MAS</span>
            </div>
            <div style={{ color: c.text, fontSize: '24px', fontWeight: 300, marginBottom: '8px' }}>
              {priceLoading ? '...' : `${totalMasWithBuffer.toLocaleString('en-US', { maximumFractionDigits: 1 })} MAS`}
            </div>
            <span style={{ padding: '4px 10px', background: c.bgMuted, borderRadius: '4px', color: c.textSecondary, fontSize: '11px', fontWeight: 500, border: `1px solid ${c.border}` }}>LIVE PRICE</span>
            <div style={{ height: '1px', background: c.border, margin: '16px 0 12px' }} />
            <div style={{ color: c.textMuted, fontSize: '12px', fontFamily: 'monospace' }}>1 MAS = ${masPrice?.toFixed(4) || '...'}</div>
          </button>

          {/* USDT Option */}
          <button type="button" onClick={() => setSelected('usdt')} style={{
            flex: 1, padding: '24px', background: selected === 'usdt' ? c.bgMuted : 'transparent',
            border: selected === 'usdt' ? `1px solid ${c.success}` : `1px solid ${c.border}`,
            borderRadius: '12px', cursor: 'pointer', textAlign: 'left', position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', width: '20px', height: '20px', borderRadius: '50%', border: selected === 'usdt' ? `2px solid ${c.success}` : `2px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selected === 'usdt' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.success }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.success} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8 10h8c0 2-2 3-4 3s-4-1-4-3m0 4h8"/></svg>
              <span style={{ color: c.text, fontWeight: 500 }}>Pay with USDT</span>
            </div>
            <div style={{ color: c.text, fontSize: '24px', fontWeight: 300, marginBottom: '8px' }}>{tierPriceUsd.toFixed(2)} USDT</div>
            <span style={{ padding: '4px 10px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '4px', color: c.success, fontSize: '11px', fontWeight: 500 }}>STABLE PRICE</span>
            <div style={{ height: '1px', background: c.border, margin: '16px 0 12px' }} />
            <div style={{ color: c.textMuted, fontSize: '12px' }}>+ {masFees.toFixed(2)} MAS for fees</div>
          </button>
        </div>

        {selected && (
          <div style={{ background: c.bgMuted, borderRadius: '12px', padding: '20px', marginBottom: '24px', border: `1px solid ${c.border}` }}>
            <h4 style={{ fontSize: '14px', fontWeight: 500, color: c.text, marginBottom: '16px', marginTop: 0 }}>
              Payment Summary {selected === 'mas' ? '(All in MAS)' : '(USDT + MAS)'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: c.textSecondary }}>
                <span>Plan ({tierName})</span>
                <span>{selected === 'mas' ? `${tierPriceMas.toFixed(2)} MAS` : `${tierPriceUsd.toFixed(2)} USDT`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: c.textSecondary }}>
                <span>Gas Tank</span>
                <span>{gasTankMas} MAS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: c.textSecondary }}>
                <span>For heirs</span>
                <span>{extraMas.toFixed(2)} MAS</span>
              </div>
              <div style={{ height: '1px', background: c.border, margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: c.text, fontWeight: 600 }}>
                <span>Total</span>
                <span>
                  {selected === 'mas' 
                    ? `${totalMasWithBuffer.toFixed(2)} MAS` 
                    : <>{tierPriceUsd.toFixed(2)} USDT <span style={{ color: c.textSecondary, fontWeight: 400 }}>+ {masFees.toFixed(2)} MAS</span></>
                  }
                </span>
              </div>
              {selected === 'mas' && (
                <div style={{ color: c.textMuted, fontSize: '12px', textAlign: 'right' }}>Includes 2% buffer for price changes</div>
              )}
            </div>
          </div>
        )}

        <button type="button" onClick={handleCreateVault} disabled={!selected || loading || priceLoading} style={{
          width: '100%', padding: '18px 32px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600,
          background: selected ? c.accent : c.bgMuted,
          color: selected ? c.bg : c.textMuted,
          cursor: selected && !loading ? 'pointer' : 'not-allowed',
          opacity: loading ? 0.6 : 1
        }}>{loading ? 'Processing...' : 'Create Vault'}</button>

        <div style={{ textAlign: 'center', marginTop: '16px', color: c.textMuted, fontSize: '13px' }}>
          {selected === 'mas' && <>Need MAS? <a href="https://www.massa.net/get-mas" target="_blank" rel="noopener noreferrer" style={{ color: c.textSecondary, textDecoration: 'underline' }}>Get MAS →</a></>}
          {selected === 'usdt' && <>Need USDT? <a href="https://bridge.massa.net" target="_blank" rel="noopener noreferrer" style={{ color: c.success, textDecoration: 'underline' }}>Bridge →</a></>}
          {!selected && <>Select a payment method to continue</>}
        </div>
      </div>
    </div>
  );
}
