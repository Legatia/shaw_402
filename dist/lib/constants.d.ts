/**
 * Application Constants
 * Configurable via environment variables with sensible defaults
 */
import 'dotenv/config';
/**
 * HTTP Request Configuration
 */
export declare const REQUEST_TIMEOUT: number;
export declare const RETRY_ATTEMPTS: number;
export declare const RETRY_DELAY: number;
export declare const REQUEST_BODY_LIMIT: string;
/**
 * Background Task Configuration
 */
export declare const CLEANUP_INTERVAL_HOURS: number;
export declare const CLEANUP_INTERVAL_MS: number;
/**
 * Payment Tier Amounts (in lamports)
 * Default values can be overridden via environment variables
 */
export declare const PAYMENT_AMOUNTS: {
    PREMIUM_DATA: string;
    GENERATE_CONTENT: string;
    DOWNLOAD_FILE: string;
    TIER_ACCESS: string;
};
//# sourceMappingURL=constants.d.ts.map