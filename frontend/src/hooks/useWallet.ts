import { useState, useCallback, useEffect } from 'react';
import { getWallets } from '@massalabs/wallet-provider';
import { Web3Provider, Account } from '@massalabs/massa-web3';

interface WalletState {
  address: string | null;
  provider: any;
  isConnecting: boolean;
  error: string | null;
  walletName: string | null;
}

interface PendingAccounts {
  walletName: string;
  accounts: any[];
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    provider: null,
    isConnecting: false,
    error: null,
    walletName: null,
  });
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccounts | null>(null);

  useEffect(() => {
    const checkWallets = async () => {
      try {
        const wallets = await getWallets();
        const names: string[] = wallets.map(w => String(w.name()));
        names.push('Private Key');
        setAvailableWallets(names);
        console.log('Found wallets:', names);
      } catch (e) {
        console.error('Wallet check error:', e);
        setAvailableWallets(['Private Key']);
      }
    };
    checkWallets();
  }, []);

  const connectWallet = useCallback(async (name: string) => {
    const wallets = await getWallets();
    const wallet = wallets.find(w => String(w.name()) === name);
    if (!wallet) throw new Error(name + ' not found');
    console.log('Calling wallet.connect...'); if (wallet.connect) {
      const ok = await wallet.connect(); console.log('wallet.connect returned:', ok);
      if (!ok) throw new Error('Rejected');
    }
    let accounts; try { console.log('Getting accounts...'); accounts = await wallet.accounts(); console.log('Got accounts:', accounts.length); } catch(e) { console.error('Get accounts error:', e); throw e; }
    if (!accounts.length) throw new Error('No accounts');
    
    if (accounts.length > 1) {
      setPendingAccounts({ walletName: name, accounts });
      return null;
    }
    
    const acc = accounts[0];
    const addr = acc.address.toString();
    return { address: addr, provider: acc, walletName: name };
  }, []);

  const selectAccount = useCallback((index: number) => {
    if (!pendingAccounts) return;
    const acc = pendingAccounts.accounts[index];
    const addr = acc.address.toString();
    setState({
      address: addr,
      provider: acc,
      isConnecting: false,
      error: null,
      walletName: pendingAccounts.walletName,
    });
    setPendingAccounts(null);
  }, [pendingAccounts]);

  const cancelAccountSelection = useCallback(() => {
    setPendingAccounts(null);
    setState(s => ({ ...s, isConnecting: false }));
  }, []);

  const connectPK = useCallback(async (pk: string) => {
    const acc = await Account.fromPrivateKey(pk);
    const prov = Web3Provider.buildnet(acc);
    localStorage.setItem('massa_pk', pk);
    return { address: acc.address.toString(), provider: prov, walletName: 'Private Key' };
  }, []);

  const connect = useCallback(async (type?: string, pk?: string) => { 
    setState(s => ({ ...s, isConnecting: true, error: null }));
    try {
      let r;
      if (type === 'privatekey' && pk) r = await connectPK(pk);
      else if (type) r = await connectWallet(type);
      else throw new Error('No wallet');
      
      if (r) {
        setState({ ...r, isConnecting: false, error: null });
      }
      return true;
    } catch (e: any) {
      setState(s => ({ ...s, isConnecting: false, error: e.message }));
      return false;
    }
  }, [connectWallet, connectPK]);

  const disconnect = useCallback(() => {
    localStorage.removeItem('massa_pk');
    setState({ address: null, provider: null, isConnecting: false, error: null, walletName: null });
  }, []);

  useEffect(() => {
    const pk = localStorage.getItem('massa_pk');
    if (pk) connect('privatekey', pk);
  }, []);

  return {
    ...state,
    availableWallets,
    connect,
    disconnect,
    isConnected: !!state.address,
    pendingAccounts,
    selectAccount,
    cancelAccountSelection,
  };
}
