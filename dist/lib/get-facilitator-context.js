/**
 * Facilitator Context - Gill template pattern
 * Centralized dependency injection for the facilitator
 */
import { createKeyPairSignerFromBytes } from 'gill';
import bs58 from 'bs58';
import { SolanaUtils } from './solana-utils.js';
import { NonceDatabase } from './nonce-database.js';
import { getFacilitatorConfig } from './get-facilitator-config.js';
import { log } from './api-logger.js';
let context;
export async function getFacilitatorContext() {
    if (context) {
        return context;
    }
    const config = getFacilitatorConfig();
    // Initialize facilitator keypair
    const privateKeyBytes = bs58.decode(config.facilitatorPrivateKey);
    const facilitatorKeypair = await createKeyPairSignerFromBytes(privateKeyBytes);
    const facilitatorAddress = facilitatorKeypair.address;
    // Initialize Solana utilities
    const solanaUtils = new SolanaUtils({
        rpcEndpoint: config.solanaRpcUrl,
        rpcSubscriptionsEndpoint: config.solanaWsUrl,
    });
    // Initialize nonce database
    const nonceDb = new NonceDatabase(config.databasePath);
    context = {
        config,
        log,
        facilitatorKeypair,
        facilitatorAddress,
        solanaUtils,
        nonceDb,
    };
    return context;
}
//# sourceMappingURL=get-facilitator-context.js.map