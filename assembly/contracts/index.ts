/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          LEGACY VAULT EXPORTS                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Entry point for exporting all public functions and contract types.
 * Every name here MUST match an `export function` in main.ts.
 */

// Export main contract functions
export {
  // Initialization
  constructor,

  // Oracle
  updateRate,
  getRate,

  // Vault creation and management (MAS)
  createVault,
  deposit,
  ping,
  deactivateVault,
  renewSubscription,

  // Vault creation and management (USDC)
  createVaultWithUsdc,
  renewSubscriptionWithUsdc,
  claimInheritanceWithUsdc,

  // Data updates
  updateHeirs,
  updateInterval,
  updatePayload,

  // Inheritance distribution
  triggerDistribution,
  claimInheritance,
  manualTrigger,

  // Read data — vault
  getVault,
  hasVault,
  getTimeUntilUnlock,
  getVaultStatus,
  getDeferredCallId,

  // Read data — pricing & fees
  getSubscriptionPrice,
  getMinSubscriptionPrice,
  getSubscriptionPriceUsdc,
  getAumFeeRate,
  getAccruedFee,
  getSubscriptionExpiry,

  // Read data — gas helpers
  getMinGasDeposit,
  getNumAscCalls,
  getGasExcess,

  // Read data — heir queries
  getVaultsForHeir,
  getDistributedVaultsForHeir,
  getDistributedInfo,

  // Read data — protocol stats
  getTotalRevenue,
  getTotalAumFees,

  // Administration
  adminWithdraw,
  adminWithdrawGasExcess,
  updateOracle,
  proposeAdmin,
  acceptAdmin,
} from './main';

// Export types
export {
  EventType,
  ErrorCode,
  TierInfo,
  VaultStats,
  CreateVaultParams,
} from './types';
