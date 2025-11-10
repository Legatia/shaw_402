/**
 * ZK Privacy Utilities
 * Provides commitment schemes and encryption for private payment splits
 */
/**
 * Initialize Poseidon hash (call once at startup)
 */
export declare function initializePoseidon(): Promise<void>;
/**
 * Poseidon hash function (ZK-friendly)
 */
export declare function poseidonHash(inputs: bigint[]): string;
/**
 * Generate cryptographically secure random nonce
 */
export declare function generateNonce(): bigint;
/**
 * Convert string to BigInt for hashing
 */
export declare function stringToBigInt(str: string): bigint;
/**
 * Convert BigInt back to string
 */
export declare function bigIntToString(num: bigint): string;
/**
 * Create commitment to affiliate ID
 * Commitment = Poseidon(affiliateId, nonce)
 */
export declare function createAffiliateCommitment(affiliateId: string, nonce: bigint): string;
/**
 * Create commitment to payment split amounts
 * Commitment = Poseidon(platformFee, affiliateCommission, merchantAmount, nonce)
 */
export declare function createSplitCommitment(platformFee: bigint, affiliateCommission: bigint, merchantAmount: bigint, nonce: bigint): string;
/**
 * Verify affiliate commitment
 */
export declare function verifyAffiliateCommitment(affiliateId: string, nonce: bigint, commitment: string): boolean;
/**
 * Verify split commitment
 */
export declare function verifySplitCommitment(platformFee: bigint, affiliateCommission: bigint, merchantAmount: bigint, nonce: bigint, commitment: string): boolean;
/**
 * Encryption/Decryption Types
 */
export interface EncryptedData {
    encrypted: string;
    nonce: string;
    publicKey: string;
}
export interface SplitRecipient {
    wallet: string;
    amount: string;
}
export interface SplitData {
    platform: SplitRecipient;
    affiliate: SplitRecipient | null;
    merchant: SplitRecipient;
}
/**
 * Encryption helper using NaCl box
 */
export declare class PrivacyEncryption {
    private keypair;
    constructor(secretKey?: Uint8Array);
    /**
     * Get public key for sharing
     */
    getPublicKey(): string;
    /**
     * Get secret key for storage (KEEP SECURE!)
     */
    getSecretKey(): string;
    /**
     * Encrypt data for a recipient
     */
    encrypt(data: any, recipientPublicKey: string): EncryptedData;
    /**
     * Decrypt data from a sender
     */
    decrypt(encryptedData: EncryptedData): any;
    /**
     * Encrypt split data for server
     */
    encryptSplitData(splitData: SplitData, serverPublicKey: string): EncryptedData;
    /**
     * Decrypt split data from agent
     */
    decryptSplitData(encryptedData: EncryptedData): SplitData;
}
/**
 * Create encryption instance from environment or generate new
 */
export declare function createServerEncryption(): PrivacyEncryption;
/**
 * Create encryption instance for agent
 */
export declare function createAgentEncryption(agentPrivateKey: string): PrivacyEncryption;
/**
 * Payment split calculator with commitment generation
 */
export interface SplitCalculation {
    platformFee: bigint;
    affiliateCommission: bigint;
    merchantAmount: bigint;
    nonce: bigint;
    affiliateCommitment: string;
    splitCommitment: string;
}
export declare function calculateSplitWithCommitments(totalAmount: bigint, platformRate: number, affiliateRate: number, affiliateId: string | null, existingNonce?: bigint): SplitCalculation;
/**
 * Verify split calculation matches commitments
 */
export declare function verifySplitCalculation(calculation: SplitCalculation, affiliateId: string | null): {
    affiliateValid: boolean;
    splitValid: boolean;
    amountValid: boolean;
};
/**
 * Generate authentication token for agent
 */
export declare function generateAgentToken(merchantId: string, agentWallet: string, secret: string): string;
/**
 * Verify agent authentication token
 */
export declare function verifyAgentToken(token: string, merchantId: string, agentWallet: string, secret: string, _maxAgeMs?: number): boolean;
/**
 * Export utilities for easy access
 */
export declare const ZKPrivacy: {
    initializePoseidon: typeof initializePoseidon;
    generateNonce: typeof generateNonce;
    createAffiliateCommitment: typeof createAffiliateCommitment;
    createSplitCommitment: typeof createSplitCommitment;
    verifyAffiliateCommitment: typeof verifyAffiliateCommitment;
    verifySplitCommitment: typeof verifySplitCommitment;
    calculateSplitWithCommitments: typeof calculateSplitWithCommitments;
    verifySplitCalculation: typeof verifySplitCalculation;
    PrivacyEncryption: typeof PrivacyEncryption;
    createServerEncryption: typeof createServerEncryption;
    createAgentEncryption: typeof createAgentEncryption;
    generateAgentToken: typeof generateAgentToken;
    verifyAgentToken: typeof verifyAgentToken;
};
export default ZKPrivacy;
//# sourceMappingURL=zk-privacy.d.ts.map