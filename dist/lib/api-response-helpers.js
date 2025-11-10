/**
 * API Response Helpers - Gill template pattern
 * Standardized response format for all endpoints
 */
export function errorResponse(message, code = 'INTERNAL_ERROR', _statusCode = 500) {
    return {
        success: false,
        error: {
            code,
            message,
        },
    };
}
export function successResponse(data) {
    return {
        success: true,
        data,
    };
}
//# sourceMappingURL=api-response-helpers.js.map