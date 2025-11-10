/**
 * Payment Request and Authorization Payload for x402 Protocol
 */
export interface AuthorizationPayloadData {
    amount: string;
    recipient: string;
    resourceId: string;
    resourceUrl: string;
    nonce: string;
    timestamp: number;
    expiry: number;
}
export interface StructuredData {
    domain: {
        name: string;
        version: string;
        chainId: string;
        verifyingContract: string;
    };
    types: {
        [key: string]: Array<{
            name: string;
            type: string;
        }>;
    };
    primaryType: string;
    message: Record<string, unknown>;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
/**
 * Authorization Payload Structure for x402 Protocol
 * This is the structured data that clients sign off-chain
 */
export declare class AuthorizationPayload {
    amount: string;
    recipient: string;
    resourceId: string;
    resourceUrl: string;
    nonce: string;
    timestamp: number;
    expiry: number;
    constructor(data: AuthorizationPayloadData);
    /**
     * Create authorization payload from parameters
     */
    static create(params: {
        amount: string;
        recipient: string;
        resourceId: string;
        resourceUrl: string;
        nonce: string;
        expiryHours?: number;
    }): AuthorizationPayload;
    /**
     * Serialize payload to string for signing
     */
    serialize(): string;
    /**
     * Get raw payload data as JSON string (without structured data format)
     */
    serializeRaw(): string;
    /**
     * Create EIP-712 equivalent structured data for Solana signing
     */
    createStructuredData(): StructuredData;
    /**
     * Get the message hash for signing
     */
    getMessageHash(): string;
    /**
     * Deserialize payload from string
     */
    static deserialize(payloadString: string): AuthorizationPayload;
    /**
     * Validate payload structure and values
     */
    validate(): ValidationResult;
    /**
     * Generate a cryptographically secure nonce
     */
    static generateNonce(): string;
    /**
     * Create a hash of the payload for verification
     */
    hash(): string;
}
export interface PaymentRequestData {
    payload: AuthorizationPayload;
    signature: string;
    clientPublicKey: string;
    signedTransaction?: string;
}
/**
 * Payment Request Structure
 * This represents a complete payment request with signature
 *
 * For TRUE x402 atomic settlement:
 * - Client creates Solana transaction (transfer SOL from client to merchant)
 * - Client signs the transaction
 * - Client sends serialized transaction in `signedTransaction` field
 * - Facilitator adds their signature as fee payer and submits
 */
export declare class PaymentRequest {
    payload: AuthorizationPayload;
    signature: string;
    clientPublicKey: string;
    signedTransaction?: string;
    constructor(data: PaymentRequestData);
    /**
     * Create payment request from authorization data
     */
    static create(params: {
        amount: string;
        recipient: string;
        resourceId: string;
        resourceUrl: string;
        nonce: string;
        signature: string;
        clientPublicKey: string;
        expiryHours?: number;
    }): PaymentRequest;
    /**
     * Validate the payment request
     */
    validate(): ValidationResult;
    /**
     * Serialize payment request for transmission
     */
    serialize(): string;
    /**
     * Deserialize payment request from string
     */
    static deserialize(requestString: string): PaymentRequest;
}
//# sourceMappingURL=payment-request.d.ts.map