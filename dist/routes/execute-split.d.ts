/**
 * x402-Protected Split Execution Endpoint
 * Agent must provide valid x402 payment to access split execution service
 */
import type { Request, Response } from 'express';
import { PublicKey, Keypair } from '@solana/web3.js';
import type { SolanaUtils } from '../lib/solana-utils.js';
import type { NonceDatabase } from '../lib/nonce-database.js';
export interface ExecuteSplitContext {
    solanaUtils: SolanaUtils;
    nonceDb: NonceDatabase;
    facilitatorAddress: PublicKey;
    facilitatorKeypair: Keypair;
    config: {
        facilitatorPrivateKey: string;
    };
}
/**
 * Split Recipient Interface
 */
export interface SplitRecipient {
    role: 'platform' | 'affiliate' | 'merchant';
    wallet: string;
    amount: string;
    usdcAccount: string;
}
/**
 * Execute Split Request Body
 */
export interface ExecuteSplitRequest {
    splitId: string;
    recipients: SplitRecipient[];
    agentUSDCAccount: string;
    usdcMint: string;
    agentPrivateKey: string;
}
/**
 * x402-Protected Execute Split Route
 *
 * This endpoint is protected by x402 middleware (applied in facilitator/index.ts)
 * Agent must provide valid x402 payment authorization in X-Payment header
 *
 * POST /execute-split
 * Headers: { "X-Payment": "<x402_payment_request>" }
 * Body: { splitId, recipients, agentUSDCAccount, usdcMint }
 */
export declare function executeSplitRoute(context: ExecuteSplitContext): (req: Request, res: Response) => Promise<void>;
export default executeSplitRoute;
//# sourceMappingURL=execute-split.d.ts.map