/**
 * Payment Processor Agent
 * Autonomous agent that monitors USDC payments and triggers automatic splits
 */
import { SolanaUtils } from '../lib/solana-utils.js';
import { AffiliateDatabase, MerchantData } from '../lib/affiliate-database.js';
export interface PaymentProcessorConfig {
    merchantData: MerchantData;
    solanaUtils: SolanaUtils;
    affiliateDb: AffiliateDatabase;
    facilitatorUrl: string;
    platformWallet: string;
    platformUSDCAccount: string;
}
export interface PaymentInfo {
    amount: bigint;
    from: string;
    to: string;
    memo: string | null;
    signature: string;
    slot: number;
}
export declare class PaymentProcessorAgent {
    private config;
    private agentKeypair;
    private agentUSDCAccount;
    private usdcMint;
    private isMonitoring;
    private subscriptionId;
    constructor(config: PaymentProcessorConfig);
    /**
     * Start monitoring the agent's USDC account
     */
    start(): Promise<void>;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * Poll for new transactions (simpler than WebSocket for demo)
     */
    private startPolling;
    /**
     * Process incoming transaction
     */
    private processTransaction;
    /**
     * Extract payment info from transaction
     */
    private extractPaymentInfo;
    /**
     * Extract memo from transaction
     */
    private extractMemo;
    /**
     * Parse affiliate ID from memo
     * Expected format: "AFF_12345" or "REF:AFF_12345"
     */
    private parseAffiliateMemo;
    /**
     * Calculate payment splits
     */
    private calculateSplits;
    /**
     * Execute payment split via facilitator
     */
    private executeSplit;
    /**
     * Record transaction in database
     */
    private recordTransaction;
    /**
     * Get agent status
     */
    getStatus(): {
        merchantId: string;
        businessName: string;
        agentWallet: string;
        isMonitoring: boolean;
    };
}
//# sourceMappingURL=payment-processor.d.ts.map