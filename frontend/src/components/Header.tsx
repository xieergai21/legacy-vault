import { useState } from 'react';

interface PendingAccounts {
  walletName: string;
  accounts: any[];
}

interface HeaderProps {
  viewMode: "owner" | "heir";
  setViewMode: (mode: "owner" | "heir") => void;
  address: string | null;
  isConnecting: boolean;
  walletName: string | null;
  availableWallets: string[];
  onConnect: (walletType?: string) => Promise<boolean>;
  onDisconnect: () => void;
  error: string | null;
  pendingAccounts: PendingAccounts | null;
  selectAccount: (index: number) => void;
  cancelAccountSelection: () => void;
}
const c = {
  bg: '#0F0F12',
  bgCard: '#1A1A1F',
  bgMuted: '#252529',
  bgHover: '#2A2A30',
  text: '#F0F0F2',
  textSecondary: '#A0A0A8',
  textMuted: '#606068',
  accent: '#E8E8EC',
  border: '#2A2A30',
  danger: '#F87171',
  dangerBg: 'rgba(248, 113, 113, 0.08)',
};

export function Header({ 
  viewMode,
  setViewMode,
  address, 
  isConnecting, 
  walletName,
  availableWallets,
  onConnect, 
  onDisconnect, 
  error,
  pendingAccounts,
  selectAccount,
  cancelAccountSelection,
}: HeaderProps) {
  const [showModal, setShowModal] = useState(false);

  const handleConnect = async (type: string) => {
    await onConnect(type);
    setShowModal(false);
  };

  return (
    <div>
      <header style={{
        backgroundColor: c.bgCard,
        borderBottom: `1px solid ${c.border}`,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: '600', 
              letterSpacing: '0.12em',
              color: c.text 
            }}>
              LEGACY VAULT
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: c.textMuted,
              letterSpacing: '0.02em'
            }}>
              Digital Estate Management
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {address ? (
              <>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '10px', 
                    color: c.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}>{walletName || 'Connected'}</div>
                  <div style={{ 
                    fontSize: '13px', 
                    fontFamily: "monospace",
                    color: c.textSecondary 
                  }}>{address.slice(0,8)}...{address.slice(-6)}</div>
                </div>
                <button onClick={onDisconnect} style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  color: c.textSecondary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${c.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>Disconnect</button>
              </>
            ) : (
              <button onClick={() => setShowModal(true)} disabled={isConnecting} style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '500',
                color: c.bg,
                backgroundColor: c.accent,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</button>
            )}
          </div>
        </div>
      </header>
      <div style={{ height: "70px" }}></div>
      {/* Navigation */}
      <nav style={{ backgroundColor: c.bgCard, borderBottom: `1px solid ${c.border}` }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px", display: "flex", gap: "32px" }}>
          <button onClick={() => setViewMode("owner")} style={{ position: "relative", padding: "14px 0", fontSize: "14px", display: "flex", alignItems: "center", fontWeight: 500, color: viewMode === "owner" ? c.text : c.textMuted, background: "transparent", border: "none", cursor: "pointer" }}>My Vault{viewMode === "owner" && <div style={{ position: "absolute", bottom: "-1px", left: 0, right: 0, height: "2px", background: c.accent }} />}</button>
          <button onClick={() => setViewMode("heir")} style={{ position: "relative", padding: "14px 0", fontSize: "14px", display: "flex", alignItems: "center", fontWeight: 500, color: viewMode === "heir" ? c.text : c.textMuted, background: "transparent", border: "none", cursor: "pointer" }}>Inheritance{viewMode === "heir" && <div style={{ position: "absolute", bottom: "-1px", left: 0, right: 0, height: "2px", background: c.accent }} />}</button>
        </div>
      </nav>

      

      {pendingAccounts && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            backgroundColor: c.bgCard, borderRadius: '16px',
            border: `1px solid ${c.border}`, padding: '24px',
            width: '380px', maxWidth: '90vw'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: c.text, margin: '0 0 4px' }}>Select Account</h2>
            <p style={{ fontSize: '13px', color: c.textMuted, margin: '0 0 20px' }}>
              Choose from {pendingAccounts.walletName}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {pendingAccounts.accounts.map((acc, i) => (
                <button key={i} onClick={() => selectAccount(i)} style={{
                  padding: '14px', backgroundColor: c.bgMuted, border: `1px solid ${c.border}`,
                  borderRadius: '10px', color: c.text, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: '13px', textAlign: 'left'
                }}>{String(acc.address).slice(0,12)}...{String(acc.address).slice(-10)}</button>
              ))}
            </div>
            <button onClick={cancelAccountSelection} style={{
              width: '100%', marginTop: '16px', padding: '12px',
              backgroundColor: 'transparent', border: `1px solid ${c.border}`,
              borderRadius: '8px', color: c.textMuted, cursor: 'pointer', fontSize: '13px'
            }}>Cancel</button>
          </div>
        </div>
      )}

      {showModal && !pendingAccounts && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100
        }} onClick={() => setShowModal(false)}>
          <div style={{
            backgroundColor: c.bgCard, borderRadius: '16px',
            border: `1px solid ${c.border}`, padding: '24px',
            width: '380px', maxWidth: '90vw'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: c.text, margin: '0 0 4px' }}>Connect Wallet</h2>
            <p style={{ fontSize: '13px', color: c.textMuted, margin: '0 0 20px' }}>Select your preferred wallet</p>
            
            {error && (
              <div style={{
                backgroundColor: c.dangerBg, border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: '8px', padding: '12px', marginBottom: '16px',
                color: c.danger, fontSize: '13px'
              }}>{error}</div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableWallets.filter(w => w !== 'Private Key').map(w => (
                <button key={w} onClick={() => handleConnect(w)} style={{
                  padding: '14px 16px', backgroundColor: c.bgMuted,
                  border: `1px solid ${c.border}`, borderRadius: '10px',
                  color: c.text, cursor: 'pointer', fontSize: '14px',
                  fontWeight: '500', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  {w}
                  <span style={{ color: c.textMuted, fontSize: '18px' }}>→</span>
                </button>
              ))}
            </div>
            
            <button onClick={() => setShowModal(false)} style={{
              width: '100%', marginTop: '16px', padding: '12px',
              backgroundColor: 'transparent', border: 'none',
              color: c.textMuted, cursor: 'pointer', fontSize: '13px'
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
