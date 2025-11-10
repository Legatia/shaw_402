/**
 * Agent API Routes
 * Endpoints for payment processor agents to get split instructions
 * and report completion status
 */
import type { AffiliateDatabase } from '../lib/affiliate-database.js';
declare const router: import("express-serve-static-core").Router;
interface AgentAPIConfig {
    affiliateDb: AffiliateDatabase;
    platformWallet: string;
    usdcMint: string;
}
/**
 * Initialize agent API routes
 */
export declare function initializeAgentAPI(cfg: AgentAPIConfig): void;
/**
 * Helper: Add method to AffiliateDatabase to find merchant by agent wallet
 * This should be added to affiliate-database.ts
 */
export default router;
//# sourceMappingURL=agent-api.d.ts.map