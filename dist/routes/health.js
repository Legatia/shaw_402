/**
 * Health check routes
 */
import { successResponse } from '../lib/api-response-helpers.js';
/**
 * Health check endpoint
 */
export function healthCheckRoute(context) {
    return (_req, res) => {
        res.json(successResponse({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            facilitator: context.facilitatorAddress.toString(),
        }));
    };
}
//# sourceMappingURL=health.js.map