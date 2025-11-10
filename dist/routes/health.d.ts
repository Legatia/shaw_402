/**
 * Health check routes
 */
import type { Request, Response } from 'express';
import type { Address } from 'gill';
export interface HealthRouteContext {
    facilitatorAddress: Address;
    rpcEndpoint: string;
}
/**
 * Health check endpoint
 */
export declare function healthCheckRoute(context: HealthRouteContext): (_req: Request, res: Response) => void;
//# sourceMappingURL=health.d.ts.map