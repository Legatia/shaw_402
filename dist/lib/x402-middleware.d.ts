/**
 * x402 Express Middleware
 * Handles payment verification and routing for the x402 protocol
 * Uses native fetch instead of axios
 */
import type { Request, Response, NextFunction } from 'express';
export interface X402Options {
    facilitatorUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}
export interface RouteConfig {
    amount?: string;
    payTo?: string;
    asset?: string;
    network?: string;
}
export interface PaymentInfo {
    verified: boolean;
    nonce: string;
    amount: string;
    recipient: string;
    resourceId: string;
    transactionSignature: string;
}
export interface VerificationResult {
    isValid: boolean;
    error?: string;
}
export interface SettlementResult {
    status: string;
    transactionSignature?: string;
    error?: string;
}
export interface HealthCheckResult {
    healthy: boolean;
    facilitator?: string;
    timestamp?: string;
    error?: string;
}
export interface StatsResult {
    success: boolean;
    data?: {
        totalNonces: number;
        usedNonces: number;
        activeNonces: number;
        expiredNonces: number;
    };
    error?: string;
}
export interface PaymentRequestData {
    payload: {
        amount: string;
        recipient: string;
        resourceId: string;
        resourceUrl: string;
        nonce: string;
        timestamp: number;
        expiry: number;
    };
    signature: string;
    clientPublicKey: string;
}
declare global {
    namespace Express {
        interface Request {
            payment?: PaymentInfo;
        }
    }
}
/**
 * x402 Middleware Class
 */
export declare class X402Middleware {
    private facilitatorUrl;
    private timeout;
    private retryAttempts;
    private retryDelay;
    private routeConfig;
    constructor(options?: X402Options, routeConfig?: RouteConfig);
    /**
     * Main middleware function - implements x402 protocol
     */
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Verify payment request with facilitator
     */
    verifyPayment(paymentRequest: PaymentRequestData): Promise<VerificationResult>;
    /**
     * Settle payment with facilitator
     */
    settlePayment(paymentRequest: PaymentRequestData): Promise<SettlementResult>;
    /**
     * Retry mechanism for failed requests
     */
    retryRequest<T>(requestFn: () => Promise<T>, attempts?: number): Promise<T>;
    /**
     * Health check for facilitator connection
     */
    healthCheck(): Promise<HealthCheckResult>;
    /**
     * Get facilitator statistics
     */
    getStats(): Promise<StatsResult>;
}
/**
 * Factory function to create middleware instance
 */
export declare function createX402Middleware(routeConfig?: RouteConfig, options?: X402Options): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Create middleware with additional utility methods
 */
export declare function createX402MiddlewareWithUtils(routeConfig?: RouteConfig, options?: X402Options): {
    middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    healthCheck: () => Promise<HealthCheckResult>;
    getStats: () => Promise<StatsResult>;
    verifyPayment: (paymentRequest: PaymentRequestData) => Promise<VerificationResult>;
    settlePayment: (paymentRequest: PaymentRequestData) => Promise<SettlementResult>;
};
//# sourceMappingURL=x402-middleware.d.ts.map