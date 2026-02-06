/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                           LEGACY VAULT TYPES                              ║
 * ║                                                                           ║
 * ║  Типы данных, интерфейсы и вспомогательные структуры                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Args } from '@massalabs/massa-as-sdk';
import { Serializable } from '@massalabs/as-types';

// ============================================================================
// ТИПЫ СОБЫТИЙ
// ============================================================================

/**
 * Типы событий, генерируемых контрактом
 * Используются фронтендом для отслеживания изменений
 */
export namespace EventType {
  export const CONTRACT_INITIALIZED: string = 'CONTRACT_INITIALIZED';
  export const RATE_UPDATED: string = 'RATE_UPDATED';
  export const VAULT_CREATED: string = 'VAULT_CREATED';
  export const DEPOSIT: string = 'DEPOSIT';
  export const PING: string = 'PING';
  export const VAULT_UNLOCKED: string = 'VAULT_UNLOCKED';
  export const VAULT_PAYLOAD: string = 'VAULT_PAYLOAD';
  export const INHERITANCE_TRANSFERRED: string = 'INHERITANCE_TRANSFERRED';
  export const DISTRIBUTION_COMPLETE: string = 'DISTRIBUTION_COMPLETE';
  export const HEIRS_UPDATED: string = 'HEIRS_UPDATED';
  export const INTERVAL_UPDATED: string = 'INTERVAL_UPDATED';
  export const PAYLOAD_UPDATED: string = 'PAYLOAD_UPDATED';
  export const VAULT_DEACTIVATED: string = 'VAULT_DEACTIVATED';
  export const TIER_UPGRADED: string = 'TIER_UPGRADED';
  export const BALANCE_RETURNED: string = 'BALANCE_RETURNED';
  export const FEE_COLLECTED: string = 'FEE_COLLECTED';
  export const FEES_WITHDRAWN: string = 'FEES_WITHDRAWN';
  export const SCHEDULE_CHECK: string = 'SCHEDULE_CHECK';
  export const ORACLE_UPDATED: string = 'ORACLE_UPDATED';
  export const ADMIN_TRANSFERRED: string = 'ADMIN_TRANSFERRED';
}

// ============================================================================
// ОШИБКИ
// ============================================================================

/**
 * Коды ошибок контракта
 */
export namespace ErrorCode {
  export const VAULT_NOT_FOUND: string = 'E001: Vault does not exist';
  export const VAULT_EXISTS: string = 'E002: Vault already exists';
  export const NOT_OWNER: string = 'E003: Only owner can perform this action';
  export const VAULT_INACTIVE: string = 'E004: Vault is not active';
  export const VAULT_DISTRIBUTED: string = 'E005: Vault already distributed';
  export const INVALID_TIER: string = 'E006: Invalid tier value';
  export const MAX_HEIRS_EXCEEDED: string = 'E007: Maximum heirs exceeded';
  export const INSUFFICIENT_PAYMENT: string = 'E008: Insufficient payment';
  export const INTERVAL_TOO_SHORT: string = 'E009: Heartbeat interval too short';
  export const DATA_LIMIT_EXCEEDED: string = 'E010: Data limit exceeded';
  export const NOT_UNLOCKED: string = 'E011: Vault not yet unlocked';
  export const ONLY_ORACLE: string = 'E012: Only oracle can update rate';
  export const ONLY_ADMIN: string = 'E013: Only admin can perform this action';
  export const NO_HEIRS: string = 'E014: At least one heir required';
  export const DUPLICATE_HEIR: string = 'E015: Duplicate heir address';
  export const SELF_HEIR: string = 'E016: Cannot add yourself as heir';
  export const ARWEAVE_REQUIRED: string = 'E017: Arweave TX ID required';
  export const KEY_REQUIRED: string = 'E018: Encrypted key required';
  export const INVALID_RATE: string = 'E019: Invalid rate value';
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ СТРУКТУРЫ
// ============================================================================

/**
 * Информация о тарифном плане
 */
@serializable
export class TierInfo implements Serializable {
  tier: u8 = 0;
  name: string = '';
  priceUsdCents: u64 = 0;
  dataLimitBytes: u64 = 0;
  maxHeirs: u8 = 0;
  supportsArweave: bool = false;
  isVip: bool = false;

  constructor() {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add<u8>(this.tier)
      .add(this.name)
      .add<u64>(this.priceUsdCents)
      .add<u64>(this.dataLimitBytes)
      .add<u8>(this.maxHeirs)
      .add<bool>(this.supportsArweave)
      .add<bool>(this.isVip)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    
    this.tier = args.nextU8().unwrap();
    this.name = args.nextString().unwrap();
    this.priceUsdCents = args.nextU64().unwrap();
    this.dataLimitBytes = args.nextU64().unwrap();
    this.maxHeirs = args.nextU8().unwrap();
    this.supportsArweave = args.nextBool().unwrap();
    this.isVip = args.nextBool().unwrap();
    
    return new Result<i32>(args.offset);
  }
}

/**
 * Статистика хранилища
 */
@serializable
export class VaultStats implements Serializable {
  owner: string = '';
  tier: u8 = 0;
  heirsCount: u32 = 0;
  balance: u64 = 0;
  createdAt: u64 = 0;
  lastPing: u64 = 0;
  unlockDate: u64 = 0;
  isActive: bool = false;
  isDistributed: bool = false;
  hasPayload: bool = false;
  hasArweave: bool = false;

  constructor() {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.owner)
      .add<u8>(this.tier)
      .add<u32>(this.heirsCount)
      .add<u64>(this.balance)
      .add<u64>(this.createdAt)
      .add<u64>(this.lastPing)
      .add<u64>(this.unlockDate)
      .add<bool>(this.isActive)
      .add<bool>(this.isDistributed)
      .add<bool>(this.hasPayload)
      .add<bool>(this.hasArweave)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    
    this.owner = args.nextString().unwrap();
    this.tier = args.nextU8().unwrap();
    this.heirsCount = args.nextU32().unwrap();
    this.balance = args.nextU64().unwrap();
    this.createdAt = args.nextU64().unwrap();
    this.lastPing = args.nextU64().unwrap();
    this.unlockDate = args.nextU64().unwrap();
    this.isActive = args.nextBool().unwrap();
    this.isDistributed = args.nextBool().unwrap();
    this.hasPayload = args.nextBool().unwrap();
    this.hasArweave = args.nextBool().unwrap();
    
    return new Result<i32>(args.offset);
  }
}

/**
 * Параметры создания хранилища
 */
@serializable
export class CreateVaultParams implements Serializable {
  tier: u8 = 0;
  heirs: string[] = [];
  heartbeatInterval: u64 = 0;
  payloadText: string = '';
  arweaveTxId: string = '';
  encryptedSymmetricKey: string = '';

  constructor() {}

  serialize(): StaticArray<u8> {
    const args = new Args();
    
    args.add<u8>(this.tier);
    args.add<u32>(this.heirs.length as u32);
    for (let i = 0; i < this.heirs.length; i++) {
      args.add(this.heirs[i]);
    }
    args.add<u64>(this.heartbeatInterval);
    args.add(this.payloadText);
    args.add(this.arweaveTxId);
    args.add(this.encryptedSymmetricKey);
    
    return args.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    
    this.tier = args.nextU8().unwrap();
    
    const heirsLength = args.nextU32().unwrap();
    this.heirs = [];
    for (let i: u32 = 0; i < heirsLength; i++) {
      this.heirs.push(args.nextString().unwrap());
    }
    
    this.heartbeatInterval = args.nextU64().unwrap();
    this.payloadText = args.nextString().unwrap();
    this.arweaveTxId = args.nextString().unwrap();
    this.encryptedSymmetricKey = args.nextString().unwrap();
    
    return new Result<i32>(args.offset);
  }
}

/**
 * Результат вызова с ошибкой
 */
class Result<T> {
  value: T;
  error: bool;
  
  constructor(value: T, error: bool = false) {
    this.value = value;
    this.error = error;
  }
}
