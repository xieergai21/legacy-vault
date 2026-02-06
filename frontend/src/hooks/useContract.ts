import { useState, useCallback } from 'react';
import { SmartContract, Args, Web3Provider } from '@massalabs/massa-web3';
import { CONTRACT_ADDRESS, parseVaultData, toNanoMassa, calculateGasEstimate, ORACLE_FEE, AUM_FEE_BPS, ONE_DAY_MS } from '../utils/contract';
import type { VaultData, GasEstimate } from '../utils/contract';

export function useContract(provider: any) {
  // Read-only provider for read operations
  const readProvider = Web3Provider.buildnet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback(() => {
    if (!provider) throw new Error('Not connected');
    return new SmartContract(provider, CONTRACT_ADDRESS);
  }, [provider]);

  const getVault = useCallback(async (address: string): Promise<VaultData | null> => {
    // Use readProvider for read operations
    try {
      setLoading(true);
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      const result = await contract.read('getVault', new Args().addString(address).serialize());
      const raw = new TextDecoder().decode(result.value);
      console.log('Raw vault data:', raw);
      return parseVaultData(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('No vault')) return null;
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  const hasVault = useCallback(async (address: string): Promise<boolean> => {
    if (!provider) return false;
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      const result = await contract.read('hasVault', new Args().addString(address).serialize());
      const value = new Args(result.value).nextU64();
      return value === 1n;
    } catch {
      return false;
    }
  }, [provider, getContract]);

  const getTimeUntilUnlock = useCallback(async (address: string): Promise<number> => {
    if (!provider) return 0;
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      const result = await contract.read('getTimeUntilUnlock', new Args().addString(address).serialize());
      return Number(new Args(result.value).nextU64());
    } catch {
      return 0;
    }
  }, [provider, getContract]);

  /**
   * createVault v2 - with explicit tierPayment
   * 
   * @param tier - tier level (0-3)
   * @param heirs - array of heir addresses
   * @param intervalDays - interval in days
   * @param payload - encrypted data
   * @param massaAmount - total MAS amount to send
   * @param tierPaymentMas - tier payment in MAS (calculated by frontend using CoinGecko rate)
   */
  const createVault = useCallback(async (
    tier: number,
    heirs: string[],
    intervalDays: number,
    payload: string,
    massaAmount: number,
    tierPaymentMas: number = 0, arweaveTxId: string = "", encryptedKey: string = ""
  ) => {
    if (!provider) throw new Error('Not connected');
    setLoading(true);
    setError(null);
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      
      // Convert tierPayment to nanoMAS
      const tierPaymentNano = toNanoMassa(tierPaymentMas);
      
      const args = new Args()
        .addU8(BigInt(tier))
        .addU32(BigInt(heirs.length));
      
      heirs.forEach(heir => args.addString(heir));
      
      args
        .addU64(BigInt(intervalDays * 86400000))  // interval in ms
        .addString(payload)
        .addString(arweaveTxId)  // arweaveTxId
        .addString(encryptedKey)  // encryptedKey
        .addU64(tierPaymentNano);  // tierPayment in nanoMAS
      
      console.log('Creating vault with tierPayment:', tierPaymentMas, 'MAS (', tierPaymentNano.toString(), 'nano)');
      console.log('Total amount:', massaAmount, 'MAS');
      
      const op = await contract.call('createVault', args.serialize(), {
        coins: toNanoMassa(massaAmount),
        maxGas: 500_000_000n,
      });
      
      console.log('Operation submitted:', op.id);
      await op.waitFinalExecution();
      console.log('Transaction finalized!');
      
      // Verify vault was created
      const address = provider.address.toString();
      const checkResult = await contract.read('hasVault', new Args().addString(address).serialize());
      const hasVault = new Args(checkResult.value).nextU64() === 1n;
      
      if (!hasVault) {
        throw new Error('Transaction completed but vault was not created. Possibly insufficient funds.');
      }
      
      return op.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  const ping = useCallback(async (intervalMs: number, tier: number, balance: bigint, lastFeeCollection: number, networkQuotePerCall?: number) => {
    const YEAR_MS = 365 * ONE_DAY_MS;
    const feeBps = AUM_FEE_BPS[tier];
    const timeSinceCollection = Date.now() - lastFeeCollection;
    const aumFee = feeBps > 0 ? (Number(balance) * feeBps / 10000) * (timeSinceCollection / YEAR_MS) : 0;
    
    // Use dynamic gas estimation with network quote
    const gasEstimate = calculateGasEstimate(intervalMs, networkQuotePerCall);
    const gasRequired = gasEstimate.recommended + ORACLE_FEE + aumFee / 1e9;
    
    console.log("Ping calculation:", { 
      intervalMs, tier, balance: balance.toString(), 
      lastFeeCollection, timeSinceCollection, feeBps, aumFee,
      gasMin: gasEstimate.minimum, gasRecommended: gasEstimate.recommended,
      numCalls: gasEstimate.numCalls, perCallCost: gasEstimate.perCallCost,
      totalRequired: gasRequired
    });
    if (!provider) throw new Error('Not connected');
    setLoading(true);
    setError(null);
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      console.log('Calling ping with gas:', gasRequired.toFixed(4), 'MAS');
      const op = await contract.call('ping', new Args().serialize(), {
        coins: toNanoMassa(gasRequired),
        maxGas: 500_000_000n,
      });
      
      console.log('Operation submitted:', op.id);
      await op.waitFinalExecution();
      console.log('Ping finalized!');
      
      return op.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  const deposit = useCallback(async (massaAmount: number) => {
    if (!provider) throw new Error('Not connected');
    setLoading(true);
    setError(null);
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      console.log('Calling deposit...');
      const op = await contract.call('deposit', new Args().serialize(), {
        coins: toNanoMassa(massaAmount),
        maxGas: 50_000_000n,
      });
      
      console.log('Operation submitted:', op.id);
      await op.waitFinalExecution();
      console.log('Deposit finalized!');
      
      return op.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  const deactivate = useCallback(async () => {
    if (!provider) throw new Error('Not connected');
    setLoading(true);
    setError(null);
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      console.log('Calling deactivateVault...');
      const op = await contract.call('deactivateVault', new Args().serialize(), {
        maxGas: 500_000_000n,
      });
      
      console.log('Operation submitted:', op.id);
      await op.waitFinalExecution();
      console.log('Deactivation finalized!');
      
      return op.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  const updatePayload = useCallback(async (
    newPayload: string,
    arweaveTxId: string,
    encryptedKey: string
  ) => {
    if (!provider) throw new Error('Not connected');
    setLoading(true);
    setError(null);
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      const args = new Args()
        .addString(newPayload)
        .addString(arweaveTxId)
        .addString(encryptedKey);
      
      console.log('Calling updatePayload...');
      const op = await contract.call('updatePayload', args.serialize(), {
        maxGas: 100_000_000n,
      });
      
      console.log('Operation submitted:', op.id);
      await op.waitFinalExecution();
      console.log('Payload updated!');
      
      return op.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [provider, getContract]);

  // Get active vaults where address is listed as heir
  const getVaultsForHeir = useCallback(async (heirAddress: string): Promise<string[]> => {
    try {
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      console.log('getVaultsForHeir called with:', heirAddress);
      const result = await contract.read('getVaultsForHeir', new Args().addString(heirAddress).serialize());
      console.log('getVaultsForHeir raw result:', result);
      const raw = new TextDecoder().decode(result.value);
      if (!raw) return [];
      return raw.split(',').filter(addr => addr.length > 0);
    } catch {
      return [];
    }
  }, [provider, getContract]);

  // Get distributed vaults where address received inheritance
  const getDistributedVaultsForHeir = useCallback(async (heirAddress: string): Promise<string[]> => {
    try {
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      console.log('getDistributedVaultsForHeir called with:', heirAddress);
      const result = await contract.read('getDistributedVaultsForHeir', new Args().addString(heirAddress).serialize());
      const raw = new TextDecoder().decode(result.value);
      console.log('getDistributedVaultsForHeir raw result:', raw);
      if (!raw) return [];
      return raw.split(',').filter(addr => addr.length > 0);
    } catch (err) {
      console.log('getDistributedVaultsForHeir error:', err);
      return [];
    }
  }, [provider, getContract]);

  // Get distribution info for a vault owner
  const getDistributedInfo = useCallback(async (ownerAddress: string): Promise<{total: number, perHeir: number, heirsCount: number, timestamp: number} | null> => {
    try {
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      const result = await contract.read('getDistributedInfo', new Args().addString(ownerAddress).serialize());
      const raw = new TextDecoder().decode(result.value);
      if (!raw) return null;
      const parts = raw.split('|');
      return { 
        total: Number(parts[0]) / 1_000_000_000, 
        perHeir: Number(parts[1]) / 1_000_000_000, 
        heirsCount: Number(parts[2]), 
        timestamp: Number(parts[3]) 
      };
    } catch {
      return null;
    }
  }, [provider, getContract]);

  // Get current rate from contract
  const getContractRate = useCallback(async (): Promise<number> => {
    if (!provider) return 5;
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      const result = await contract.read('getRate', new Args().serialize());
      return Number(new Args(result.value).nextU64());
    } catch {
      return 5; // Default 5 cents
    }
  }, [provider, getContract]);

  // Get minimum tier price
  const getMinTierPrice = useCallback(async (tier: number): Promise<number> => {
    if (!provider) return 0;
    try {
      const contract = new SmartContract(provider, CONTRACT_ADDRESS);
      const result = await contract.read('getMinTierPrice', new Args().addU8(BigInt(tier)).serialize());
      return Number(new Args(result.value).nextU64()) / 1_000_000_000;
    } catch {
      return 0;
    }
  }, [provider, getContract]);

  // Get gas excess available for admin withdrawal
  const getGasExcess = useCallback(async (): Promise<number> => {
    try {
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      const result = await contract.read('getGasExcess', new Args().serialize());
      return Number(new Args(result.value).nextU64()) / 1_000_000_000;
    } catch {
      return 0;
    }
  }, [provider]);

  // Get minimum gas deposit from contract for a given interval
  const getMinGasDeposit = useCallback(async (intervalMs: number): Promise<number> => {
    try {
      const contract = new SmartContract(readProvider, CONTRACT_ADDRESS);
      const result = await contract.read('getMinGasDeposit', new Args().addU64(BigInt(intervalMs)).serialize());
      return Number(new Args(result.value).nextU64()) / 1_000_000_000;
    } catch {
      return 0;
    }
  }, [provider]);

  // Get gas estimate for display (combines contract min + frontend recommendation)
  const getGasEstimate = useCallback((intervalMs: number, networkQuotePerCall?: number): GasEstimate => {
    return calculateGasEstimate(intervalMs, networkQuotePerCall);
  }, []);

  return {
    loading,
    error,
    getVault,
    hasVault,
    getTimeUntilUnlock,
    createVault,
    ping,
    deposit,
    deactivate,
    updatePayload,
    getVaultsForHeir,
    getDistributedVaultsForHeir,
    getDistributedInfo,
    getContractRate,
    getMinTierPrice,
    getGasExcess,
    getMinGasDeposit,
    getGasEstimate,
  };
}
