import { useState } from 'react';

interface WelcomeScreenProps {
  onConnect: (walletType: string) => void;
  pendingAccounts?: { walletName: string; accounts: any[] } | null;
  selectAccount?: (index: number) => void;
  cancelAccountSelection?: () => void;
}

const t = {
  bg: '#0F0F12',
  bgElevated: '#16161a',
  bgSurface: '#1c1c21',
  bgHover: '#252529',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  textTertiary: '#666666',
  accent: '#c9a227',
  accentHover: '#ddb832',
  border: '#2a2a30',
  borderHover: '#3a3a42',
};

const type = {
  displayLg: { fontSize: '56px', fontWeight: '300' as const, lineHeight: '1.1', letterSpacing: '-0.02em' },
  h2: { fontSize: '24px', fontWeight: '500' as const, lineHeight: '1.25' },
  h3: { fontSize: '18px', fontWeight: '500' as const, lineHeight: '1.3' },
  bodyLg: { fontSize: '17px', fontWeight: '400' as const, lineHeight: '1.6' },
  body: { fontSize: '15px', fontWeight: '400' as const, lineHeight: '1.6' },
  bodySm: { fontSize: '13px', fontWeight: '400' as const, lineHeight: '1.5' },
  label: { fontSize: '12px', fontWeight: '500' as const, lineHeight: '1', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
  caption: { fontSize: '12px', fontWeight: '400' as const, lineHeight: '1.4' },
};

const sp = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '96px' };

const ParticlesBackground = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    <style>{`
      @keyframes floatUp {
        0% { transform: translateY(100vh); }
        100% { transform: translateY(-20px); }
      }
    `}</style>
    {Array.from({ length: 60 }, (_, i) => (
      <div key={i} style={{
        position: 'absolute',
        left: `${(i * 13 + 5) % 100}%`,
        bottom: `${(i * 7) % 100}%`,
        width: `${2 + (i % 2)}px`,
        height: `${2 + (i % 2)}px`,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: '50%',
        animation: `floatUp ${20 + (i % 15)}s linear infinite`,
        animationDelay: `-${(i * 0.5) % 20}s`,
      }} />
    ))}
  </div>
);

const OriginalLogo = ({ size = 280 }: { size?: number }) => {
  const [animationKey, setAnimationKey] = useState(0);
  const hex = (cx: number, cy: number, s: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`);
    }
    return pts.join(' ');
  };
  const hexagons = [
    { x: 400, y: 200, size: 28, glow: 0.3, delay: 0 }, { x: 355, y: 243, size: 28, glow: 0.4, delay: 0.1 },
    { x: 445, y: 243, size: 28, glow: 0.4, delay: 0.15 }, { x: 310, y: 286, size: 28, glow: 0.5, delay: 0.2 },
    { x: 400, y: 286, size: 28, glow: 0.5, delay: 0.25 }, { x: 490, y: 286, size: 28, glow: 0.5, delay: 0.3 },
    { x: 265, y: 329, size: 28, glow: 0.6, delay: 0.35 }, { x: 355, y: 329, size: 28, glow: 0.6, delay: 0.4 },
    { x: 445, y: 329, size: 28, glow: 0.6, delay: 0.45 }, { x: 535, y: 329, size: 28, glow: 0.6, delay: 0.5 },
    { x: 220, y: 372, size: 28, glow: 0.7, delay: 0.55 }, { x: 310, y: 372, size: 28, glow: 0.8, delay: 0.6 },
    { x: 490, y: 372, size: 28, glow: 0.8, delay: 0.7 }, { x: 580, y: 372, size: 28, glow: 0.7, delay: 0.75 },
    { x: 265, y: 415, size: 28, glow: 0.6, delay: 0.8 }, { x: 355, y: 415, size: 28, glow: 0.6, delay: 0.85 },
    { x: 445, y: 415, size: 28, glow: 0.6, delay: 0.9 }, { x: 535, y: 415, size: 28, glow: 0.6, delay: 0.95 },
    { x: 310, y: 458, size: 28, glow: 0.5, delay: 1 }, { x: 400, y: 458, size: 28, glow: 0.5, delay: 1.05 },
    { x: 490, y: 458, size: 28, glow: 0.5, delay: 1.1 }, { x: 355, y: 501, size: 28, glow: 0.4, delay: 1.15 },
    { x: 445, y: 501, size: 28, glow: 0.4, delay: 1.2 }, { x: 400, y: 544, size: 28, glow: 0.3, delay: 1.25 },
  ];
  const connections: number[][] = [
    [400, 200, 355, 243], [400, 200, 445, 243], [355, 243, 310, 286], [355, 243, 400, 286],
    [445, 243, 400, 286], [445, 243, 490, 286], [265, 329, 355, 329], [355, 329, 445, 329],
    [445, 329, 535, 329], [220, 372, 310, 372], [310, 372, 400, 372], [400, 372, 490, 372],
    [490, 372, 580, 372], [265, 415, 355, 415], [355, 415, 445, 415], [445, 415, 535, 415],
    [310, 286, 265, 329], [400, 286, 355, 329], [400, 286, 445, 329], [490, 286, 535, 329],
    [265, 329, 220, 372], [355, 329, 310, 372], [445, 329, 490, 372], [535, 329, 580, 372],
    [220, 372, 265, 415], [310, 372, 355, 415], [490, 372, 445, 415], [580, 372, 535, 415],
    [265, 415, 310, 458], [355, 415, 400, 458], [445, 415, 400, 458], [535, 415, 490, 458],
    [310, 458, 355, 501], [400, 458, 355, 501], [400, 458, 445, 501], [490, 458, 445, 501],
    [355, 501, 400, 544], [445, 501, 400, 544],
  ];
  return (
    <div onMouseEnter={() => setAnimationKey(prev => prev + 1)} style={{ cursor: 'pointer' }}>
      <svg key={animationKey} viewBox="0 0 800 650" width={size} height={size * 0.8125}>
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e4d7b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2a6ba8" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#ffd700" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
          </radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="strongGlow"><feGaussianBlur stdDeviation="6" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <style>{`
          @keyframes fadeInHex { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
          @keyframes drawLine { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
          @keyframes keyholeGlow { 0%, 100% { filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.9)); } 50% { filter: drop-shadow(0 0 25px rgba(255, 215, 0, 1)); } }
          .hex-anim { animation: fadeInHex 0.6s ease-out backwards; transform-origin: center; transform-box: fill-box; }
          .line-anim { stroke-dasharray: 100; stroke-dashoffset: 100; animation: drawLine 1s ease-out forwards; }
          .center-hex-anim { animation: fadeInHex 0.8s ease-out 0.65s backwards, keyholeGlow 3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        `}</style>
        <circle cx="400" cy="372" r="200" fill="url(#centerGlow)" opacity="0.4" />
        <g>{connections.map(([x1, y1, x2, y2], i) => (<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#blueGradient)" strokeWidth="2" strokeOpacity="0.6" className="line-anim" style={{ animationDelay: `${i * 0.02}s` }} />))}</g>
        <g>{hexagons.map((h, i) => (<g key={i}><polygon points={hex(h.x, h.y, h.size)} fill="none" stroke="url(#blueGradient)" strokeWidth="2.5" opacity={h.glow} filter="url(#glow)" className="hex-anim" style={{ animationDelay: `${h.delay}s` }} /><polygon points={hex(h.x, h.y, h.size - 3)} fill="url(#blueGradient)" opacity={h.glow * 0.15} className="hex-anim" style={{ animationDelay: `${h.delay}s` }} /><circle cx={h.x} cy={h.y} r="2" fill="#5a8fbd" opacity={h.glow * 0.8} className="hex-anim" style={{ animationDelay: `${h.delay}s` }} /></g>))}</g>
        <g>
          <polygon points={hex(400, 372, 40)} fill="none" stroke="url(#goldGradient)" strokeWidth="1" opacity="0.3" className="center-hex-anim" />
          <polygon points={hex(400, 372, 32)} fill="url(#goldGradient)" stroke="url(#goldGradient)" strokeWidth="2.5" filter="url(#strongGlow)" className="center-hex-anim" />
          <g className="center-hex-anim"><circle cx="400" cy="369" r="8" fill="#02010a" opacity="0.95" /><rect x="397" y="374" width="6" height="12" fill="#02010a" opacity="0.95" /></g>
        </g>
      </svg>
    </div>
  );
};

export function WelcomeScreen({ onConnect, pendingAccounts, selectAccount, cancelAccountSelection }: WelcomeScreenProps) {
  const [showModal, setShowModal] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const features = [
    { title: 'Autonomous Execution', desc: 'Smart contracts execute with mathematical certainty. No intermediaries, no delays.' },
    { title: "Dead Man's Switch", desc: 'Assets transfer only after verified inactivity. Your legacy protected by cryptographic guarantees.' },
    { title: 'Military-Grade Encryption', desc: 'AES-256 client-side encryption. Your documents remain private — even from us.' },
  ];
  const stats = [{ value: '$2.4M', label: 'Assets Protected' }, { value: '1,247', label: 'Active Vaults' }, { value: '99.9%', label: 'Uptime' }];
  if (pendingAccounts && pendingAccounts.accounts.length > 0) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
        <ParticlesBackground />
        <div style={{ backgroundColor: t.bgElevated, borderRadius: '16px', border: `1px solid ${t.border}`, padding: sp.xl, width: '420px', maxWidth: '90vw', position: 'relative', zIndex: 10 }}>
          <h2 style={{ ...type.h2, color: t.textPrimary, margin: `0 0 ${sp.xs}` }}>Select Account</h2>
          <p style={{ ...type.bodySm, color: t.textTertiary, margin: `0 0 ${sp.lg}` }}>Choose an account to connect</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp.sm }}>
            {pendingAccounts.accounts.map((account, i) => (
              <button key={i} onClick={() => selectAccount?.(i)} style={{ padding: sp.md, backgroundColor: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ ...type.body, fontWeight: '500', color: t.textPrimary }}>{account.name || `Account ${i + 1}`}</div>
                <div style={{ ...type.caption, color: t.textTertiary, fontFamily: 'monospace' }}>{account.address.slice(0, 10)}...{account.address.slice(-8)}</div>
              </button>
            ))}
          </div>
          <button onClick={cancelAccountSelection} style={{ width: '100%', padding: sp.sm, marginTop: sp.md, backgroundColor: 'transparent', border: 'none', ...type.bodySm, color: t.textTertiary, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', backgroundColor: t.bg, color: t.textPrimary, fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <ParticlesBackground />
      <header style={{ padding: `${sp.lg} ${sp.xl}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <a href="https://legacy-vault.xyz" style={{ ...type.label, color: t.textPrimary, letterSpacing: '0.2em', textDecoration: 'none' }}>LEGACY VAULT</a>
        <button onClick={() => setShowModal(true)} onMouseEnter={() => setHoveredBtn('header')} onMouseLeave={() => setHoveredBtn(null)} style={{ padding: `10px ${sp.lg}`, ...type.bodySm, fontWeight: '500', backgroundColor: hoveredBtn === 'header' ? t.accentHover : t.accent, color: t.bg, border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Connect Wallet</button>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${sp['3xl']} ${sp.xl}`, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: sp.xl }}><OriginalLogo size={320} /></div>
        <div style={{ ...type.label, color: t.accent, marginBottom: sp.lg, letterSpacing: '0.25em' }}>DIGITAL ESTATE MANAGEMENT</div>
        <h1 style={{ ...type.displayLg, color: t.textPrimary, maxWidth: '720px', margin: `0 0 ${sp.lg}` }}>Your legacy, secured by mathematics</h1>
        <p style={{ ...type.bodyLg, color: t.textSecondary, maxWidth: '520px', margin: `0 0 ${sp['4xl']}` }}>Autonomous inheritance management on the blockchain. Assets protected and transferred with cryptographic certainty.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: sp.lg, maxWidth: '960px', width: '100%' }}>
          {features.map((f, i) => (
            <div key={i} onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)} style={{ padding: sp.xl, backgroundColor: hoveredCard === i ? t.bgHover : t.bgSurface, borderRadius: '12px', border: `1px solid ${hoveredCard === i ? t.borderHover : t.border}`, textAlign: 'left' }}>
              <h3 style={{ ...type.h3, color: t.textPrimary, margin: `0 0 ${sp.sm}` }}>{f.title}</h3>
              <p style={{ ...type.bodySm, color: t.textTertiary, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
      <div style={{ padding: `${sp.xl} ${sp.xl}`, borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'center', gap: sp['3xl'], position: 'relative', zIndex: 1 }}>
        {stats.map((s, i) => (<div key={i} style={{ textAlign: 'center' }}><div style={{ ...type.h2, color: t.textPrimary, marginBottom: sp.xs }}>{s.value}</div><div style={{ ...type.caption, color: t.textTertiary }}>{s.label}</div></div>))}
      </div>
      <footer style={{ padding: `${sp.lg} ${sp.xl}`, borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ ...type.caption, color: t.textTertiary }}>© 2026 Legacy Vault</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp.xl }}>
          <a href="https://station.massa.net/" target="_blank" rel="noopener noreferrer" style={{ ...type.caption, fontWeight: '500', color: t.accent, textDecoration: 'none' }}>Download Massa Station</a>
          <span style={{ color: t.border }}>|</span>
          <a href="https://github.com/legacyvault" target="_blank" rel="noopener noreferrer" style={{ ...type.caption, color: t.textTertiary, textDecoration: 'none' }}>GitHub</a>
          <a href="https://t.me/legacyvault" target="_blank" rel="noopener noreferrer" style={{ ...type.caption, color: t.textTertiary, textDecoration: 'none' }}>Telegram</a>
        </div>
        <div style={{ ...type.caption, color: t.textTertiary }}>Powered by Massa</div>
      </footer>
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowModal(false)}>
          <div style={{ backgroundColor: t.bgElevated, borderRadius: '16px', border: `1px solid ${t.border}`, padding: sp.xl, width: '380px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...type.h2, color: t.textPrimary, margin: `0 0 ${sp.xs}` }}>Connect Wallet</h2>
            <p style={{ ...type.bodySm, color: t.textTertiary, margin: `0 0 ${sp.lg}` }}>Select your preferred wallet</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: sp.sm }}>
              {[{ name: 'Bearby', desc: 'Browser extension', type: 'BEARBY' }, { name: 'Massa Station', desc: 'Desktop application', type: 'MASSA WALLET' }].map((wallet, i) => (
                <button key={i} onClick={() => { onConnect(wallet.type); setShowModal(false); }} style={{ padding: sp.md, backgroundColor: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ ...type.body, fontWeight: '500', color: t.textPrimary }}>{wallet.name}</div>
                  <div style={{ ...type.caption, color: t.textTertiary }}>{wallet.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: sp.lg, paddingTop: sp.md, borderTop: `1px solid ${t.border}`, textAlign: 'center' }}>
              <p style={{ ...type.caption, color: t.textTertiary, margin: `0 0 ${sp.sm}` }}>Don't have a wallet?</p>
              <a href="https://station.massa.net/" target="_blank" rel="noopener noreferrer" style={{ ...type.bodySm, fontWeight: '500', color: t.accent, textDecoration: 'none' }}>Download Massa Station</a>
            </div>
            <button onClick={() => setShowModal(false)} style={{ width: '100%', padding: sp.sm, marginTop: sp.md, backgroundColor: 'transparent', border: 'none', ...type.bodySm, color: t.textTertiary, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WelcomeScreen;
