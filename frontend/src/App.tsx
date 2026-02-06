import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CreateVault } from './components/CreateVault';
import { VaultDashboard } from './components/VaultDashboard';
import { HeirDashboard } from './components/HeirDashboard';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import { WelcomeScreen } from './components/WelcomeScreen';
import { downloadFromArweave, importKey, decryptData } from './utils/arweave';
import type { VaultData } from './utils/contract';
import './App.css';

interface DistributedInfo {
  total: number;
  perHeir: number;
  heirsCount: number;
  timestamp: number;
}

interface ArchivedVault {
  ownerAddress: string;
  info: DistributedInfo;
  payload?: string;
  arweaveTxId?: string;
  encryptedKey?: string;
  heirs?: string[];
}

interface HeirVaultWithStatus {
  address: string;
  vault: VaultData;
  isUnlocked: boolean;
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

export default function App() {
  const wallet = useWallet();
  const contract = useContract(wallet.provider);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [timeUntilUnlock, setTimeUntilUnlock] = useState(0);
  const [checking, setChecking] = useState(false);
  const [viewMode, setViewMode] = useState<'owner' | 'heir'>('owner');
  const [heirOwnerAddress, setHeirOwnerAddress] = useState('');
  const [heirVault, setHeirVault] = useState<VaultData | null>(null);
  const [heirError, setHeirError] = useState<string | null>(null);
  const [checkingHeir, setCheckingHeir] = useState(false);
  const [foundVaults, setFoundVaults] = useState<HeirVaultWithStatus[]>([]);
  const [autoSearching, setAutoSearching] = useState(false);
  
  const [, setDistributedInfo] = useState<DistributedInfo | null>(null);
  const [ownerArchivedVault, setOwnerArchivedVault] = useState<ArchivedVault | null>(null);
  const [archivedVaults, setArchivedVaults] = useState<ArchivedVault[]>([]);
  const [manualSearchAddress, setManualSearchAddress] = useState('');
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showOwnerArchive, setShowOwnerArchive] = useState(false);

  useEffect(() => {
    if (wallet.address) {
      checkVault();
    } else {
      setVault(null);
      setDistributedInfo(null);
      setOwnerArchivedVault(null);
    }
  }, [wallet.address]);

  useEffect(() => {
    if (wallet.address && viewMode === 'heir') {
      searchVaultsForHeir();
      loadArchivedVaults();
    }
  }, [wallet.address, viewMode]);

  const searchVaultsForHeir = async () => {
    if (!wallet.address) return;
    setAutoSearching(true);
    setFoundVaults([]);
    setHeirVault(null);
    try {
      const vaultAddresses = await contract.getVaultsForHeir(wallet.address);
      const vaultsWithStatus: HeirVaultWithStatus[] = [];
      for (const addr of vaultAddresses) {
        try {
          const vaultData = await contract.getVault(addr);
          if (vaultData) {
            const isUnlocked = !vaultData.isActive || vaultData.unlockDate < Date.now();
            vaultsWithStatus.push({ address: addr, vault: vaultData, isUnlocked });
          }
        } catch (err) {
          console.error('Failed to load vault:', addr, err);
        }
      }
      setFoundVaults(vaultsWithStatus);
      if (vaultsWithStatus.length === 1) {
        setHeirOwnerAddress(vaultsWithStatus[0].address);
        setHeirVault(vaultsWithStatus[0].vault);
      }
    } catch (err) {
      console.error('Auto-search failed:', err);
    }
    setAutoSearching(false);
  };

  const loadArchivedVaults = async () => {
    if (!wallet.address) return;
    setLoadingArchived(true);
    try {
      const distributedOwners = await contract.getDistributedVaultsForHeir(wallet.address);
      if (distributedOwners.length === 0) {
        setArchivedVaults([]);
        setLoadingArchived(false);
        return;
      }
      const archived: ArchivedVault[] = [];
      for (const ownerAddr of distributedOwners) {
        try {
          const [vaultData, info] = await Promise.all([
            contract.getVault(ownerAddr),
            contract.getDistributedInfo(ownerAddr)
          ]);
          if (info) {
            archived.push({
              ownerAddress: ownerAddr,
              info,
              payload: vaultData?.payload,
              arweaveTxId: vaultData?.arweaveTxId,
              encryptedKey: vaultData?.encryptedKey,
              heirs: vaultData?.heirs
            });
          }
        } catch (err) {
          console.error('Failed to load archived vault:', ownerAddr, err);
        }
      }
      setArchivedVaults(archived);
    } catch (err) {
      console.error('Failed to load archived vaults:', err);
      setArchivedVaults([]);
    }
    setLoadingArchived(false);
  };

  const checkVault = async () => {
    if (!wallet.address) return;
    setChecking(true);
    try {
      const vaultData = await contract.getVault(wallet.address);
      setVault(vaultData);
      if (vaultData) {
        const time = await contract.getTimeUntilUnlock(wallet.address);
        setTimeUntilUnlock(time);
        if (!vaultData.isActive) {
          const distInfo = await contract.getDistributedInfo(wallet.address);
          setDistributedInfo(distInfo);
          if (distInfo) {
            setOwnerArchivedVault({
              ownerAddress: wallet.address,
              info: distInfo,
              payload: vaultData.payload,
              arweaveTxId: vaultData.arweaveTxId,
              encryptedKey: vaultData.encryptedKey,
              heirs: vaultData.heirs
            });
          }
        } else {
          setDistributedInfo(null);
          setOwnerArchivedVault(null);
        }
      }
    } catch {
      setVault(null);
      try {
        const distInfo = await contract.getDistributedInfo(wallet.address!);
        setDistributedInfo(distInfo);
      } catch {
        setDistributedInfo(null);
      }
    }
    setChecking(false);
  };

  const handleCreateVault = async (tier: number, heirs: string[], intervalDays: number, payload: string, amount: number, tierPaymentMas: number, arweaveTxId?: string, encryptedKey?: string) => {
    await contract.createVault(tier, heirs, intervalDays, payload, amount, tierPaymentMas, arweaveTxId || "", encryptedKey || "");
    await checkVault();
  };
  const handleUpdatePayload = async (payload: string, arweaveTxId: string, encryptedKey: string) => {
    const result = await contract.updatePayload(payload, arweaveTxId, encryptedKey);
    await checkVault();
    return result;
  };

  const handlePing = async () => {
    if (!vault) throw new Error("No vault");
    await contract.ping(vault.interval, vault.tier, vault.balance, vault.lastFeeCollection);
    await checkVault();
  };

  const handleDeposit = async (amount: number) => {
    await contract.deposit(amount);
    await checkVault();
  };

  const handleDeactivate = async () => {
    if (confirm('Are you sure?')) {
      await contract.deactivate();
      await checkVault();
    }
  };

  const checkHeirVault = async () => {
    if (!heirOwnerAddress || !wallet.address) return;
    setCheckingHeir(true);
    setHeirError(null);
    setHeirVault(null);
    try {
      const vaultData = await contract.getVault(heirOwnerAddress);
      if (!vaultData) {
        setHeirError('No vault found');
        return;
      }
      const isHeir = vaultData.heirs.some(h => h.toLowerCase() === wallet.address?.toLowerCase());
      if (!isHeir) {
        setHeirError('You are not listed as heir');
        return;
      }
      setHeirVault(vaultData);
    } catch {
      setHeirError('Failed to load vault');
    } finally {
      setCheckingHeir(false);
    }
  };

  const searchArchivedByAddress = async () => {
    if (!manualSearchAddress || !wallet.address) return;
    setCheckingHeir(true);
    setHeirError(null);
    try {
      const vaultData = await contract.getVault(manualSearchAddress);
      if (!vaultData) {
        setHeirError('No vault found for this address');
        setCheckingHeir(false);
        return;
      }
      const isHeir = vaultData.heirs.some(h => h.toLowerCase() === wallet.address?.toLowerCase());
      if (!isHeir) {
        setHeirError('You were not listed as heir for this vault');
        setCheckingHeir(false);
        return;
      }
      const info = await contract.getDistributedInfo(manualSearchAddress);
      if (!info || info.total === 0) {
        setHeirError('No distribution found for this address');
        setCheckingHeir(false);
        return;
      }
      const exists = archivedVaults.some(a => a.ownerAddress === manualSearchAddress);
      if (!exists) {
        const newArchive: ArchivedVault = {
          ownerAddress: manualSearchAddress,
          info,
          payload: vaultData.payload,
          arweaveTxId: vaultData.arweaveTxId,
          encryptedKey: vaultData.encryptedKey,
          heirs: vaultData.heirs
        };
        setArchivedVaults(prev => [...prev, newArchive]);
      }
      setManualSearchAddress('');
      setHeirError(null);
    } catch (err) {
      console.error('Search error:', err);
      setHeirError('Failed to check address');
    } finally {
      setCheckingHeir(false);
    }
  };

  const handleDecrypt = (arweaveTxId: string) => {
    window.open(`https://arweave.net/${arweaveTxId}`, '_blank');
  };

  const handleDownloadAndDecrypt = async (archive: ArchivedVault) => {
    const payloadData = parsePayload(archive.payload || '');
    const keyData = payloadData.key ? parseKeyData(payloadData.key) : null;
    if (!payloadData.arweave || !keyData) {
      setDownloadError('No encrypted files found');
      return;
    }
    setDownloading(archive.ownerAddress);
    setDownloadError(null);
    setDownloadProgress('Downloading from Arweave...');
    try {
      const encryptedData = await downloadFromArweave(payloadData.arweave);
      setDownloadProgress('Decrypting files...');
      const cryptoKey = await importKey(keyData.key);
      const iv = Uint8Array.from(atob(keyData.iv), c => c.charCodeAt(0));
      const decryptedBuffer = await decryptData(encryptedData, cryptoKey, iv);
      const decryptedData = new Uint8Array(decryptedBuffer);
      setDownloadProgress('Extracting files...');
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
      setDownloadProgress('Downloaded ' + metadata.length + ' file(s)');
    } catch (err) {
      console.error('Download error:', err);
      setDownloadError(err instanceof Error ? err.message : 'Failed to download');
      setDownloadProgress('');
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const lockedVaults = foundVaults.filter(v => !v.isUnlocked);
  const unlockedVaults = foundVaults.filter(v => v.isUnlocked);

  return (
    <div className="app-container">
      {!wallet.isConnected ? (
        <WelcomeScreen onConnect={(walletType) => wallet.connect(walletType)} pendingAccounts={wallet.pendingAccounts} selectAccount={wallet.selectAccount} cancelAccountSelection={wallet.cancelAccountSelection} />
      ) : (
        <>
          <Header viewMode={viewMode} setViewMode={setViewMode} address={wallet.address} isConnecting={wallet.isConnecting} walletName={wallet.walletName} availableWallets={wallet.availableWallets} onConnect={wallet.connect} onDisconnect={wallet.disconnect} error={wallet.error} pendingAccounts={wallet.pendingAccounts} selectAccount={wallet.selectAccount} cancelAccountSelection={wallet.cancelAccountSelection} />
          <main className="main-content">
            {contract.error && <div className="alert alert-error">{contract.error}</div>}
            {viewMode === 'owner' ? (
              checking ? (
                <div className="loading-screen"><div className="loading-spinner"></div><p>Loading...</p></div>
              ) : vault && vault.isActive ? (
                <VaultDashboard vault={vault} walletAddress={wallet.address || ""} timeUntilUnlock={timeUntilUnlock} onPing={handlePing} onDeposit={handleDeposit} onDeactivate={handleDeactivate} loading={contract.loading} />
              ) : (
                <>
                  {ownerArchivedVault && (
                    <div style={{ backgroundColor: "#1A1A1F", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "16px", marginBottom: "24px", maxWidth: "720px", margin: "0 auto 24px auto", overflow: "hidden" }}>
                      <div onClick={() => setShowOwnerArchive(!showOwnerArchive)} style={{ padding: "20px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(34, 197, 94, 0.08)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "rgba(34, 197, 94, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", fontSize: "18px" }}>✓</div>
                          <div>
                            <h3 style={{ color: "#22c55e", margin: 0, fontSize: "16px", fontWeight: "600" }}>Previous Vault Distributed</h3>
                            <p style={{ color: "#606068", fontSize: "12px", margin: "4px 0 0 0" }}>{formatDate(ownerArchivedVault.info.timestamp)}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <p style={{ color: "#22c55e", fontSize: "18px", fontWeight: "700", margin: 0 }}>{ownerArchivedVault.info.total.toFixed(2)} MAS</p>
                          <span style={{ color: "#606068", fontSize: "18px", transform: showOwnerArchive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                        </div>
                      </div>
                      {showOwnerArchive && (
                        <div style={{ padding: "0 24px 24px 24px", borderTop: "1px solid #2A2A30" }}>
                          <div style={{ display: "flex", gap: "32px", padding: "20px 0", borderBottom: "1px solid #2A2A30" }}>
                            <div><p style={{ color: "#606068", fontSize: "11px", margin: 0, textTransform: "uppercase" }}>Total Distributed</p><p style={{ color: "#F0F0F2", fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>{ownerArchivedVault.info.total.toFixed(2)} MAS</p></div>
                            <div><p style={{ color: "#606068", fontSize: "11px", margin: 0, textTransform: "uppercase" }}>Recipients</p><p style={{ color: "#F0F0F2", fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>{ownerArchivedVault.info.heirsCount} heir{ownerArchivedVault.info.heirsCount > 1 ? 's' : ''}</p></div>
                            <div><p style={{ color: "#606068", fontSize: "11px", margin: 0, textTransform: "uppercase" }}>Per Heir</p><p style={{ color: "#F0F0F2", fontSize: "16px", fontWeight: "600", margin: "4px 0 0 0" }}>{ownerArchivedVault.info.perHeir.toFixed(2)} MAS</p></div>
                          </div>
                          {ownerArchivedVault.heirs && ownerArchivedVault.heirs.length > 0 && (
                            <div style={{ padding: "16px 0", borderBottom: "1px solid #2A2A30" }}>
                              <p style={{ color: "#606068", fontSize: "11px", margin: "0 0 12px 0", textTransform: "uppercase" }}>Heirs Who Received</p>
                              {ownerArchivedVault.heirs.map((heir, idx) => (
                                <div key={idx} style={{ padding: "10px 12px", backgroundColor: "#252529", borderRadius: "8px", marginBottom: "8px" }}>
                                  <code style={{ color: "#A0A0A8", fontSize: "12px" }}>{heir}</code>
                                </div>
                              ))}
                            </div>
                          )}
                          {ownerArchivedVault.payload && (() => {
                            const payloadData = parsePayload(ownerArchivedVault.payload);
                            return payloadData.message ? (
                              <div style={{ padding: "16px 0" }}>
                                <p style={{ color: "#606068", fontSize: "11px", margin: "0 0 8px 0", textTransform: "uppercase" }}>Message Sent</p>
                                <div style={{ padding: "12px", backgroundColor: "#252529", borderRadius: "8px", color: "#F0F0F2", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{payloadData.message}</div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                  <CreateVault onSubmit={handleCreateVault} onUpdatePayload={handleUpdatePayload} loading={contract.loading} massaAddress={wallet.address || ''} />
                </>
              )
            ) : (
              <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {autoSearching ? (
                  <div style={{ backgroundColor: "#1A1A1F", border: "1px solid #2A2A30", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
                    <div className="loading-spinner"></div>
                    <p style={{ color: "#A0A0A8", marginTop: "16px", fontSize: "14px" }}>Searching for inheritances...</p>
                  </div>
                ) : (
                  <>
                    {unlockedVaults.length > 0 && (
                      <div style={{ backgroundColor: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "16px", padding: "24px" }}>
                        <h3 style={{ color: "#22c55e", fontSize: "15px", fontWeight: "500", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "16px" }}>🔓</span>Unlocked Vaults ({unlockedVaults.length})
                        </h3>
                        <p style={{ color: "#A0A0A8", fontSize: "13px", marginBottom: "16px" }}>These vaults are ready - you can access the inheritance!</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {unlockedVaults.map((v, i) => (
                            <button key={i} onClick={() => { setHeirOwnerAddress(v.address); setHeirVault(v.vault); }} style={{ padding: "14px 16px", backgroundColor: heirOwnerAddress === v.address ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.05)", border: heirOwnerAddress === v.address ? "2px solid #22c55e" : "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "10px", color: "#F0F0F2", textAlign: "left", cursor: "pointer", fontFamily: "monospace", fontSize: "13px" }}>{v.address}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {lockedVaults.length > 0 && (
                      <div style={{ backgroundColor: "#1A1A1F", border: "1px solid #2A2A30", borderRadius: "16px", padding: "24px" }}>
                        <h3 style={{ color: "#F0F0F2", fontSize: "15px", fontWeight: "500", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "16px" }}>🔒</span>Active Vaults ({lockedVaults.length})
                        </h3>
                        <p style={{ color: "#606068", fontSize: "13px", marginBottom: "16px" }}>Owner is still active. Waiting for check-in to expire.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {lockedVaults.map((v, i) => (
                            <button key={i} onClick={() => { setHeirOwnerAddress(v.address); setHeirVault(v.vault); }} style={{ padding: "14px 16px", backgroundColor: heirOwnerAddress === v.address ? "#252529" : "#1A1A1F", border: heirOwnerAddress === v.address ? "2px solid #E8E8EC" : "1px solid #2A2A30", borderRadius: "10px", color: "#F0F0F2", textAlign: "left", cursor: "pointer", fontFamily: "monospace", fontSize: "13px" }}>{v.address}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {foundVaults.length === 0 && (
                      <div style={{ backgroundColor: "#1A1A1F", border: "1px solid #2A2A30", borderRadius: "16px", padding: "24px" }}>
                        <h3 style={{ color: "#F0F0F2", fontSize: "15px", fontWeight: "500", marginBottom: "12px" }}>Find Your Inheritance</h3>
                        <p style={{ color: "#606068", fontSize: "13px", marginBottom: "16px" }}>No active vaults found. Search manually:</p>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <input value={heirOwnerAddress} onChange={e => setHeirOwnerAddress(e.target.value)} placeholder="Owner address (AU1...)" style={{ flex: 1, padding: "14px 16px", backgroundColor: "#252529", border: "1px solid #2A2A30", borderRadius: "10px", color: "#F0F0F2", fontFamily: "monospace", fontSize: "13px", outline: "none" }} />
                          <button onClick={checkHeirVault} disabled={checkingHeir || !heirOwnerAddress} style={{ padding: "14px 24px", backgroundColor: "#E8E8EC", border: "none", borderRadius: "10px", color: "#0F0F12", fontWeight: "600", fontSize: "14px", cursor: "pointer", opacity: checkingHeir || !heirOwnerAddress ? 0.5 : 1 }}>{checkingHeir ? "..." : "Check"}</button>
                        </div>
                        {heirError && !manualSearchAddress && <p style={{ color: "#F87171", fontSize: "13px", marginTop: "12px" }}>{heirError}</p>}
                      </div>
                    )}
                  </>
                )}
                {heirVault && <HeirDashboard vault={heirVault} ownerAddress={heirOwnerAddress} onDecrypt={handleDecrypt} />}
                <div style={{ backgroundColor: "#1A1A1F", border: "1px solid #2A2A30", borderRadius: "16px", padding: "24px" }}>
                  <h3 style={{ color: "#F0F0F2", fontSize: "15px", fontWeight: "500", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px" }}>📦</span>Received Inheritances{archivedVaults.length > 0 && <span style={{ color: "#606068", fontWeight: "400" }}>({archivedVaults.length})</span>}
                  </h3>
                  {loadingArchived ? (
                    <div style={{ textAlign: "center", padding: "16px" }}><div className="loading-spinner"></div><p style={{ color: "#606068", fontSize: "13px", marginTop: "12px" }}>Loading history...</p></div>
                  ) : archivedVaults.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                      {archivedVaults.map((archive, i) => {
                        const isExpanded = expandedArchive === archive.ownerAddress;
                        const payloadData = parsePayload(archive.payload || '');
                        const keyData = payloadData.key ? parseKeyData(payloadData.key) : null;
                        const hasFiles = payloadData.arweave && keyData;
                        return (
                          <div key={i} style={{ backgroundColor: "#252529", border: "1px solid #2A2A30", borderRadius: "12px", overflow: "hidden" }}>
                            <div onClick={() => setExpandedArchive(isExpanded ? null : archive.ownerAddress)} style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(34, 197, 94, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", fontSize: "14px" }}>✓</div>
                                <div>
                                  <p style={{ color: "#A0A0A8", fontFamily: "monospace", fontSize: "12px", margin: 0 }}>{archive.ownerAddress.slice(0, 12)}...{archive.ownerAddress.slice(-8)}</p>
                                  <p style={{ color: "#606068", fontSize: "11px", margin: "4px 0 0 0" }}>{formatDate(archive.info.timestamp)}</p>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <p style={{ color: "#22c55e", fontSize: "16px", fontWeight: "700", margin: 0 }}>+{archive.info.perHeir.toFixed(2)} MAS</p>
                                <span style={{ color: "#606068", fontSize: "18px", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #2A2A30" }}>
                                <div style={{ display: "flex", gap: "24px", padding: "16px 0", borderBottom: "1px solid #2A2A30" }}>
                                  <div><p style={{ color: "#606068", fontSize: "11px", margin: 0, textTransform: "uppercase" }}>Total Distributed</p><p style={{ color: "#A0A0A8", fontSize: "14px", margin: "4px 0 0 0" }}>{archive.info.total.toFixed(2)} MAS</p></div>
                                  <div><p style={{ color: "#606068", fontSize: "11px", margin: 0, textTransform: "uppercase" }}>Split Between</p><p style={{ color: "#A0A0A8", fontSize: "14px", margin: "4px 0 0 0" }}>{archive.info.heirsCount} heir{archive.info.heirsCount > 1 ? 's' : ''}</p></div>
                                </div>
                                {payloadData.message && (
                                  <div style={{ padding: "16px 0", borderBottom: hasFiles ? "1px solid #2A2A30" : "none" }}>
                                    <p style={{ color: "#606068", fontSize: "11px", margin: "0 0 8px 0", textTransform: "uppercase" }}>Message from Owner</p>
                                    <div style={{ padding: "12px", backgroundColor: "#1A1A1F", borderRadius: "8px", color: "#F0F0F2", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{payloadData.message}</div>
                                  </div>
                                )}
                                {hasFiles && keyData && (
                                  <div style={{ paddingTop: "16px" }}>
                                    <p style={{ color: "#606068", fontSize: "11px", margin: "0 0 12px 0", textTransform: "uppercase" }}>Encrypted Files</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                                      {keyData.files.map((file, idx) => (
                                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#1A1A1F", borderRadius: "8px" }}>
                                          <span style={{ color: "#F0F0F2", fontSize: "13px" }}>{file.name}</span>
                                          <span style={{ color: "#606068", fontSize: "12px" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                      ))}
                                    </div>
                                    {downloadError && downloading === archive.ownerAddress && <p style={{ color: "#F87171", fontSize: "12px", marginBottom: "12px" }}>{downloadError}</p>}
                                    {downloadProgress && downloading === archive.ownerAddress && <p style={{ color: "#22c55e", fontSize: "12px", marginBottom: "12px" }}>{downloadProgress}</p>}
                                    <button onClick={() => handleDownloadAndDecrypt(archive)} disabled={downloading === archive.ownerAddress} style={{ width: "100%", padding: "12px", backgroundColor: "#E8E8EC", color: "#0F0F12", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: downloading === archive.ownerAddress ? "not-allowed" : "pointer", opacity: downloading === archive.ownerAddress ? 0.6 : 1 }}>{downloading === archive.ownerAddress ? "Processing..." : "Download & Decrypt Files"}</button>
                                  </div>
                                )}
                                {!payloadData.message && !hasFiles && <p style={{ color: "#606068", fontSize: "13px", padding: "16px 0", margin: 0 }}>No message or files were included with this vault.</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: "#606068", fontSize: "13px", marginBottom: "16px" }}>No received inheritances yet.</p>
                  )}
                  <div style={{ paddingTop: "16px", borderTop: "1px solid #2A2A30" }}>
                    <p style={{ color: "#A0A0A8", fontSize: "12px", marginBottom: "12px" }}>Know an owner address? Search for your received inheritance:</p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <input value={manualSearchAddress} onChange={e => setManualSearchAddress(e.target.value)} placeholder="Owner address (AU1...)" style={{ flex: 1, padding: "12px 14px", backgroundColor: "#252529", border: "1px solid #2A2A30", borderRadius: "10px", color: "#F0F0F2", fontFamily: "monospace", fontSize: "12px", outline: "none" }} />
                      <button onClick={searchArchivedByAddress} disabled={checkingHeir || !manualSearchAddress} style={{ padding: "12px 20px", backgroundColor: "#E8E8EC", border: "none", borderRadius: "10px", color: "#0F0F12", fontWeight: "600", fontSize: "13px", cursor: "pointer", opacity: checkingHeir || !manualSearchAddress ? 0.5 : 1 }}>{checkingHeir ? "..." : "Search"}</button>
                    </div>
                    {heirError && manualSearchAddress && <p style={{ color: "#F87171", fontSize: "12px", marginTop: "10px" }}>{heirError}</p>}
                  </div>
                </div>
              </div>
            )}
          </main>
          <footer className="app-footer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px" }}>
            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}><a href="https://github.com/xieergai21/legacy-vault" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4a5568", textDecoration: "none", fontSize: "0.8rem" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub</a><a href="https://t.me/legacyvault" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4a5568", textDecoration: "none", fontSize: "0.8rem" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>Telegram</a><a href="https://medium.com/@legacy-vault" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4a5568", textDecoration: "none", fontSize: "0.8rem" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Medium</a></div>
            <p style={{ color: "#3a4a5a", fontSize: "0.75rem" }}>Legacy Vault — Powered by Massa</p>
          </footer>
        </>
      )}
    </div>
  );
}
