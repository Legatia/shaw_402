/**
 * Agent Manager
 * Spawns and manages Payment Processor Agents for all merchants
 */
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PaymentProcessorAgent } from './payment-processor.js';
export class AgentManager {
    config;
    agents = new Map();
    platformUSDCAccount = null;
    constructor(config) {
        this.config = config;
    }
    /**
     * Initialize and start all agents
     */
    async startAll() {
        console.log('');
        console.log('='.repeat(80));
        console.log('🚀 AGENT MANAGER STARTING');
        console.log('='.repeat(80));
        console.log('');
        // Get platform USDC account
        const platformWalletPubkey = new PublicKey(this.config.platformWallet);
        const usdcMint = new PublicKey(this.config.usdcMint);
        const platformUSDCAta = await getAssociatedTokenAddress(usdcMint, platformWalletPubkey);
        this.platformUSDCAccount = platformUSDCAta.toString();
        console.log(`Platform Wallet: ${this.config.platformWallet}`);
        console.log(`Platform USDC Account: ${this.platformUSDCAccount}`);
        console.log(`Facilitator URL: ${this.config.facilitatorUrl}`);
        console.log('');
        // Load all active merchants
        const merchants = await this.loadActiveMerchants();
        if (merchants.length === 0) {
            console.log('⚠️  No active merchants found. Waiting for registrations...');
            console.log('');
            return;
        }
        console.log(`Found ${merchants.length} active merchant(s)`);
        console.log('');
        // Create and start agent for each merchant
        for (const merchantData of merchants) {
            try {
                await this.startAgentForMerchant(merchantData);
            }
            catch (error) {
                console.error(`❌ Failed to start agent for ${merchantData.merchantId}:`, error);
            }
        }
        console.log('');
        console.log('='.repeat(80));
        console.log(`✅ ${this.agents.size} AGENT(S) RUNNING`);
        console.log('='.repeat(80));
        console.log('');
    }
    /**
     * Start agent for a specific merchant
     */
    async startAgentForMerchant(merchantData) {
        // Check if agent already exists
        if (this.agents.has(merchantData.merchantId)) {
            console.log(`  ⚠️  Agent already running for ${merchantData.merchantId}`);
            return;
        }
        // Create agent config
        const agentConfig = {
            merchantData,
            solanaUtils: this.config.solanaUtils,
            affiliateDb: this.config.affiliateDb,
            facilitatorUrl: this.config.facilitatorUrl,
            platformWallet: this.config.platformWallet,
            platformUSDCAccount: this.platformUSDCAccount,
        };
        // Create agent
        const agent = new PaymentProcessorAgent(agentConfig);
        // Start agent
        await agent.start();
        // Store agent
        this.agents.set(merchantData.merchantId, agent);
    }
    /**
     * Load all active merchants from database
     */
    async loadActiveMerchants() {
        // This is a simple implementation
        // In production, add a method to AffiliateDatabase to get all merchants
        // For now, we'll need to query the database directly
        return new Promise((resolve, reject) => {
            const db = this.config.affiliateDb.db;
            if (!db) {
                reject(new Error('Database not initialized'));
                return;
            }
            db.all(`SELECT * FROM merchants WHERE status = 'active'`, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                const merchants = rows.map((row) => ({
                    merchantId: row.merchant_id,
                    businessName: row.business_name,
                    merchantWallet: row.merchant_wallet,
                    agentWallet: row.agent_wallet,
                    agentPrivateKey: row.agent_private_key,
                    platformFeeRate: row.platform_fee_rate,
                    affiliateFeeRate: row.affiliate_fee_rate,
                    registrationTxSignature: row.registration_tx_signature,
                    status: row.status,
                    settlementToken: row.settlement_token || 'USDC',
                    usdcMint: row.usdc_mint,
                    agentUSDCAccount: row.agent_usdc_account,
                    merchantUSDCAccount: row.merchant_usdc_account,
                }));
                resolve(merchants);
            });
        });
    }
    /**
     * Stop all agents
     */
    async stopAll() {
        console.log('');
        console.log('🛑 Stopping all agents...');
        for (const agent of this.agents.values()) {
            await agent.stop();
        }
        this.agents.clear();
        console.log('✅ All agents stopped');
        console.log('');
    }
    /**
     * Get status of all agents
     */
    getStatus() {
        const statuses = [];
        for (const agent of this.agents.values()) {
            statuses.push(agent.getStatus());
        }
        return statuses;
    }
    /**
     * Refresh agents (reload from database and restart)
     */
    async refresh() {
        console.log('🔄 Refreshing agents...');
        await this.stopAll();
        await this.startAll();
        console.log('✅ Agents refreshed');
    }
    /**
     * Add agent for newly registered merchant
     */
    async addMerchant(merchantIdParam) {
        console.log(`➕ Adding agent for merchant: ${merchantIdParam}`);
        // Load merchant from database
        const merchantData = await this.config.affiliateDb.getMerchant(merchantIdParam);
        if (!merchantData) {
            throw new Error(`Merchant not found: ${merchantIdParam}`);
        }
        if (merchantData.status !== 'active') {
            throw new Error(`Merchant not active: ${merchantIdParam}`);
        }
        // Start agent
        await this.startAgentForMerchant(merchantData);
        console.log(`✅ Agent added for ${merchantIdParam}`);
    }
    /**
     * Remove agent for merchant
     */
    async removeMerchant(merchantIdParam) {
        console.log(`➖ Removing agent for merchant: ${merchantIdParam}`);
        const agent = this.agents.get(merchantIdParam);
        if (!agent) {
            console.log(`  ⚠️  No agent found for ${merchantIdParam}`);
            return;
        }
        await agent.stop();
        this.agents.delete(merchantIdParam);
        console.log(`✅ Agent removed for ${merchantIdParam}`);
    }
}
//# sourceMappingURL=agent-manager.js.map