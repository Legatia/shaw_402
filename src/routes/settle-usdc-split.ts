/**
 * USDC Payment Split Settlement Route
 * Handles atomic multi-party USDC splits for affiliate commissions
 */

import { Router, Request, Response } from 'express';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getFacilitatorContext } from '../lib/get-facilitator-context.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';

const router = Router();

/**
 * POST /settle-usdc-split
 *
 * Settles a multi-party USDC payment split
 *
 * Body:
 * {
 *   agentPrivateKey: string (base58),
 *   usdcMint: string (USDC mint address),
 *   recipients: [
 *     { publicKey: string, amount: string (USDC in smallest units) }
 *   ]
 * }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentPrivateKey, usdcMint, recipients } = req.body;

    // Validation
    if (!agentPrivateKey || !usdcMint || !recipients || !Array.isArray(recipients)) {
      res.status(400).json(
        errorResponse('Missing required fields: agentPrivateKey, usdcMint, recipients', 'INVALID_INPUT', 400)
      );
      return;
    }

    if (recipients.length === 0 || recipients.length > 10) {
      res.status(400).json(
        errorResponse('Recipients array must contain 1-10 recipients', 'INVALID_RECIPIENTS', 400)
      );
      return;
    }

    const context = await getFacilitatorContext();
    const solanaUtils = context.solanaUtils;

    // Decode agent keypair
    const agentKeypair = Keypair.fromSecretKey(bs58.decode(agentPrivateKey));

    console.log('');
    console.log('='.repeat(80));
    console.log('USDC PAYMENT SPLIT SETTLEMENT');
    console.log('='.repeat(80));
    console.log(`Agent: ${agentKeypair.publicKey.toString()}`);
    console.log(`USDC Mint: ${usdcMint}`);
    console.log(`Recipients: ${recipients.length}`);
    console.log('');

    // Parse recipients
    const parsedRecipients = recipients.map((r: any, index: number) => {
      if (!r.publicKey || !r.amount) {
        throw new Error(`Recipient ${index} missing publicKey or amount`);
      }

      const owner = new PublicKey(r.publicKey);
      const amount = BigInt(r.amount);

      if (amount <= 0) {
        throw new Error(`Recipient ${index} amount must be positive`);
      }

      console.log(`  Recipient ${index + 1}:`);
      console.log(`    Wallet: ${owner.toString()}`);
      console.log(`    Amount: ${solanaUtils.usdcToHuman(amount)} USDC`);

      return { owner, amount };
    });

    console.log('');
    console.log('Executing atomic USDC split...');

    // Execute atomic USDC split
    const usdcMintPubkey = new PublicKey(usdcMint);
    const signature = await solanaUtils.splitUSDCPayment(agentKeypair, usdcMintPubkey, parsedRecipients);

    console.log('');
    console.log('✅ USDC split settlement completed!');
    console.log(`Transaction: ${signature}`);
    console.log('='.repeat(80));
    console.log('');

    // Return success
    res.json(
      successResponse({
        signature,
        status: 'completed',
        recipients: recipients.length,
        totalAmount: parsedRecipients.reduce((sum, r) => sum + r.amount, BigInt(0)).toString(),
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${context.config.solanaNetwork}`,
      })
    );
  } catch (error: any) {
    console.error('USDC split settlement error:', error);
    res.status(500).json(
      errorResponse(error.message || 'Failed to settle USDC split', 'SETTLEMENT_ERROR', 500)
    );
  }
});

export default router;
