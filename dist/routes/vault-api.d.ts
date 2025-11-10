/**
 * Vault API Routes
 * Endpoints for merchant deposits, withdrawals, and staking
 */
import type { VaultManager } from '../lib/vault-manager.js';
import type { AffiliateDatabase } from '../lib/affiliate-database.js';
declare const router: import("express-serve-static-core").Router;
export interface VaultAPIConfig {
    vaultManager: VaultManager;
    affiliateDb: AffiliateDatabase;
}
/**
 * Initialize vault API routes
 */
export declare function initializeVaultAPI(cfg: VaultAPIConfig): void;
export default router;
//# sourceMappingURL=vault-api.d.ts.map