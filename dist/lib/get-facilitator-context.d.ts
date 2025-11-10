/**
 * Facilitator Context - Gill template pattern
 * Centralized dependency injection for the facilitator
 */
import type { Address, KeyPairSigner } from 'gill';
import { SolanaUtils } from './solana-utils.js';
import { NonceDatabase } from './nonce-database.js';
import { FacilitatorConfig } from './get-facilitator-config.js';
import { ApiLogger } from './api-logger.js';
export interface FacilitatorContext {
    config: FacilitatorConfig;
    log: ApiLogger;
    facilitatorKeypair: KeyPairSigner;
    facilitatorAddress: Address;
    solanaUtils: SolanaUtils;
    nonceDb: NonceDatabase;
}
export declare function getFacilitatorContext(): Promise<FacilitatorContext>;
//# sourceMappingURL=get-facilitator-context.d.ts.map