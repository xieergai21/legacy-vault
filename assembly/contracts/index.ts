/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          LEGACY VAULT EXPORTS                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Entry point for exporting all public functions and contract types
 */

// Экспорт основных функций контракта
export {
  // Инициализация
  constructor,
  
  // Оракул
  updateRate,
  getRate,
  
  // Vault creation and management
  createVault,
  deposit,
  ping,
  deactivateVault,
  upgradeTier,
  
  // Data updates
  updateHeirs,
  updateHeartbeatInterval,
  updatePayload,
  
  // Распределение наследства
  triggerDistribution,
  
  // Чтение данных
  getVault,
  getTierPrice,
  hasVault,
  getTimeUntilUnlock,
  
  // Администрирование
  withdrawFees,
  updateOracle,
  transferAdmin,
} from './main';

// Экспорт типов
export {
  EventType,
  ErrorCode,
  TierInfo,
  VaultStats,
  CreateVaultParams,
} from './types';
