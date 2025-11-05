/**
 * Payment verification routes
 */
import type { Request, Response } from 'express';
import type { Address } from 'gill';
import { SolanaUtils } from '../lib/solana-utils.js';
import type { NonceDatabase } from '../lib/nonce-database.js';
export interface VerifyRouteContext {
    solanaUtils: SolanaUtils;
    nonceDb: NonceDatabase;
    facilitatorAddress: Address;
    maxPaymentAmount: bigint;
}
/**
 * Verify a payment request (Step 1 of x402 protocol)
 * 1. Receives the signed payload (Signature + Nonce)
 * 2. Checks the database for the Nonce. If the Nonce exists, returns an error
 * 3. Verifies the cryptographic signature against the client's public key
 * 4. Returns {"isValid": true} or {"isValid": false}
 */
export declare function verifyPaymentRoute(context: VerifyRouteContext): (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=verify.d.ts.map