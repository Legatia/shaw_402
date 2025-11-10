/**
 * Payment Processor Agent
 * Autonomous agent that monitors USDC payments and triggers automatic splits
 */

import { PublicKey, Keypair, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import { SolanaUtils } from '../lib/solana-utils.js';
import { AffiliateDatabase, MerchantData } from '../lib/affiliate-database.js';

export interface PaymentProcessorConfig {
  merchantData: MerchantData;
  solanaUtils: SolanaUtils;
  affiliateDb: AffiliateDatabase;
  facilitatorUrl: string;
  platformWallet: string;
  platformUSDCAccount: string;
}

export interface PaymentInfo {
  amount: bigint;
  from: string;
  to: string;
  memo: string | null;
  signature: string;
  slot: number;
}

export class PaymentProcessorAgent {
  private config: PaymentProcessorConfig;
  private agentKeypair: Keypair;
  private agentUSDCAccount: PublicKey;
  private usdcMint: PublicKey;
  private isMonitoring: boolean = false;
  private subscriptionId: number | null = null;

  constructor(config: PaymentProcessorConfig) {
    this.config = config;
    this.agentKeypair = Keypair.fromSecretKey(bs58.decode(config.merchantData.agentPrivateKey));
    this.agentUSDCAccount = new PublicKey(config.merchantData.agentUSDCAccount);
    this.usdcMint = new PublicKey(config.merchantData.usdcMint);
  }

  /**
   * Start monitoring the agent's USDC account
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log(`  ⚠️  Agent already monitoring for ${this.config.merchantData.merchantId}`);
      return;
    }

    console.log('');
    console.log('='.repeat(80));
    console.log(`🤖 PAYMENT PROCESSOR AGENT STARTED`);
    console.log('='.repeat(80));
    console.log(`Merchant: ${this.config.merchantData.businessName}`);
    console.log(`Merchant ID: ${this.config.merchantData.merchantId}`);
    console.log(`Agent Wallet: ${this.agentKeypair.publicKey.toString()}`);
    console.log(`Agent USDC Account: ${this.agentUSDCAccount.toString()}`);
    console.log(`Platform Fee: ${this.config.merchantData.platformFeeRate * 100}%`);
    console.log(`Affiliate Fee: ${this.config.merchantData.affiliateFeeRate * 100}%`);
    console.log('');
    console.log(`🔍 Monitoring USDC payments...`);
    console.log('='.repeat(80));
    console.log('');

    this.isMonitoring = true;

    // Subscribe to account changes via polling (WebSocket alternative)
    // In production, use WebSocket subscriptions for real-time updates
    this.startPolling();
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    console.log(`🛑 Stopping agent for ${this.config.merchantData.merchantId}`);
    this.isMonitoring = false;

    if (this.subscriptionId !== null) {
      // Clean up subscription if using WebSocket
      this.subscriptionId = null;
    }
  }

  /**
   * Poll for new transactions (simpler than WebSocket for demo)
   */
  private async startPolling(): Promise<void> {
    let lastProcessedSignature: string | null = null;

    const poll = async () => {
      if (!this.isMonitoring) return;

      try {
        // Get recent transactions for agent USDC account
        const connection = this.config.solanaUtils.getConnection();
        const signatures = await connection.getSignaturesForAddress(this.agentUSDCAccount, {
          limit: 5,
        });

        // Process new transactions
        for (const sigInfo of signatures) {
          // Skip if already processed
          if (lastProcessedSignature && sigInfo.signature === lastProcessedSignature) {
            break;
          }

          // Get transaction details
          const tx = await connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (tx) {
            await this.processTransaction(tx, sigInfo.signature, sigInfo.slot);
          }
        }

        // Update last processed signature
        if (signatures.length > 0) {
          lastProcessedSignature = signatures[0].signature;
        }
      } catch (error) {
        console.error('  ❌ Polling error:', error);
      }

      // Poll every 5 seconds
      setTimeout(poll, 5000);
    };

    poll();
  }

  /**
   * Process incoming transaction
   */
  private async processTransaction(
    tx: ParsedTransactionWithMeta,
    signature: string,
    slot: number
  ): Promise<void> {
    try {
      // Extract payment info
      const paymentInfo = this.extractPaymentInfo(tx, signature, slot);
      if (!paymentInfo) {
        return; // Not a USDC transfer to our account
      }

      // Check if this is an incoming payment (not our own outgoing split)
      if (paymentInfo.to !== this.agentUSDCAccount.toString()) {
        return;
      }

      console.log('');
      console.log('💰 INCOMING USDC PAYMENT DETECTED');
      console.log('-'.repeat(80));
      console.log(`  Amount: ${this.config.solanaUtils.usdcToHuman(paymentInfo.amount)} USDC`);
      console.log(`  From: ${paymentInfo.from}`);
      console.log(`  Memo: ${paymentInfo.memo || 'None'}`);
      console.log(`  Signature: ${paymentInfo.signature}`);
      console.log('-'.repeat(80));

      // Parse affiliate ID from memo
      const affiliateId = this.parseAffiliateMemo(paymentInfo.memo);

      // Calculate splits
      const splits = this.calculateSplits(paymentInfo.amount, affiliateId);

      // Execute split
      await this.executeSplit(splits, paymentInfo, affiliateId);

      console.log('  ✅ Payment processed successfully!');
      console.log('');
    } catch (error) {
      console.error('  ❌ Error processing transaction:', error);
    }
  }

  /**
   * Extract payment info from transaction
   */
  private extractPaymentInfo(
    tx: ParsedTransactionWithMeta,
    signature: string,
    slot: number
  ): PaymentInfo | null {
    if (!tx.meta || tx.meta.err) {
      return null; // Failed transaction
    }

    // Look for SPL token transfer instruction
    for (const instruction of tx.transaction.message.instructions) {
      const parsed = (instruction as any).parsed;

      if (parsed && parsed.type === 'transfer' && parsed.info) {
        const { source, destination, amount } = parsed.info;

        // Check if this is a transfer to our USDC account
        if (destination === this.agentUSDCAccount.toString()) {
          // Extract memo from transaction
          const memo = this.extractMemo(tx);

          return {
            amount: BigInt(amount),
            from: source,
            to: destination,
            memo,
            signature,
            slot,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract memo from transaction
   */
  private extractMemo(tx: ParsedTransactionWithMeta): string | null {
    // Look for memo instruction
    for (const instruction of tx.transaction.message.instructions) {
      const ix = instruction as PartiallyDecodedInstruction;

      if (ix.programId && ix.programId.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
        if (ix.data) {
          try {
            // Decode base58 memo data
            const decoded = bs58.decode(ix.data);
            return new TextDecoder().decode(decoded);
          } catch (error) {
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse affiliate ID from memo
   * Expected format: "AFF_12345" or "REF:AFF_12345"
   */
  private parseAffiliateMemo(memo: string | null): string | null {
    if (!memo) return null;

    // Look for AFF_ pattern
    const match = memo.match(/AFF_[A-Z0-9]+/i);
    return match ? match[0] : null;
  }

  /**
   * Calculate payment splits
   */
  private calculateSplits(
    totalAmount: bigint,
    affiliateId: string | null
  ): {
    platformFee: bigint;
    affiliateCommission: bigint;
    merchantAmount: bigint;
  } {
    const platformFeeRate = this.config.merchantData.platformFeeRate;
    const affiliateFeeRate = affiliateId ? this.config.merchantData.affiliateFeeRate : 0;

    const platformFee = (totalAmount * BigInt(Math.floor(platformFeeRate * 1000))) / 1000n;
    const affiliateCommission = (totalAmount * BigInt(Math.floor(affiliateFeeRate * 1000))) / 1000n;
    const merchantAmount = totalAmount - platformFee - affiliateCommission;

    console.log('');
    console.log('  💵 COMMISSION SPLIT:');
    console.log(`     Platform (${platformFeeRate * 100}%): ${this.config.solanaUtils.usdcToHuman(platformFee)} USDC`);

    if (affiliateId) {
      console.log(`     Affiliate (${affiliateFeeRate * 100}%): ${this.config.solanaUtils.usdcToHuman(affiliateCommission)} USDC`);
    } else {
      console.log(`     Affiliate: None (no affiliate ID in memo)`);
    }

    console.log(`     Merchant: ${this.config.solanaUtils.usdcToHuman(merchantAmount)} USDC`);
    console.log('');

    return { platformFee, affiliateCommission, merchantAmount };
  }

  /**
   * Execute payment split via facilitator
   */
  private async executeSplit(
    splits: { platformFee: bigint; affiliateCommission: bigint; merchantAmount: bigint },
    paymentInfo: PaymentInfo,
    affiliateId: string | null
  ): Promise<void> {
    console.log('  🔀 Executing atomic USDC split...');

    // Get affiliate USDC account if affiliate ID provided
    let affiliateUSDCAccount: string | null = null;

    if (affiliateId) {
      const affiliate = await this.config.affiliateDb.getAffiliateByReferralCode(affiliateId);

      if (affiliate) {
        // Get affiliate's USDC account
        const affiliateWallet = new PublicKey(affiliate.affiliateWallet);
        const ata = await getAssociatedTokenAddress(this.usdcMint, affiliateWallet);
        affiliateUSDCAccount = ata.toString();

        console.log(`     Affiliate found: ${affiliate.affiliateWallet}`);
      } else {
        console.log(`     ⚠️  Affiliate ID not found: ${affiliateId}`);
        // No affiliate - merchant gets their commission too
        splits.merchantAmount += splits.affiliateCommission;
        splits.affiliateCommission = 0n;
      }
    }

    // Build recipients array
    const recipients = [
      {
        publicKey: this.config.platformWallet,
        amount: splits.platformFee.toString(),
      },
      {
        publicKey: this.config.merchantData.merchantWallet,
        amount: splits.merchantAmount.toString(),
      },
    ];

    // Add affiliate if exists and has commission
    if (affiliateUSDCAccount && splits.affiliateCommission > 0n) {
      recipients.push({
        publicKey: new PublicKey(affiliateUSDCAccount).toString(),
        amount: splits.affiliateCommission.toString(),
      });
    }

    // Call facilitator settle-usdc-split endpoint
    const response = await fetch(`${this.config.facilitatorUrl}/settle-usdc-split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentPrivateKey: this.config.merchantData.agentPrivateKey,
        usdcMint: this.config.merchantData.usdcMint,
        recipients,
      }),
    });

    const result: any = await response.json();

    if (!response.ok) {
      throw new Error(`Split settlement failed: ${result.error || 'Unknown error'}`);
    }

    console.log(`     ✅ Split executed: ${result.data.signature}`);
    console.log(`     Explorer: ${result.data.explorerUrl}`);

    // Record in database
    await this.recordTransaction(paymentInfo, splits, affiliateId, result.data.signature);

    // Update affiliate earnings if applicable
    if (affiliateId && splits.affiliateCommission > 0n) {
      await this.config.affiliateDb.updateAffiliateEarnings(
        affiliateId,
        splits.affiliateCommission.toString()
      );
    }
  }

  /**
   * Record transaction in database
   */
  private async recordTransaction(
    paymentInfo: PaymentInfo,
    splits: { platformFee: bigint; affiliateCommission: bigint; merchantAmount: bigint },
    affiliateId: string | null,
    settlementSignature: string
  ): Promise<void> {
    await this.config.affiliateDb.storePaymentSplit({
      txSignature: settlementSignature,
      merchantId: this.config.merchantData.merchantId,
      affiliateId: affiliateId,
      buyerWallet: paymentInfo.from,
      totalAmount: paymentInfo.amount.toString(),
      platformFee: splits.platformFee.toString(),
      affiliateCommission: splits.affiliateCommission.toString(),
      merchantAmount: splits.merchantAmount.toString(),
      status: 'completed',
    });

    console.log('     ✅ Transaction recorded in database');
  }

  /**
   * Get agent status
   */
  getStatus(): {
    merchantId: string;
    businessName: string;
    agentWallet: string;
    isMonitoring: boolean;
  } {
    return {
      merchantId: this.config.merchantData.merchantId,
      businessName: this.config.merchantData.businessName,
      agentWallet: this.agentKeypair.publicKey.toString(),
      isMonitoring: this.isMonitoring,
    };
  }
}
