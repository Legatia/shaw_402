/**
 * Statistics routes
 * Directly consumes the stats module instead of calling its own endpoint
 */
import type { Request, Response } from 'express';
import type { NonceDatabase } from '../lib/nonce-database.js';
export interface StatsRouteContext {
    nonceDb: NonceDatabase;
}
/**
 * Get statistics endpoint
 * Directly consumes the nonce database stats instead of making HTTP call
 */
export declare function getStatsRoute(context: StatsRouteContext): (_req: Request, res: Response) => Promise<void>;
/**
 * Cleanup expired nonces endpoint
 */
export declare function cleanupNoncesRoute(context: StatsRouteContext): (_req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=stats.d.ts.map