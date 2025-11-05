/**
 * Merchant Registration and Management Routes
 */

import { Router, Request, Response } from 'express';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import crypto from 'crypto';
import { AffiliateDatabase, MerchantData, AffiliateData } from '../lib/affiliate-database.js';
import { SolanaUtils } from '../lib/solana-utils.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';

const router = Router();

// Platform configuration
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '';
const PLATFORM_KEYPAIR_SECRET = process.env.PLATFORM_PRIVATE_KEY || ''; // Platform wallet private key
// const REGISTRATION_FEE = process.env.REGISTRATION_FEE || '50000000'; // 0.05 SOL default
const PLATFORM_BASE_URL = process.env.PLATFORM_BASE_URL || 'http://localhost:3000';
const USDC_MINT_ADDRESS = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
const AGENT_GAS_FUNDING = 10_000_000; // 0.01 SOL for gas fees

// Initialize database and Solana utils
let affiliateDb: AffiliateDatabase;
let solanaUtils: SolanaUtils;

export function initializeMerchantRoutes(db: AffiliateDatabase, utils: SolanaUtils) {
  affiliateDb = db;
  solanaUtils = utils;
}

/**
 * Generate unique merchant ID
 */
function generateMerchantId(): string {
  return `MER_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Generate unique affiliate ID
 */
function generateAffiliateId(): string {
  return `AFF_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Generate referral code
 */
function generateReferralCode(merchantId: string, affiliateWallet: string): string {
  const hash = crypto.createHash('sha256').update(`${merchantId}-${affiliateWallet}`).digest('hex');
  return hash.substring(0, 10).toUpperCase();
}

/**
 * POST /merchant/register
 * Register a new merchant
 *
 * Body:
 * - businessName: string
 * - merchantWallet: string (Solana wallet address)
 * - txSignature: string (Payment transaction signature)
 * - platformFeeRate: number (optional, default 0.05)
 * - affiliateFeeRate: number (optional, default 0.15)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessName, merchantWallet, txSignature, platformFeeRate, affiliateFeeRate } = req.body;

    // Validation
    if (!businessName || !merchantWallet || !txSignature) {
      res.status(400).json(
        errorResponse('Missing required fields: businessName, merchantWallet, txSignature', 'INVALID_INPUT', 400)
      );
      return;
    }

    // Verify payment transaction
    const isValid = await verifyRegistrationPayment(txSignature, merchantWallet, PLATFORM_WALLET);
    if (!isValid) {
      res.status(400).json(
        errorResponse('Invalid or insufficient registration payment', 'PAYMENT_VERIFICATION_FAILED', 400)
      );
      return;
    }

    // Generate Payment Processor Agent wallet
    const agentKeypair = Keypair.generate();
    const agentWallet = agentKeypair.publicKey.toString();
    const agentPrivateKey = bs58.encode(agentKeypair.secretKey);

    // Generate merchant ID
    const merchantId = generateMerchantId();

    console.log(`🔧 Setting up Payment Processor Agent for ${businessName}...`);
    console.log(`   Merchant ID: ${merchantId}`);
    console.log(`   Agent Wallet: ${agentWallet}`);

    // Setup USDC accounts
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
    const merchantPubkey = new PublicKey(merchantWallet);
    const platformKeypair = Keypair.fromSecretKey(bs58.decode(PLATFORM_KEYPAIR_SECRET));

    // Get USDC token account addresses
    const agentUSDCAccount = await getAssociatedTokenAddress(usdcMint, agentKeypair.publicKey);
    const merchantUSDCAccount = await getAssociatedTokenAddress(usdcMint, merchantPubkey);

    console.log(`   Agent USDC Account: ${agentUSDCAccount.toString()}`);
    console.log(`   Merchant USDC Account: ${merchantUSDCAccount.toString()}`);

    // Create USDC account for agent
    console.log(`   Creating agent USDC token account...`);
    await solanaUtils.getOrCreateAssociatedTokenAccount(usdcMint, agentKeypair.publicKey, platformKeypair);

    // Create USDC account for merchant (if doesn't exist)
    console.log(`   Creating merchant USDC token account...`);
    await solanaUtils.getOrCreateAssociatedTokenAccount(usdcMint, merchantPubkey, platformKeypair);

    // Fund agent wallet with SOL for gas fees
    console.log(`   Funding agent with ${AGENT_GAS_FUNDING / 1_000_000_000} SOL for gas...`);
    await solanaUtils.transferSOL(platformKeypair, agentKeypair.publicKey, AGENT_GAS_FUNDING);

    console.log(`   ✅ Agent setup complete!`);

    // Store merchant in database
    const merchantData: MerchantData = {
      merchantId,
      businessName,
      merchantWallet,
      agentWallet,
      agentPrivateKey,
      platformFeeRate: platformFeeRate || 0.05,
      affiliateFeeRate: affiliateFeeRate || 0.15,
      registrationTxSignature: txSignature,
      status: 'active',
      settlementToken: 'USDC',
      usdcMint: USDC_MINT_ADDRESS,
      agentUSDCAccount: agentUSDCAccount.toString(),
      merchantUSDCAccount: merchantUSDCAccount.toString(),
    };

    await affiliateDb.storeMerchant(merchantData);

    // Generate affiliate recruitment link
    const affiliateSignupUrl = `${PLATFORM_BASE_URL}/affiliate/signup?merchant=${merchantId}`;

    console.log(`✅ Merchant registered: ${merchantId} - ${businessName}`);
    console.log(`   Settlement: USDC (instant commission payouts)`);
    console.log(`   Affiliate Link: ${affiliateSignupUrl}`);

    // Return success response
    res.status(201).json(
      successResponse({
        merchantId,
        businessName,
        agentWallet,
        agentUSDCAccount: agentUSDCAccount.toString(),
        merchantUSDCAccount: merchantUSDCAccount.toString(),
        affiliateSignupUrl,
        platformFeeRate: merchantData.platformFeeRate,
        affiliateFeeRate: merchantData.affiliateFeeRate,
        settlementToken: 'USDC',
        status: 'active',
        note: 'Your agent wallet has been funded with 0.01 SOL for gas fees. All commissions will be paid in USDC.',
      })
    );
  } catch (error: any) {
    console.error('Merchant registration error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to register merchant', 'REGISTRATION_ERROR', 500));
  }
});

/**
 * GET /merchant/:merchantId
 * Get merchant details
 */
router.get('/:merchantId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchantId } = req.params;

    const merchant = await affiliateDb.getMerchant(merchantId);
    if (!merchant) {
      res.status(404).json(errorResponse('Merchant not found', 'NOT_FOUND', 404));
      return;
    }

    // Get merchant stats
    const stats = await affiliateDb.getMerchantStats(merchantId);
    const affiliates = await affiliateDb.getAffiliatesByMerchant(merchantId);

    res.json(
      successResponse({
        merchantId: merchant.merchantId,
        businessName: merchant.businessName,
        merchantWallet: merchant.merchantWallet,
        agentWallet: merchant.agentWallet,
        platformFeeRate: merchant.platformFeeRate,
        affiliateFeeRate: merchant.affiliateFeeRate,
        status: merchant.status,
        stats: {
          totalAffiliates: affiliates.length,
          totalTransactions: stats.total_transactions || 0,
          totalVolume: stats.total_volume || '0',
          totalPlatformFees: stats.total_platform_fees || '0',
          totalMerchantEarnings: stats.total_merchant_earnings || '0',
        },
        affiliateSignupUrl: `${PLATFORM_BASE_URL}/affiliate/signup?merchant=${merchantId}`,
      })
    );
  } catch (error: any) {
    console.error('Get merchant error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get merchant', 'FETCH_ERROR', 500));
  }
});

/**
 * GET /merchant/:merchantId/affiliates
 * Get all affiliates for a merchant
 */
router.get('/:merchantId/affiliates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchantId } = req.params;

    const merchant = await affiliateDb.getMerchant(merchantId);
    if (!merchant) {
      res.status(404).json(errorResponse('Merchant not found', 'NOT_FOUND', 404));
      return;
    }

    const affiliates = await affiliateDb.getAffiliatesByMerchant(merchantId);

    res.json(
      successResponse({
        merchantId,
        affiliates: affiliates.map((aff) => ({
          affiliateId: aff.affiliateId,
          affiliateWallet: aff.affiliateWallet,
          referralCode: aff.referralCode,
          referralUrl: `${PLATFORM_BASE_URL}/pay?merchant=${merchantId}&ref=${aff.referralCode}`,
          totalReferrals: aff.totalReferrals,
          totalEarned: aff.totalEarned,
          status: aff.status,
        })),
      })
    );
  } catch (error: any) {
    console.error('Get affiliates error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to get affiliates', 'FETCH_ERROR', 500));
  }
});

/**
 * POST /merchant/affiliate/register
 * Register a new affiliate for a merchant
 *
 * Body:
 * - merchantId: string
 * - affiliateWallet: string
 */
router.post('/affiliate/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchantId, affiliateWallet } = req.body;

    // Validation
    if (!merchantId || !affiliateWallet) {
      res.status(400).json(errorResponse('Missing required fields: merchantId, affiliateWallet', 'INVALID_INPUT', 400));
      return;
    }

    // Verify merchant exists
    const merchant = await affiliateDb.getMerchant(merchantId);
    if (!merchant) {
      res.status(404).json(errorResponse('Merchant not found', 'NOT_FOUND', 404));
      return;
    }

    // Generate affiliate ID and referral code
    const affiliateId = generateAffiliateId();
    const referralCode = generateReferralCode(merchantId, affiliateWallet);

    // Store affiliate
    const affiliateData: AffiliateData = {
      affiliateId,
      merchantId,
      affiliateWallet,
      referralCode,
      totalReferrals: 0,
      totalEarned: '0',
      status: 'active',
    };

    await affiliateDb.storeAffiliate(affiliateData);

    console.log(`✅ Affiliate registered: ${affiliateId} for merchant ${merchantId}`);
    console.log(`   Referral Code: ${referralCode}`);

    res.status(201).json(
      successResponse({
        affiliateId,
        merchantId,
        affiliateWallet,
        referralCode,
        referralUrl: `${PLATFORM_BASE_URL}/pay?merchant=${merchantId}&ref=${referralCode}`,
        status: 'active',
      })
    );
  } catch (error: any) {
    console.error('Affiliate registration error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to register affiliate', 'REGISTRATION_ERROR', 500));
  }
});

/**
 * Verify registration payment
 */
async function verifyRegistrationPayment(
  txSignature: string,
  fromWallet: string,
  toWallet: string
): Promise<boolean> {
  try {
    // Get transaction details from Solana
    const tx = await solanaUtils.getTransaction(txSignature);
    if (!tx) {
      console.error('Transaction not found:', txSignature);
      return false;
    }

    // Verify transaction is confirmed
    if (!tx.meta || tx.meta.err) {
      console.error('Transaction not confirmed or has errors');
      return false;
    }

    // Verify sender and recipient
    // Note: This is simplified - in production, verify exact transfer details
    const hasTransfer = tx.transaction.message.accountKeys.some(
      (key: any) => key.toString() === fromWallet || key.toString() === toWallet
    );

    if (!hasTransfer) {
      console.error('Transaction does not involve the specified wallets');
      return false;
    }

    // Verify amount (this is simplified - check actual SOL transfer in production)
    // In production: parse transaction instructions to verify exact transfer amount
    // const requiredAmount = BigInt(REGISTRATION_FEE);

    return true;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

export default router;
