/**
 * API Logger - Gill template pattern
 * Structured logging for the application
 */
export interface ApiLogger {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
}
export declare const log: ApiLogger;
//# sourceMappingURL=api-logger.d.ts.map