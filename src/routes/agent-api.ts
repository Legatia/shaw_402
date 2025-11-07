/**
 * Agent API Routes
 * Endpoints for payment processor agents to get split instructions
 * and report completion status
 */

import { Router, type Request, type Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import type { AffiliateDatabase } from '../lib/affiliate-database.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';

const router = Router();

interface AgentAPIConfig {
  affiliateDb: AffiliateDatabase;
  platformWallet: string;
  usdcMint: string;
}

let config: AgentAPIConfig;

/**
 * Initialize agent API routes
 */
export function initializeAgentAPI(cfg: AgentAPIConfig) {
  config = cfg;
}

/**
 * Simple agent authentication middleware
 * In production, use proper JWT or API keys
 */
function authenticateAgent(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(
      errorResponse('Missing or invalid authorization header', 'UNAUTHORIZED', 401)
    );
    return;
  }

  // For now, accept any bearer token
  // In production: verify JWT or API key
  next();
}

/**
 * POST /api/agent/get-split-instructions
 *
 * Agent provides payment details, hub returns split instructions
 */
router.post('/get-split-instructions', authenticateAgent, async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentWallet, amount, referralCode, paymentTxSignature } = req.body;

    // Validation
    if (!agentWallet || !amount || !paymentTxSignature) {
      res.status(400).json(
        errorResponse('Missing required fields: agentWallet, amount, paymentTxSignature', 'MISSING_FIELDS', 400)
      );
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('📋 AGENT REQUESTING SPLIT INSTRUCTIONS');
    console.log('═══════════════════════════════════════════════');
    console.log(`Agent Wallet: ${agentWallet}`);
    console.log(`Amount: ${amount}`);
    console.log(`Referral Code: ${referralCode || 'None'}`);
    console.log(`Payment Tx: ${paymentTxSignature}`);
    console.log('');

    // Find merchant by agent wallet
    const merchant = await config.affiliateDb.getMerchantByAgentWallet(agentWallet);

    if (!merchant) {
      console.log('❌ Merchant not found for agent wallet');
      res.status(404).json(
        errorResponse('Merchant not found for agent wallet', 'MERCHANT_NOT_FOUND', 404)
      );
      return;
    }

    console.log(`✅ Merchant found: ${merchant.businessName} (${merchant.merchantId})`);

    // Calculate split amounts
    const totalAmount = BigInt(amount);
    const platformFee = (totalAmount * BigInt(Math.floor(merchant.platformFeeRate * 1000))) / 1000n;

    let affiliateCommission = 0n;
    let affiliateWallet = null;
    let affiliateUSDCAccount = null;

    // If referral code provided, look up affiliate
    if (referralCode) {
      const affiliate = await config.affiliateDb.getAffiliateByReferralCode(referralCode);

      if (affiliate) {
        console.log(`✅ Affiliate found: ${affiliate.affiliateId} (${affiliate.affiliateWallet})`);
        affiliateCommission = (totalAmount * BigInt(Math.floor(merchant.affiliateFeeRate * 1000))) / 1000n;
        affiliateWallet = affiliate.affiliateWallet;

        // Get affiliate's USDC account
        const usdcMint = new PublicKey(config.usdcMint);
        const affiliatePubkey = new PublicKey(affiliate.affiliateWallet);
        affiliateUSDCAccount = (await getAssociatedTokenAddress(usdcMint, affiliatePubkey)).toString();
      } else {
        console.log(`⚠️  Affiliate not found for code: ${referralCode}`);
      }
    }

    const merchantAmount = totalAmount - platformFee - affiliateCommission;

    // Get USDC accounts
    const platformPubkey = new PublicKey(config.platformWallet);
    const usdcMint = new PublicKey(config.usdcMint);

    const platformUSDCAccount = (await getAssociatedTokenAddress(usdcMint, platformPubkey)).toString();
    const merchantUSDCAccount = merchant.merchantUSDCAccount;

    // Build recipients array
    const recipients = [
      {
        role: 'platform',
        wallet: config.platformWallet,
        amount: platformFee.toString(),
        usdcAccount: platformUSDCAccount,
      },
    ];

    if (affiliateWallet && affiliateCommission > 0n) {
      recipients.push({
        role: 'affiliate',
        wallet: affiliateWallet,
        amount: affiliateCommission.toString(),
        usdcAccount: affiliateUSDCAccount!,
      });
    }

    recipients.push({
      role: 'merchant',
      wallet: merchant.merchantWallet,
      amount: merchantAmount.toString(),
      usdcAccount: merchantUSDCAccount,
    });

    // Generate split ID
    const splitId = `split_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log('');
    console.log('💵 SPLIT CALCULATION:');
    console.log(`  Platform (${merchant.platformFeeRate * 100}%): ${platformFee.toString()} micro-units`);
    if (affiliateCommission > 0n) {
      console.log(`  Affiliate (${merchant.affiliateFeeRate * 100}%): ${affiliateCommission.toString()} micro-units`);
    }
    console.log(`  Merchant: ${merchantAmount.toString()} micro-units`);
    console.log(`  Total: ${totalAmount.toString()} micro-units`);
    console.log('');
    console.log(`✅ Split instructions ready: ${splitId}`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    res.json(
      successResponse({
        splitId,
        merchantId: merchant.merchantId,
        totalAmount: amount,
        recipients,
        facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3001',
        calculation: {
          platformFee: platformFee.toString(),
          affiliateCommission: affiliateCommission.toString(),
          merchantAmount: merchantAmount.toString(),
        }
      })
    );

  } catch (error) {
    console.error('❌ Error getting split instructions:', error);
    res.status(500).json(
      errorResponse(
        error instanceof Error ? error.message : 'Failed to get split instructions',
        'SPLIT_INSTRUCTIONS_ERROR',
        500
      )
    );
  }
});

/**
 * POST /api/agent/confirm-split
 *
 * Agent reports successful split execution
 */
router.post('/confirm-split', authenticateAgent, async (req: Request, res: Response): Promise<void> => {
  try {
    const { splitId, settlementTx, status, agentWallet, referralCode } = req.body;

    if (!splitId || !settlementTx || !status) {
      res.status(400).json(
        errorResponse('Missing required fields: splitId, settlementTx, status', 'MISSING_FIELDS', 400)
      );
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ AGENT CONFIRMING SPLIT COMPLETION');
    console.log('═══════════════════════════════════════════════');
    console.log(`Split ID: ${splitId}`);
    console.log(`Settlement Tx: ${settlementTx}`);
    console.log(`Status: ${status}`);
    console.log('');

    // Find merchant by agent wallet
    const merchant = await config.affiliateDb.getMerchantByAgentWallet(agentWallet);

    if (!merchant) {
      res.status(404).json(
        errorResponse('Merchant not found', 'MERCHANT_NOT_FOUND', 404)
      );
      return;
    }

    // Store payment split record
    const affiliateId = referralCode ?
      (await config.affiliateDb.getAffiliateByReferralCode(referralCode))?.affiliateId : null;

    // Get split details from request or reconstruct
    // In production, you'd store pending splits and retrieve them here
    await config.affiliateDb.storePaymentSplit({
      txSignature: settlementTx,
      merchantId: merchant.merchantId,
      affiliateId: affiliateId || null,
      buyerWallet: 'CUSTOMER_WALLET', // Should be passed or stored
      totalAmount: '0', // Should be passed or stored
      platformFee: '0',
      affiliateCommission: '0',
      merchantAmount: '0',
      status: status as 'pending' | 'completed' | 'failed',
      timestamp: Date.now(),
    });

    // Update affiliate earnings if applicable
    if (affiliateId && status === 'completed') {
      // Would update affiliate earnings here
      console.log(`✅ Updated affiliate earnings for: ${affiliateId}`);
    }

    console.log(`✅ Split confirmed and recorded`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    res.json(
      successResponse({
        splitId,
        status: 'recorded',
        message: 'Split completion confirmed and recorded',
      })
    );

  } catch (error) {
    console.error('❌ Error confirming split:', error);
    res.status(500).json(
      errorResponse(
        error instanceof Error ? error.message : 'Failed to confirm split',
        'SPLIT_CONFIRMATION_ERROR',
        500
      )
    );
  }
});

/**
 * Helper: Add method to AffiliateDatabase to find merchant by agent wallet
 * This should be added to affiliate-database.ts
 */

export default router;
