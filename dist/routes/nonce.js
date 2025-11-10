/**
 * Nonce management routes
 */
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
/**
 * Get nonce status endpoint
 */
export function getNonceRoute(context) {
    return async (req, res) => {
        try {
            const nonce = req.params.nonce;
            const details = await context.nonceDb.getNonceDetails(nonce);
            if (!details) {
                res.status(404).json(errorResponse('Nonce not found', 'NONCE_NOT_FOUND', 404));
                return;
            }
            res.json(successResponse(details));
        }
        catch (error) {
            res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Unknown error', 'NONCE_ERROR', 500));
        }
    };
}
//# sourceMappingURL=nonce.js.map