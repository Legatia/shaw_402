/**
 * Affiliate Database Manager
 * Handles merchants, affiliates, and payment splitting transactions
 */
export interface MerchantData {
    merchantId: string;
    businessName: string;
    merchantWallet: string;
    agentWallet: string;
    agentPrivateKey: string;
    platformFeeRate: number;
    affiliateFeeRate: number;
    registrationTxSignature: string;
    status: 'active' | 'suspended' | 'inactive' | 'cancelled';
    settlementToken: 'USDC';
    usdcMint: string;
    agentUSDCAccount: string;
    merchantUSDCAccount: string;
    cancelledAt?: string;
    refundTxSignature?: string;
    depositAmount?: string;
}
export interface AffiliateData {
    affiliateId: string;
    merchantId: string;
    affiliateWallet: string;
    referralCode: string;
    totalReferrals: number;
    totalEarned: string;
    status: 'active' | 'suspended';
}
export interface PaymentSplitData {
    txSignature: string;
    merchantId: string;
    affiliateId: string | null;
    buyerWallet: string;
    totalAmount: string;
    platformFee: string;
    affiliateCommission: string;
    merchantAmount: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp?: number;
    errorMessage?: string;
}
export interface MerchantDepositData {
    depositId: string;
    merchantId: string;
    depositAmount: string;
    depositToken: 'SOL' | 'USDC';
    depositTxSignature: string;
    vaultAddress: string;
    status: 'active' | 'withdrawn' | 'slashed';
    depositedAt: number;
    withdrawnAt?: number;
    withdrawTxSignature?: string;
    accruedRewards: string;
}
export interface StakingRecordData {
    stakeId: string;
    merchantId: string;
    depositId: string;
    stakedAmount: string;
    stakingProtocol: 'native' | 'marinade' | 'jito' | 'none';
    stakeAccount?: string;
    rewardsEarned: string;
    lastRewardClaim: number;
    status: 'active' | 'unstaking' | 'unstaked';
}
export declare class AffiliateDatabase {
    private db;
    private dbPath;
    constructor(dbPath: string);
    /**
     * Initialize the database and create tables
     */
    initialize(): Promise<void>;
    /**
     * Create necessary tables
     */
    private createTables;
    /**
     * Store a new merchant
     */
    storeMerchant(merchantData: MerchantData): Promise<number>;
    /**
     * Get merchant by ID
     */
    getMerchant(merchantId: string): Promise<MerchantData | null>;
    /**
     * Get merchant by agent wallet
     */
    getMerchantByAgentWallet(agentWallet: string): Promise<MerchantData | null>;
    /**
     * Cancel merchant and process refund
     */
    cancelMerchant(merchantId: string, refundTxSignature: string): Promise<void>;
    /**
     * Store a new affiliate
     */
    storeAffiliate(affiliateData: AffiliateData): Promise<number>;
    /**
     * Get affiliate by referral code
     */
    getAffiliateByReferralCode(referralCode: string): Promise<AffiliateData | null>;
    /**
     * Get all affiliates for a merchant
     */
    getAffiliatesByMerchant(merchantId: string): Promise<AffiliateData[]>;
    /**
     * Store payment split transaction
     */
    storePaymentSplit(splitData: PaymentSplitData): Promise<number>;
    /**
     * Update payment split status
     */
    updatePaymentSplitStatus(txSignature: string, status: 'pending' | 'completed' | 'failed', errorMessage?: string): Promise<void>;
    /**
     * Update affiliate earnings
     */
    updateAffiliateEarnings(affiliateId: string, additionalEarnings: string): Promise<void>;
    /**
     * Get merchant stats
     */
    getMerchantStats(merchantId: string): Promise<any>;
    /**
     * Store merchant deposit record
     */
    storeMerchantDeposit(depositData: MerchantDepositData): Promise<number>;
    /**
     * Get merchant deposit by ID
     */
    getMerchantDeposit(depositId: string): Promise<MerchantDepositData | null>;
    /**
     * Get all deposits for a merchant
     */
    getMerchantDeposits(merchantId: string): Promise<MerchantDepositData[]>;
    /**
     * Update merchant deposit status
     */
    updateMerchantDepositStatus(depositId: string, status: 'active' | 'withdrawn' | 'slashed', withdrawnAt?: number, withdrawTxSignature?: string): Promise<void>;
    /**
     * Update merchant deposit rewards
     */
    updateMerchantDepositRewards(depositId: string, accruedRewards: string): Promise<void>;
    /**
     * Store staking record
     */
    storeStakingRecord(stakingData: StakingRecordData): Promise<number>;
    /**
     * Get staking record by deposit ID
     */
    getStakingRecordByDeposit(depositId: string): Promise<StakingRecordData | null>;
    /**
     * Close the database connection
     */
    close(): Promise<void>;
}
//# sourceMappingURL=affiliate-database.d.ts.map