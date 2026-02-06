/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          LEGACY VAULT EXPORTS                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Точка входа для экспорта всех публичных функций и типов контракта
 */

// Экспорт основных функций контракта
export {
  // Инициализация
  constructor,
  
  // Оракул
  updateRate,
  getRate,
  
  // Создание и управление хранилищем
  createVault,
  deposit,
  ping,
  deactivateVault,
  upgradeTier,
  
  // Обновление данных
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
