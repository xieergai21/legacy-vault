import { useState } from 'react';
import type { VaultData } from '../utils/contract';
import { downloadFromArweave, importKey, decryptData } from '../utils/arweave';

interface HeirDashboardProps {
  vault: VaultData;
  ownerAddress: string;
  onDecrypt: (arweaveTxId: string, encryptedKey: string) => void;
}

interface FileMetadata {
  name: string;
  type: string;
  size: number;
}

interface PayloadData {
  message?: string;
  arweave?: string;
  key?: string;
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
  successBg: 'rgba(74, 222, 128, 0.08)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.08)',
  danger: '#F87171',
  border: '#2A2A30',
};

function parsePayload(payload: string): PayloadData {
  try {
    return JSON.parse(payload);
  } catch {
    return { message: payload };
  }
}

function parseKeyData(keyJson: string): { key: string; iv: string; files: FileMetadata[] } | null {
  try {
    return JSON.parse(keyJson);
  } catch {
    return null;
  }
}

export function HeirDashboard({ vault, ownerAddress }: HeirDashboardProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isUnlocked = !vault.isActive || vault.unlockDate < Date.now();
  const payloadData = parsePayload(vault.payload);
  const keyData = payloadData.key ? parseKeyData(payloadData.key) : null;

  const handleDownloadAndDecrypt = async () => {
    if (!payloadData.arweave || !keyData) {
      setError('No encrypted files found');
      return;
    }
    setDownloading(true);
    setError(null);
    setProgress('Downloading from Arweave...');
    try {
      const encryptedData = await downloadFromArweave(payloadData.arweave);
      setProgress('Decrypting files...');
      const cryptoKey = await importKey(keyData.key);
      const iv = Uint8Array.from(atob(keyData.iv), c => c.charCodeAt(0));
      const decryptedBuffer = await decryptData(encryptedData, cryptoKey, iv);
      const decryptedData = new Uint8Array(decryptedBuffer);
      setProgress('Extracting files...');
      const view = new DataView(decryptedData.buffer);
      const metadataLength = view.getUint32(0, true);
      const metadataBytes = decryptedData.slice(4, 4 + metadataLength);
      const metadata: FileMetadata[] = JSON.parse(new TextDecoder().decode(metadataBytes));
      let offset = 4 + metadataLength;
      for (const fileMeta of metadata) {
        const fileData = decryptedData.slice(offset, offset + fileMeta.size);
        offset += fileMeta.size;
        const blob = new Blob([fileData], { type: fileMeta.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setProgress('Downloaded ' + metadata.length + ' file(s)');
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download');
      setProgress('');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Status Card */}
      <div style={{
        backgroundColor: isUnlocked ? c.successBg : c.bgCard,
        border: `1px solid ${isUnlocked ? 'rgba(74, 222, 128, 0.2)' : c.border}`,
        borderRadius: '16px', padding: '32px', textAlign: 'center'
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 16px',
          backgroundColor: isUnlocked ? 'rgba(74, 222, 128, 0.15)' : c.bgMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
        }}>
          {isUnlocked ? '🔓' : '🔒'}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: isUnlocked ? c.success : c.text, marginBottom: '8px' }}>
          {isUnlocked ? 'Vault Unlocked' : 'Vault Locked'}
        </h2>
        <p style={{ color: c.textSecondary, fontSize: '14px', margin: 0 }}>
          {isUnlocked ? 'You can now access the inheritance' : 'The vault owner is still active'}
        </p>
      </div>

      {/* Vault Owner */}
      <div style={{
        backgroundColor: c.bgCard, border: `1px solid ${c.border}`,
        borderRadius: '12px', padding: '24px'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '500', color: c.text, marginBottom: '12px' }}>Vault Owner</h3>
        <code style={{
          display: 'block', padding: '14px 16px', backgroundColor: c.bgMuted,
          borderRadius: '10px', color: c.textSecondary, fontSize: '13px',
          fontFamily: 'monospace', wordBreak: 'break-all'
        }}>
          {ownerAddress}
        </code>
      </div>

      {/* Unlocked Content */}
      {isUnlocked && (
        <>
          {/* Message */}
          {payloadData.message && (
            <div style={{
              backgroundColor: c.bgCard, border: `1px solid ${c.border}`,
              borderRadius: '12px', padding: '24px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '500', color: c.text, marginBottom: '12px' }}>Message from Owner</h3>
              <div style={{
                padding: '16px', backgroundColor: c.bgMuted, borderRadius: '10px',
                color: c.text, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
              }}>
                {payloadData.message}
              </div>
            </div>
          )}

          {/* Files */}
          {payloadData.arweave && keyData && (
            <div style={{
              backgroundColor: c.bgCard, border: `1px solid ${c.border}`,
              borderRadius: '12px', padding: '24px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '500', color: c.text, marginBottom: '16px' }}>Encrypted Files</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {keyData.files.map((file, index) => (
                  <div key={index} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', backgroundColor: c.bgMuted,
                    borderRadius: '10px', border: `1px solid ${c.border}`
                  }}>
                    <span style={{ color: c.text, fontSize: '13px' }}>{file.name}</span>
                    <span style={{ color: c.textMuted, fontSize: '12px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
              {error && <p style={{ color: c.danger, fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
              {progress && !error && <p style={{ color: c.success, fontSize: '13px', marginBottom: '16px' }}>{progress}</p>}
              <button onClick={handleDownloadAndDecrypt} disabled={downloading} style={{
                width: '100%', padding: '16px', backgroundColor: c.accent, color: c.bg,
                border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600',
                cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.6 : 1
              }}>
                {downloading ? 'Processing...' : 'Download & Decrypt Files'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Locked Warning */}
      {!isUnlocked && (
        <div style={{
          backgroundColor: c.warningBg,
          border: '1px solid rgba(251, 191, 36, 0.2)',
          borderRadius: '12px', padding: '20px', textAlign: 'center'
        }}>
          <p style={{ color: c.warning, fontSize: '14px', margin: 0 }}>
            Vault is still locked. The owner has not missed their check-in deadline yet.
          </p>
        </div>
      )}
    </div>
  );
}
