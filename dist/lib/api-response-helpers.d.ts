/**
 * API Response Helpers - Gill template pattern
 * Standardized response format for all endpoints
 */
export interface ErrorDetail {
    code: string;
    message: string;
}
export interface ApiErrorResponse {
    success: false;
    error: ErrorDetail;
}
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
export declare function errorResponse(message: string, code?: string, _statusCode?: number): ApiErrorResponse;
export declare function successResponse<T>(data: T): ApiSuccessResponse<T>;
//# sourceMappingURL=api-response-helpers.d.ts.map