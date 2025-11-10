/**
 * Nonce Database Manager
 * Handles nonce storage and validation to prevent replay attacks
 */
export interface NonceData {
    nonce: string;
    clientPublicKey: string;
    amount: string;
    recipient: string;
    resourceId: string;
    resourceUrl: string;
    timestamp: number;
    expiry: number;
}
export interface NonceDetails extends NonceData {
    usedAt: number | null;
    transactionSignature: string | null;
    createdAt: string;
}
export interface TransactionData {
    nonce: string;
    transactionSignature: string | null;
    status: 'pending' | 'confirmed' | 'failed';
    errorMessage?: string | null;
}
export interface NonceStats {
    totalNonces: number;
    usedNonces: number;
    activeNonces: number;
    expiredNonces: number;
}
export interface NonceUsedStatus {
    used: boolean;
    data: {
        usedAt: number;
        transactionSignature: string | null;
    } | null;
}
/**
 * Nonce Database Manager
 */
export declare class NonceDatabase {
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
     * Store a new nonce
     */
    storeNonce(nonceData: NonceData): Promise<number>;
    /**
     * Check if a nonce has been used
     */
    isNonceUsed(nonce: string): Promise<NonceUsedStatus>;
    /**
     * Mark a nonce as used
     */
    markNonceUsed(nonce: string, transactionSignature: string | null): Promise<number>;
    /**
     * Get nonce details
     */
    getNonceDetails(nonce: string): Promise<NonceDetails | null>;
    /**
     * Update transaction signature for a nonce
     */
    updateTransactionSignature(nonce: string, transactionSignature: string): Promise<number>;
    /**
     * Clean up expired nonces
     */
    cleanupExpiredNonces(): Promise<number>;
    /**
     * Get statistics about nonces
     */
    getNonceStats(): Promise<NonceStats>;
    /**
     * Store transaction record
     */
    storeTransaction(transactionData: TransactionData): Promise<number>;
    /**
     * Update transaction status
     */
    updateTransactionStatus(transactionSignature: string, status: string, errorMessage?: string | null): Promise<number>;
    /**
     * Close the database connection
     */
    close(): Promise<void>;
}
//# sourceMappingURL=nonce-database.d.ts.map