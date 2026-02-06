import type { VaultData } from '../utils/contract';
import {
  TIER_NAMES,
  AUM_FEE_PERCENT,
  formatMassa,
  formatTimeRemaining,
  fromNanoMassa,
  calculateAccruedFee,
} from '../utils/contract';

interface FrozenVaultProps {
  vault: VaultData;
  timeUntilUnlock: number;
  onRenewSubscription: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  loading: boolean;
  subscriptionPriceMas: number;
  subscriptionPriceUsd: number;
}

export function FrozenVault({
  vault,
  timeUntilUnlock,
  onRenewSubscription,
  onDeactivate,
  loading,
  subscriptionPriceMas,
  subscriptionPriceUsd,
}: FrozenVaultProps) {
  const balance = fromNanoMassa(vault.balance);
  const accruedFee = calculateAccruedFee(vault);
  const netBalance = Math.max(0, balance - accruedFee);
  const aumFeePercent = AUM_FEE_PERCENT[vault.tier];

  const isUrgent = timeUntilUnlock < 7 * 24 * 60 * 60 * 1000; // Less than 7 days

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Main Warning Card */}
      <div style={{
        backgroundColor: '#1A1A1F',
        border: '2px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '40px 32px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            fontSize: '40px',
          }}>
            🔒
          </div>
          
          <h1 style={{
            color: '#F87171',
            margin: '0 0 12px 0',
            fontSize: '28px',
            fontWeight: '700',
          }}>
            Subscription Expired
          </h1>
          
          <p style={{
            color: '#A0A0A8',
            margin: 0,
            fontSize: '16px',
            lineHeight: '1.6',
          }}>
            Your vault is frozen. Ping is disabled until you renew.
          </p>
        </div>

        {/* Critical Timer Warning */}
        <div style={{
          padding: '24px 32px',
          backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)',
          borderTop: '1px solid #2A2A30',
          borderBottom: '1px solid #2A2A30',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '24px' }}>{isUrgent ? '🚨' : '⚠️'}</span>
            <div>
              <p style={{
                color: isUrgent ? '#F87171' : '#FBBF24',
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
              }}>
                {isUrgent ? 'URGENT: Timer Almost Expired!' : 'Timer Still Running!'}
              </p>
              <p style={{
                color: '#A0A0A8',
                margin: '4px 0 0 0',
                fontSize: '13px',
              }}>
                If you don't renew and ping, your vault will be distributed to heirs
              </p>
            </div>
          </div>

          <div style={{
            backgroundColor: '#252529',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}>
            <p style={{
              color: '#606068',
              margin: '0 0 8px 0',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Time Until Distribution
            </p>
            <p style={{
              color: isUrgent ? '#F87171' : '#F0F0F2',
              margin: 0,
              fontSize: '42px',
              fontWeight: '700',
              fontFamily: 'monospace',
            }}>
              {formatTimeRemaining(timeUntilUnlock)}
            </p>
          </div>
        </div>

        {/* Vault Info */}
        <div style={{ padding: '24px 32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            marginBottom: '24px',
          }}>
            <div style={{
              backgroundColor: '#252529',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#606068', fontSize: '11px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                Tier
              </p>
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                backgroundColor: vault.tier === 1 ? '#1D4ED8' : vault.tier === 2 ? '#7C3AED' : '#D4AF37',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
              }}>
                {TIER_NAMES[vault.tier]}
              </div>
            </div>

            <div style={{
              backgroundColor: '#252529',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#606068', fontSize: '11px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                Balance
              </p>
              <p style={{ color: '#F0F0F2', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {formatMassa(vault.balance)}
              </p>
            </div>

            <div style={{
              backgroundColor: '#252529',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#606068', fontSize: '11px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                Heirs
              </p>
              <p style={{ color: '#F0F0F2', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {vault.heirs.length}
              </p>
            </div>
          </div>

          {/* AUM Fee Info */}
          {accruedFee > 0.0001 && (
            <div style={{
              backgroundColor: '#252529',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: '#A0A0A8', fontSize: '13px' }}>
                Accrued AUM Fee ({aumFeePercent}%)
              </span>
              <span style={{ color: '#F87171', fontSize: '14px', fontWeight: '500' }}>
                -{accruedFee.toFixed(4)} MAS
              </span>
            </div>
          )}

          {/* Payment Box */}
          <div style={{
            backgroundColor: '#252529',
            border: '1px solid #3A3A40',
            borderRadius: '16px',
            padding: '24px',
          }}>
            <p style={{
              color: '#606068',
              fontSize: '11px',
              margin: '0 0 16px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Renew Subscription
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: '20px',
            }}>
              <div>
                <p style={{ color: '#F0F0F2', fontSize: '32px', fontWeight: '700', margin: 0 }}>
                  ${subscriptionPriceUsd}
                </p>
                <p style={{ color: '#606068', fontSize: '13px', margin: '4px 0 0 0' }}>
                  ≈ {subscriptionPriceMas.toFixed(0)} MAS
                </p>
              </div>
              <p style={{ color: '#606068', fontSize: '13px', margin: 0 }}>
                per year
              </p>
            </div>

            <button
              onClick={onRenewSubscription}
              disabled={loading}
              style={{
                width: '100%',
                padding: '18px',
                backgroundColor: '#22C55E',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: '600',
                fontSize: '16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '20px' }}>🔓</span>
              {loading ? 'Processing...' : 'Pay & Unfreeze Vault'}
            </button>

            <p style={{
              color: '#606068',
              fontSize: '12px',
              margin: '12px 0 0 0',
              textAlign: 'center',
            }}>
              After payment, <strong style={{ color: '#F0F0F2' }}>ping immediately</strong> to reset the timer!
            </p>
          </div>
        </div>

        {/* Alternative: Deactivate */}
        <div style={{
          padding: '24px 32px',
          backgroundColor: '#151518',
          borderTop: '1px solid #2A2A30',
        }}>
          <p style={{
            color: '#606068',
            fontSize: '13px',
            margin: '0 0 16px 0',
          }}>
            Don't want to continue? Get your funds back:
          </p>
          
          <button
            onClick={onDeactivate}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'transparent',
              border: '1px solid #F87171',
              borderRadius: '10px',
              color: '#F87171',
              fontWeight: '500',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            🗑️ Deactivate Vault & Withdraw
          </button>
          
          <p style={{
            color: '#606068',
            fontSize: '11px',
            margin: '10px 0 0 0',
            textAlign: 'center',
          }}>
            You'll receive approximately <strong style={{ color: '#A0A0A8' }}>{netBalance.toFixed(2)} MAS</strong> after AUM fee deduction
          </p>
        </div>
      </div>

      {/* Heirs List */}
      <div style={{
        backgroundColor: '#1A1A1F',
        border: '1px solid #2A2A30',
        borderRadius: '16px',
        padding: '24px',
        marginTop: '20px',
      }}>
        <p style={{
          color: '#606068',
          fontSize: '11px',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
        }}>
          Designated Heirs ({vault.heirs.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {vault.heirs.map((heir, i) => (
            <div key={i} style={{
              padding: '12px',
              backgroundColor: '#252529',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span>👤</span>
              <code style={{ color: '#A0A0A8', fontSize: '12px', fontFamily: 'monospace' }}>
                {heir}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
