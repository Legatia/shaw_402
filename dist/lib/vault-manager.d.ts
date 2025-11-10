/**
 * Vault Manager
 * Handles merchant deposits, staking, and reward distribution
 */
import { PublicKey, Keypair } from '@solana/web3.js';
import type { SolanaUtils } from './solana-utils.js';
export interface VaultConfig {
    vaultKeypair: Keypair;
    solanaUtils: SolanaUtils;
    usdcMint: PublicKey;
    minimumDeposit: {
        SOL: bigint;
        USDC: bigint;
    };
    stakingEnabled: boolean;
    rewardShareRate: number;
}
export interface DepositInfo {
    depositId: string;
    merchantWallet: string;
    amount: string;
    token: 'SOL' | 'USDC';
    timestamp: number;
}
export interface StakeInfo {
    stakeId: string;
    depositId: string;
    amount: string;
    protocol: 'native' | 'marinade' | 'jito' | 'none';
    rewardsEarned: string;
}
export declare class VaultManager {
    private config;
    private connection;
    constructor(config: VaultConfig);
    /**
     * Get vault public key
     */
    getVaultAddress(): string;
    /**
     * Get vault USDC token account
     */
    getVaultUSDCAccount(): Promise<PublicKey>;
    /**
     * Get vault SOL balance
     */
    getVaultSOLBalance(): Promise<bigint>;
    /**
     * Get vault USDC balance
     */
    getVaultUSDCBalance(): Promise<bigint>;
    /**
     * Verify merchant deposit transaction
     * Checks that the transaction sent the correct amount to vault
     */
    verifyDeposit(txSignature: string, expectedAmount: bigint, merchantWallet: string, token: 'SOL' | 'USDC'): Promise<boolean>;
    /**
     * Return deposit to merchant
     * Transfers funds from vault back to merchant wallet
     */
    returnDeposit(merchantWallet: string, amount: bigint, token: 'SOL' | 'USDC'): Promise<{
        success: boolean;
        txSignature?: string;
        error?: string;
    }>;
    /**
     * Calculate staking rewards
     * For now, uses a simple APY calculation
     * In production, integrate with actual staking protocol
     */
    calculateRewards(stakedAmount: bigint, stakingDurationDays: number, apy?: number): bigint;
    /**
     * Get total value locked (TVL) in vault
     */
    getTVL(): Promise<{
        SOL: string;
        USDC: string;
        totalUSD: string;
    }>;
    /**
     * Validate deposit amount meets minimum requirement
     */
    validateDepositAmount(amount: bigint, token: 'SOL' | 'USDC'): boolean;
    /**
     * Get minimum deposit requirements
     */
    getMinimumDeposits(): {
        SOL: string;
        USDC: string;
    };
}
/**
 * Helper: Generate unique deposit ID
 */
export declare function generateDepositId(): string;
/**
 * Helper: Generate unique stake ID
 */
export declare function generateStakeId(): string;
//# sourceMappingURL=vault-manager.d.ts.map