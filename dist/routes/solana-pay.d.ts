/**
 * Solana Pay Transaction Request API
 * Implements the Solana Pay specification for interactive transaction requests
 */
import { PublicKey } from '@solana/web3.js';
import type { SolanaUtils } from '../lib/solana-utils.js';
import type { NonceDatabase } from '../lib/nonce-database.js';
declare const router: import("express-serve-static-core").Router;
interface SolanaPayConfig {
    solanaUtils: SolanaUtils;
    nonceDb: NonceDatabase;
    merchantAddress: PublicKey;
    serverBaseUrl: string;
    label: string;
    iconUrl?: string;
}
/**
 * Initialize Solana Pay routes with configuration
 */
export declare function initializeSolanaPayRoutes(cfg: SolanaPayConfig): void;
export default router;
//# sourceMappingURL=solana-pay.d.ts.map