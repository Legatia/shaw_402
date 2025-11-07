/**
 * Affiliate Database Manager
 * Handles merchants, affiliates, and payment splitting transactions
 */

import sqlite3 from 'sqlite3';
import { DatabaseError } from '../errors/index.js';

export interface MerchantData {
  merchantId: string;
  businessName: string;
  merchantWallet: string;
  agentWallet: string;
  agentPrivateKey: string; // Encrypted in production
  platformFeeRate: number;
  affiliateFeeRate: number;
  registrationTxSignature: string;
  status: 'active' | 'suspended' | 'inactive';
  // USDC Settlement fields
  settlementToken: 'USDC'; // Settlement currency
  usdcMint: string; // USDC mint address (devnet/mainnet)
  agentUSDCAccount: string; // Agent's USDC token account
  merchantUSDCAccount: string; // Merchant's USDC token account
}

export interface AffiliateData {
  affiliateId: string;
  merchantId: string;
  affiliateWallet: string;
  referralCode: string;
  totalReferrals: number;
  totalEarned: string; // bigint as string
  status: 'active' | 'suspended';
}

export interface PaymentSplitData {
  txSignature: string;
  merchantId: string;
  affiliateId: string | null;
  buyerWallet: string;
  totalAmount: string; // bigint as string
  platformFee: string;
  affiliateCommission: string;
  merchantAmount: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp?: number;
  errorMessage?: string;
}

export class AffiliateDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening affiliate database:', err);
          reject(new DatabaseError(`Failed to open database: ${err.message}`));
          return;
        }

        this.createTables()
          .then(() => {
            console.log('Affiliate database initialized successfully');
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create necessary tables
   */
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const createMerchantsTable = `
        CREATE TABLE IF NOT EXISTS merchants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          merchant_id TEXT UNIQUE NOT NULL,
          business_name TEXT NOT NULL,
          merchant_wallet TEXT NOT NULL,
          agent_wallet TEXT UNIQUE NOT NULL,
          agent_private_key TEXT NOT NULL,
          platform_fee_rate REAL DEFAULT 0.05,
          affiliate_fee_rate REAL DEFAULT 0.15,
          registration_tx_signature TEXT,
          status TEXT DEFAULT 'active',
          settlement_token TEXT DEFAULT 'USDC',
          usdc_mint TEXT NOT NULL,
          agent_usdc_account TEXT NOT NULL,
          merchant_usdc_account TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createAffiliatesTable = `
        CREATE TABLE IF NOT EXISTS affiliates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          affiliate_id TEXT UNIQUE NOT NULL,
          merchant_id TEXT NOT NULL,
          affiliate_wallet TEXT NOT NULL,
          referral_code TEXT UNIQUE NOT NULL,
          total_referrals INTEGER DEFAULT 0,
          total_earned TEXT DEFAULT '0',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id)
        )
      `;

      const createPaymentSplitsTable = `
        CREATE TABLE IF NOT EXISTS payment_splits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tx_signature TEXT UNIQUE NOT NULL,
          merchant_id TEXT NOT NULL,
          affiliate_id TEXT,
          buyer_wallet TEXT NOT NULL,
          total_amount TEXT NOT NULL,
          platform_fee TEXT NOT NULL,
          affiliate_commission TEXT NOT NULL,
          merchant_amount TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id),
          FOREIGN KEY (affiliate_id) REFERENCES affiliates (affiliate_id)
        )
      `;

      this.db!.serialize(() => {
        this.db!.run(createMerchantsTable, (err) => {
          if (err) {
            reject(new DatabaseError(`Failed to create merchants table: ${err.message}`));
            return;
          }
          console.log('Created merchants table');
        });

        this.db!.run(createAffiliatesTable, (err) => {
          if (err) {
            reject(new DatabaseError(`Failed to create affiliates table: ${err.message}`));
            return;
          }
          console.log('Created affiliates table');
        });

        this.db!.run(createPaymentSplitsTable, (err) => {
          if (err) {
            reject(new DatabaseError(`Failed to create payment_splits table: ${err.message}`));
            return;
          }
          console.log('Created payment_splits table');
          resolve();
        });
      });
    });
  }

  /**
   * Store a new merchant
   */
  async storeMerchant(merchantData: MerchantData): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO merchants (
          merchant_id, business_name, merchant_wallet, agent_wallet,
          agent_private_key, platform_fee_rate, affiliate_fee_rate,
          registration_tx_signature, status, settlement_token,
          usdc_mint, agent_usdc_account, merchant_usdc_account
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db!.run(
        sql,
        [
          merchantData.merchantId,
          merchantData.businessName,
          merchantData.merchantWallet,
          merchantData.agentWallet,
          merchantData.agentPrivateKey,
          merchantData.platformFeeRate,
          merchantData.affiliateFeeRate,
          merchantData.registrationTxSignature,
          merchantData.status,
          merchantData.settlementToken,
          merchantData.usdcMint,
          merchantData.agentUSDCAccount,
          merchantData.merchantUSDCAccount,
        ],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new DatabaseError('Merchant ID or agent wallet already exists'));
            } else {
              reject(new DatabaseError(`Failed to store merchant: ${err.message}`));
            }
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Get merchant by ID
   */
  async getMerchant(merchantId: string): Promise<MerchantData | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM merchants WHERE merchant_id = ?`;

      this.db!.get(sql, [merchantId], (err, row: any) => {
        if (err) {
          reject(new DatabaseError(`Failed to get merchant: ${err.message}`));
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          merchantId: row.merchant_id,
          businessName: row.business_name,
          merchantWallet: row.merchant_wallet,
          agentWallet: row.agent_wallet,
          agentPrivateKey: row.agent_private_key,
          platformFeeRate: row.platform_fee_rate,
          affiliateFeeRate: row.affiliate_fee_rate,
          registrationTxSignature: row.registration_tx_signature,
          status: row.status,
          settlementToken: row.settlement_token || 'USDC',
          usdcMint: row.usdc_mint,
          agentUSDCAccount: row.agent_usdc_account,
          merchantUSDCAccount: row.merchant_usdc_account,
        });
      });
    });
  }

  /**
   * Get merchant by agent wallet
   */
  async getMerchantByAgentWallet(agentWallet: string): Promise<MerchantData | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM merchants WHERE agent_wallet = ?`;

      this.db!.get(sql, [agentWallet], (err, row: any) => {
        if (err) {
          reject(new DatabaseError(`Failed to get merchant: ${err.message}`));
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          merchantId: row.merchant_id,
          businessName: row.business_name,
          merchantWallet: row.merchant_wallet,
          agentWallet: row.agent_wallet,
          agentPrivateKey: row.agent_private_key,
          platformFeeRate: row.platform_fee_rate,
          affiliateFeeRate: row.affiliate_fee_rate,
          registrationTxSignature: row.registration_tx_signature,
          status: row.status,
          settlementToken: row.settlement_token || 'USDC',
          usdcMint: row.usdc_mint,
          agentUSDCAccount: row.agent_usdc_account,
          merchantUSDCAccount: row.merchant_usdc_account,
        });
      });
    });
  }

  /**
   * Store a new affiliate
   */
  async storeAffiliate(affiliateData: AffiliateData): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO affiliates (
          affiliate_id, merchant_id, affiliate_wallet, referral_code,
          total_referrals, total_earned, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db!.run(
        sql,
        [
          affiliateData.affiliateId,
          affiliateData.merchantId,
          affiliateData.affiliateWallet,
          affiliateData.referralCode,
          affiliateData.totalReferrals,
          affiliateData.totalEarned,
          affiliateData.status,
        ],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new DatabaseError('Affiliate ID or referral code already exists'));
            } else {
              reject(new DatabaseError(`Failed to store affiliate: ${err.message}`));
            }
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Get affiliate by referral code
   */
  async getAffiliateByReferralCode(referralCode: string): Promise<AffiliateData | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM affiliates WHERE referral_code = ?`;

      this.db!.get(sql, [referralCode], (err, row: any) => {
        if (err) {
          reject(new DatabaseError(`Failed to get affiliate: ${err.message}`));
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          affiliateId: row.affiliate_id,
          merchantId: row.merchant_id,
          affiliateWallet: row.affiliate_wallet,
          referralCode: row.referral_code,
          totalReferrals: row.total_referrals,
          totalEarned: row.total_earned,
          status: row.status,
        });
      });
    });
  }

  /**
   * Get all affiliates for a merchant
   */
  async getAffiliatesByMerchant(merchantId: string): Promise<AffiliateData[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM affiliates WHERE merchant_id = ? ORDER BY created_at DESC`;

      this.db!.all(sql, [merchantId], (err, rows: any[]) => {
        if (err) {
          reject(new DatabaseError(`Failed to get affiliates: ${err.message}`));
          return;
        }

        const affiliates = rows.map((row) => ({
          affiliateId: row.affiliate_id,
          merchantId: row.merchant_id,
          affiliateWallet: row.affiliate_wallet,
          referralCode: row.referral_code,
          totalReferrals: row.total_referrals,
          totalEarned: row.total_earned,
          status: row.status,
        }));

        resolve(affiliates);
      });
    });
  }

  /**
   * Store payment split transaction
   */
  async storePaymentSplit(splitData: PaymentSplitData): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO payment_splits (
          tx_signature, merchant_id, affiliate_id, buyer_wallet,
          total_amount, platform_fee, affiliate_commission,
          merchant_amount, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db!.run(
        sql,
        [
          splitData.txSignature,
          splitData.merchantId,
          splitData.affiliateId,
          splitData.buyerWallet,
          splitData.totalAmount,
          splitData.platformFee,
          splitData.affiliateCommission,
          splitData.merchantAmount,
          splitData.status,
          splitData.errorMessage || null,
        ],
        function (err) {
          if (err) {
            reject(new DatabaseError(`Failed to store payment split: ${err.message}`));
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Update payment split status
   */
  async updatePaymentSplitStatus(
    txSignature: string,
    status: 'pending' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE payment_splits
        SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
        WHERE tx_signature = ?
      `;

      this.db!.run(sql, [status, errorMessage || null, txSignature], function (err) {
        if (err) {
          reject(new DatabaseError(`Failed to update payment split: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Update affiliate earnings
   */
  async updateAffiliateEarnings(affiliateId: string, additionalEarnings: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE affiliates
        SET total_referrals = total_referrals + 1,
            total_earned = CAST((CAST(total_earned AS INTEGER) + CAST(? AS INTEGER)) AS TEXT)
        WHERE affiliate_id = ?
      `;

      this.db!.run(sql, [additionalEarnings, affiliateId], function (err) {
        if (err) {
          reject(new DatabaseError(`Failed to update affiliate earnings: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get merchant stats
   */
  async getMerchantStats(merchantId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(DISTINCT affiliate_id) as total_affiliates,
          COUNT(*) as total_transactions,
          SUM(CAST(total_amount AS INTEGER)) as total_volume,
          SUM(CAST(platform_fee AS INTEGER)) as total_platform_fees,
          SUM(CAST(merchant_amount AS INTEGER)) as total_merchant_earnings
        FROM payment_splits
        WHERE merchant_id = ? AND status = 'completed'
      `;

      this.db!.get(sql, [merchantId], (err, row: any) => {
        if (err) {
          reject(new DatabaseError(`Failed to get merchant stats: ${err.message}`));
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(new DatabaseError(`Failed to close database: ${err.message}`));
          } else {
            console.log('Affiliate database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
