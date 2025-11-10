/**
 * Agent Manager
 * Spawns and manages Payment Processor Agents for all merchants
 */
import { AffiliateDatabase } from '../lib/affiliate-database.js';
import { SolanaUtils } from '../lib/solana-utils.js';
export interface AgentManagerConfig {
    affiliateDb: AffiliateDatabase;
    solanaUtils: SolanaUtils;
    facilitatorUrl: string;
    platformWallet: string;
    usdcMint: string;
}
export declare class AgentManager {
    private config;
    private agents;
    private platformUSDCAccount;
    constructor(config: AgentManagerConfig);
    /**
     * Initialize and start all agents
     */
    startAll(): Promise<void>;
    /**
     * Start agent for a specific merchant
     */
    private startAgentForMerchant;
    /**
     * Load all active merchants from database
     */
    private loadActiveMerchants;
    /**
     * Stop all agents
     */
    stopAll(): Promise<void>;
    /**
     * Get status of all agents
     */
    getStatus(): any[];
    /**
     * Refresh agents (reload from database and restart)
     */
    refresh(): Promise<void>;
    /**
     * Add agent for newly registered merchant
     */
    addMerchant(merchantIdParam: string): Promise<void>;
    /**
     * Remove agent for merchant
     */
    removeMerchant(merchantIdParam: string): Promise<void>;
}
//# sourceMappingURL=agent-manager.d.ts.map