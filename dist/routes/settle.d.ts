/**
 * Payment settlement routes
 */
import type { Request, Response } from 'express';
import type { Address } from 'gill';
import { SolanaUtils } from '../lib/solana-utils.js';
import type { NonceDatabase } from '../lib/nonce-database.js';
export interface SettleRouteContext {
    solanaUtils: SolanaUtils;
    nonceDb: NonceDatabase;
    facilitatorAddress: Address;
    facilitatorKeypair: any;
    simulateTransactions: boolean;
    config: {
        facilitatorPrivateKey: string;
    };
}
/**
 * Settle a payment (Step 2 of x402 protocol)
 * 1. Performs the same checks as /verify
 * 2. Submits the Solana transaction to the RPC, using the client's signature
 * 3. Records the Nonce (or Signature) in the database
 * 4. Returns {"status": "settled"}
 */
export declare function settlePaymentRoute(context: SettleRouteContext): (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=settle.d.ts.map