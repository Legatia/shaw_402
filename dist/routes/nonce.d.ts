/**
 * Nonce management routes
 */
import type { Request, Response } from 'express';
import type { NonceDatabase } from '../lib/nonce-database.js';
export interface NonceRouteContext {
    nonceDb: NonceDatabase;
}
/**
 * Get nonce status endpoint
 */
export declare function getNonceRoute(context: NonceRouteContext): (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=nonce.d.ts.map