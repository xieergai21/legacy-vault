import { useState, useEffect } from 'react';

interface Props {
  vaultOwner: string;
  tier: number;
  heirs: string[];
  onClose?: () => void;
}

interface HeirNotif {
  walletAddress: string;
  email: string;
}

const API = 'https://legacy-vault-notifications.legacy-vault-notifications.workers.dev';

export function NotificationSettings({ vaultOwner, tier, heirs, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [heirNotifs, setHeirNotifs] = useState<HeirNotif[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [ownerEnabled, setOwnerEnabled] = useState(false);
  const hasAccess = tier >= 1;

  useEffect(() => {
    setHeirNotifs(heirs.map(a => ({ walletAddress: a, email: '' })));
    if (hasAccess) {
      fetch(API + '/api/subscription?vaultOwner=' + vaultOwner)
        .then(r => r.json())
        .then(d => {
          if (d.subscription) {
            setSubscribed(true);
            setOwnerEmail(d.subscription.ownerEmail || '');
            setOwnerEnabled(!!d.subscription.ownerEmail);
            if (d.subscription.heirNotifications) {
              setHeirNotifs(heirs.map(a => {
                const e = d.subscription.heirNotifications.find((h: HeirNotif) => h.walletAddress === a);
                return { walletAddress: a, email: e?.email || '' };
              }));
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [vaultOwner, tier, heirs, hasAccess]);

  const save = async () => {
    setError(null); setSaving(true);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (ownerEnabled && ownerEmail && !re.test(ownerEmail)) { setError('Invalid email'); setSaving(false); return; }
    const valid = heirNotifs.filter(h => h.email.trim() && re.test(h.email));
    if (!ownerEmail && !valid.length) { setError('Enter at least one email'); setSaving(false); return; }
    try {
      const res = await fetch(API + '/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultOwner, ownerEmail: ownerEnabled ? ownerEmail : undefined, heirNotifications: valid.length ? valid : undefined })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSubscribed(true);
      onClose?.();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    setSaving(false);
  };

  const disable = async () => {
    if (!confirm('Disable all notifications?')) return;
    setSaving(true);
    await fetch(API + '/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vaultOwner }) });
    setSubscribed(false); setOwnerEmail(''); setOwnerEnabled(false);
    setHeirNotifs(heirs.map(a => ({ walletAddress: a, email: '' })));
    setSaving(false);
  };

  const shortAddr = (a: string) => a.slice(0, 8) + '...' + a.slice(-6);

  if (loading) return (
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#18181B', borderRadius: '16px', padding: '32px', width: '420px', border: '1px solid #27272A' }}>
        <p style={{ color: '#71717A', textAlign: 'center', margin: 0 }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#18181B', borderRadius: '16px', padding: '28px', width: '420px', border: '1px solid #27272A' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#FAFAFA', fontSize: '16px', fontWeight: 600, margin: 0 }}>Notifications</h2>
          <button onClick={onClose} style={{ background: '#27272A', border: 'none', borderRadius: '8px', width: '32px', height: '32px', color: '#71717A', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {error && <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#EF4444', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

        {!hasAccess ? (
          <div style={{ background: '#27272A', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <p style={{ color: '#A1A1AA', margin: 0, fontSize: '14px' }}>Available on LIGHT tier and above</p>
          </div>
        ) : (
          <>
            {/* Owner reminder */}
            <div style={{ background: '#1F1F23', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ownerEnabled ? '12px' : 0 }}>
                <div>
                  <p style={{ color: '#FAFAFA', fontSize: '14px', fontWeight: 500, margin: 0 }}>Owner reminder</p>
                  <p style={{ color: '#71717A', fontSize: '12px', margin: '4px 0 0 0' }}>24h before vault unlocks</p>
                </div>
                <button onClick={() => setOwnerEnabled(!ownerEnabled)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: ownerEnabled ? '#22C55E' : '#3F3F46', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', top: '2px', left: ownerEnabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '10px', background: '#FFF', transition: 'left 0.2s' }} />
                </button>
              </div>
              {ownerEnabled && (
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="your@email.com" style={{ width: '100%', padding: '12px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: '8px', color: '#FAFAFA', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>

            {/* Heir notifications */}
            <div style={{ background: '#1F1F23', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ color: '#FAFAFA', fontSize: '14px', fontWeight: 500, margin: '0 0 4px 0' }}>Heir alerts</p>
              <p style={{ color: '#71717A', fontSize: '12px', margin: '0 0 16px 0' }}>Notified when vault unlocks</p>
              
              {heirNotifs.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: i < heirNotifs.length - 1 ? '10px' : 0 }}>
                  <span style={{ color: '#52525B', fontSize: '11px', fontFamily: 'monospace', minWidth: '90px' }}>{shortAddr(h.walletAddress)}</span>
                  <input type="email" value={h.email} onChange={e => { const u = [...heirNotifs]; u[i].email = e.target.value; setHeirNotifs(u); }} placeholder="heir@email.com" style={{ flex: 1, padding: '10px 12px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: '8px', color: '#FAFAFA', fontSize: '13px', outline: 'none' }} />
                </div>
              ))}
            </div>

            {/* Actions */}
            <button onClick={save} disabled={saving} style={{ width: '100%', padding: '14px', background: '#22C55E', border: 'none', borderRadius: '10px', color: '#FFF', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, marginBottom: subscribed ? '10px' : 0 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            
            {subscribed && (
              <button onClick={disable} disabled={saving} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #3F3F46', borderRadius: '10px', color: '#71717A', fontSize: '13px', cursor: 'pointer' }}>
                Disable notifications
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function NotificationBell({ vaultOwner, tier, heirs }: { vaultOwner: string; tier: number; heirs: string[] }) {
  const [show, setShow] = useState(false);
  const ok = tier >= 1;
  return (
    <>
      <button onClick={() => setShow(true)} style={{ padding: '10px 16px', background: '#252529', border: '1px solid #3A3A40', borderRadius: '8px', color: '#A0A0A8', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
        {ok ? 'Alerts' : 'PRO'}
      </button>
      {show && <NotificationSettings vaultOwner={vaultOwner} tier={tier} heirs={heirs} onClose={() => setShow(false)} />}
    </>
  );
}
