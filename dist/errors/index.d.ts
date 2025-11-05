/**
 * Custom error classes for x402 protocol
 */
export declare class X402Error extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare class PaymentVerificationError extends X402Error {
    constructor(message: string);
}
export declare class PaymentSettlementError extends X402Error {
    constructor(message: string);
}
export declare class InvalidPaymentRequestError extends X402Error {
    constructor(message: string);
}
export declare class NonceError extends X402Error {
    constructor(message: string);
}
export declare class DatabaseError extends X402Error {
    constructor(message: string);
}
export declare class InsufficientBalanceError extends X402Error {
    constructor(message: string);
}
export declare class TransactionError extends X402Error {
    constructor(message: string);
}
export declare class SignatureVerificationError extends X402Error {
    constructor(message: string);
}
//# sourceMappingURL=index.d.ts.map