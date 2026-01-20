/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          LEGACY VAULT EXPORTS                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Entry point for exporting all public functions and types
 */

// Export main contract functions
export {
  // Initialization
  constructor,
  
  // Oracle
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
  
  // Inheritance distribution
  triggerDistribution,
  
  // Read data
  getVault,
  getTierPrice,
  hasVault,
  getTimeUntilUnlock,
  
  // Administration
  withdrawFees,
  updateOracle,
  transferAdmin,
} from './main';

// Export types
export {
  EventType,
  ErrorCode,
  TierInfo,
  VaultStats,
  CreateVaultParams,
} from './types';
