/**
 * Affiliate Database Manager
 * Handles merchants, affiliates, and payment splitting transactions
 */
import sqlite3 from 'sqlite3';
import { DatabaseError } from '../errors/index.js';
export class AffiliateDatabase {
    db = null;
    dbPath;
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    /**
     * Initialize the database and create tables
     */
    async initialize() {
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
    async createTables() {
        return new Promise((resolve, reject) => {
            const createMerchantsTable = `
        CREATE TABLE IF NOT EXISTS merchants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          merchant_id TEXT UNIQUE NOT NULL,
          business_name TEXT NOT NULL,
          merchant_wallet TEXT NOT NULL,
          agent_wallet TEXT UNIQUE NOT NULL,
          agent_private_key TEXT,
          platform_fee_rate REAL DEFAULT 0.05,
          affiliate_fee_rate REAL DEFAULT 0.15,
          registration_tx_signature TEXT,
          status TEXT DEFAULT 'active',
          settlement_token TEXT DEFAULT 'USDC',
          usdc_mint TEXT NOT NULL,
          agent_usdc_account TEXT NOT NULL,
          merchant_usdc_account TEXT NOT NULL,
          deposit_amount TEXT DEFAULT '1000000000',
          cancelled_at DATETIME,
          refund_tx_signature TEXT,
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
            const createMerchantDepositsTable = `
        CREATE TABLE IF NOT EXISTS merchant_deposits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deposit_id TEXT UNIQUE NOT NULL,
          merchant_id TEXT NOT NULL,
          deposit_amount TEXT NOT NULL,
          deposit_token TEXT DEFAULT 'USDC',
          deposit_tx_signature TEXT UNIQUE NOT NULL,
          vault_address TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          deposited_at INTEGER NOT NULL,
          withdrawn_at INTEGER,
          withdraw_tx_signature TEXT,
          accrued_rewards TEXT DEFAULT '0',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id)
        )
      `;
            const createStakingRecordsTable = `
        CREATE TABLE IF NOT EXISTS staking_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stake_id TEXT UNIQUE NOT NULL,
          merchant_id TEXT NOT NULL,
          deposit_id TEXT NOT NULL,
          staked_amount TEXT NOT NULL,
          staking_protocol TEXT DEFAULT 'none',
          stake_account TEXT,
          rewards_earned TEXT DEFAULT '0',
          last_reward_claim INTEGER NOT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id),
          FOREIGN KEY (deposit_id) REFERENCES merchant_deposits (deposit_id)
        )
      `;
            this.db.serialize(() => {
                this.db.run(createMerchantsTable, (err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to create merchants table: ${err.message}`));
                        return;
                    }
                    console.log('Created merchants table');
                });
                this.db.run(createAffiliatesTable, (err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to create affiliates table: ${err.message}`));
                        return;
                    }
                    console.log('Created affiliates table');
                });
                this.db.run(createPaymentSplitsTable, (err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to create payment_splits table: ${err.message}`));
                        return;
                    }
                    console.log('Created payment_splits table');
                });
                this.db.run(createMerchantDepositsTable, (err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to create merchant_deposits table: ${err.message}`));
                        return;
                    }
                    console.log('Created merchant_deposits table');
                });
                this.db.run(createStakingRecordsTable, (err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to create staking_records table: ${err.message}`));
                        return;
                    }
                    console.log('Created staking_records table');
                    resolve();
                });
            });
        });
    }
    /**
     * Store a new merchant
     */
    async storeMerchant(merchantData) {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO merchants (
          merchant_id, business_name, merchant_wallet, agent_wallet,
          agent_private_key, platform_fee_rate, affiliate_fee_rate,
          registration_tx_signature, status, settlement_token,
          usdc_mint, agent_usdc_account, merchant_usdc_account, deposit_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            this.db.run(sql, [
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
                merchantData.depositAmount || '1000000000',
            ], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        reject(new DatabaseError('Merchant ID or agent wallet already exists'));
                    }
                    else {
                        reject(new DatabaseError(`Failed to store merchant: ${err.message}`));
                    }
                    return;
                }
                resolve(this.lastID);
            });
        });
    }
    /**
     * Get merchant by ID
     */
    async getMerchant(merchantId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM merchants WHERE merchant_id = ?`;
            this.db.get(sql, [merchantId], (err, row) => {
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
                    depositAmount: row.deposit_amount,
                    cancelledAt: row.cancelled_at,
                    refundTxSignature: row.refund_tx_signature,
                });
            });
        });
    }
    /**
     * Get merchant by agent wallet
     */
    async getMerchantByAgentWallet(agentWallet) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM merchants WHERE agent_wallet = ?`;
            this.db.get(sql, [agentWallet], (err, row) => {
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
                    depositAmount: row.deposit_amount,
                    cancelledAt: row.cancelled_at,
                    refundTxSignature: row.refund_tx_signature,
                });
            });
        });
    }
    /**
     * Cancel merchant and process refund
     */
    async cancelMerchant(merchantId, refundTxSignature) {
        const db = this.db;
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE merchants
        SET status = 'cancelled',
            cancelled_at = datetime('now'),
            refund_tx_signature = ?,
            agent_private_key = NULL
        WHERE merchant_id = ? AND status = 'active'
      `;
            db.run(sql, [refundTxSignature, merchantId], function (err) {
                if (err) {
                    reject(new DatabaseError(`Failed to cancel merchant: ${err.message}`));
                    return;
                }
                if (this.changes === 0) {
                    reject(new DatabaseError('Merchant not found or already cancelled'));
                    return;
                }
                // Deactivate all affiliates for this merchant
                const deactivateSql = `
          UPDATE affiliates
          SET status = 'inactive'
          WHERE merchant_id = ?
        `;
                db.run(deactivateSql, [merchantId], (deactivateErr) => {
                    if (deactivateErr) {
                        console.error(`Warning: Failed to deactivate affiliates: ${deactivateErr.message}`);
                        // Don't reject - merchant is already cancelled
                    }
                    resolve();
                });
            });
        });
    }
    /**
     * Store a new affiliate
     */
    async storeAffiliate(affiliateData) {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO affiliates (
          affiliate_id, merchant_id, affiliate_wallet, referral_code,
          total_referrals, total_earned, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
            this.db.run(sql, [
                affiliateData.affiliateId,
                affiliateData.merchantId,
                affiliateData.affiliateWallet,
                affiliateData.referralCode,
                affiliateData.totalReferrals,
                affiliateData.totalEarned,
                affiliateData.status,
            ], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        reject(new DatabaseError('Affiliate ID or referral code already exists'));
                    }
                    else {
                        reject(new DatabaseError(`Failed to store affiliate: ${err.message}`));
                    }
                    return;
                }
                resolve(this.lastID);
            });
        });
    }
    /**
     * Get affiliate by referral code
     */
    async getAffiliateByReferralCode(referralCode) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM affiliates WHERE referral_code = ?`;
            this.db.get(sql, [referralCode], (err, row) => {
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
    async getAffiliatesByMerchant(merchantId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM affiliates WHERE merchant_id = ? ORDER BY created_at DESC`;
            this.db.all(sql, [merchantId], (err, rows) => {
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
    async storePaymentSplit(splitData) {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO payment_splits (
          tx_signature, merchant_id, affiliate_id, buyer_wallet,
          total_amount, platform_fee, affiliate_commission,
          merchant_amount, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            this.db.run(sql, [
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
            ], function (err) {
                if (err) {
                    reject(new DatabaseError(`Failed to store payment split: ${err.message}`));
                    return;
                }
                resolve(this.lastID);
            });
        });
    }
    /**
     * Update payment split status
     */
    async updatePaymentSplitStatus(txSignature, status, errorMessage) {
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE payment_splits
        SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
        WHERE tx_signature = ?
      `;
            this.db.run(sql, [status, errorMessage || null, txSignature], function (err) {
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
    async updateAffiliateEarnings(affiliateId, additionalEarnings) {
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE affiliates
        SET total_referrals = total_referrals + 1,
            total_earned = CAST((CAST(total_earned AS INTEGER) + CAST(? AS INTEGER)) AS TEXT)
        WHERE affiliate_id = ?
      `;
            this.db.run(sql, [additionalEarnings, affiliateId], function (err) {
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
    async getMerchantStats(merchantId) {
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
            this.db.get(sql, [merchantId], (err, row) => {
                if (err) {
                    reject(new DatabaseError(`Failed to get merchant stats: ${err.message}`));
                    return;
                }
                resolve(row);
            });
        });
    }
    /**
     * Store merchant deposit record
     */
    async storeMerchantDeposit(depositData) {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO merchant_deposits (
          deposit_id, merchant_id, deposit_amount, deposit_token,
          deposit_tx_signature, vault_address, status, deposited_at, accrued_rewards
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            this.db.run(sql, [
                depositData.depositId,
                depositData.merchantId,
                depositData.depositAmount,
                depositData.depositToken,
                depositData.depositTxSignature,
                depositData.vaultAddress,
                depositData.status,
                depositData.depositedAt,
                depositData.accruedRewards,
            ], function (err) {
                if (err) {
                    reject(new DatabaseError(`Failed to store merchant deposit: ${err.message}`));
                    return;
                }
                resolve(this.lastID);
            });
        });
    }
    /**
     * Get merchant deposit by ID
     */
    async getMerchantDeposit(depositId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM merchant_deposits WHERE deposit_id = ?`;
            this.db.get(sql, [depositId], (err, row) => {
                if (err) {
                    reject(new DatabaseError(`Failed to get merchant deposit: ${err.message}`));
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                resolve({
                    depositId: row.deposit_id,
                    merchantId: row.merchant_id,
                    depositAmount: row.deposit_amount,
                    depositToken: row.deposit_token,
                    depositTxSignature: row.deposit_tx_signature,
                    vaultAddress: row.vault_address,
                    status: row.status,
                    depositedAt: row.deposited_at,
                    withdrawnAt: row.withdrawn_at,
                    withdrawTxSignature: row.withdraw_tx_signature,
                    accruedRewards: row.accrued_rewards,
                });
            });
        });
    }
    /**
     * Get all deposits for a merchant
     */
    async getMerchantDeposits(merchantId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM merchant_deposits WHERE merchant_id = ? ORDER BY deposited_at DESC`;
            this.db.all(sql, [merchantId], (err, rows) => {
                if (err) {
                    reject(new DatabaseError(`Failed to get merchant deposits: ${err.message}`));
                    return;
                }
                const deposits = rows.map((row) => ({
                    depositId: row.deposit_id,
                    merchantId: row.merchant_id,
                    depositAmount: row.deposit_amount,
                    depositToken: row.deposit_token,
                    depositTxSignature: row.deposit_tx_signature,
                    vaultAddress: row.vault_address,
                    status: row.status,
                    depositedAt: row.deposited_at,
                    withdrawnAt: row.withdrawn_at,
                    withdrawTxSignature: row.withdraw_tx_signature,
                    accruedRewards: row.accrued_rewards,
                }));
                resolve(deposits);
            });
        });
    }
    /**
     * Update merchant deposit status
     */
    async updateMerchantDepositStatus(depositId, status, withdrawnAt, withdrawTxSignature) {
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE merchant_deposits
        SET status = ?, withdrawn_at = ?, withdraw_tx_signature = ?
        WHERE deposit_id = ?
      `;
            this.db.run(sql, [status, withdrawnAt, withdrawTxSignature, depositId], (err) => {
                if (err) {
                    reject(new DatabaseError(`Failed to update deposit status: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Update merchant deposit rewards
     */
    async updateMerchantDepositRewards(depositId, accruedRewards) {
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE merchant_deposits
        SET accrued_rewards = ?
        WHERE deposit_id = ?
      `;
            this.db.run(sql, [accruedRewards, depositId], (err) => {
                if (err) {
                    reject(new DatabaseError(`Failed to update deposit rewards: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Store staking record
     */
    async storeStakingRecord(stakingData) {
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO staking_records (
          stake_id, merchant_id, deposit_id, staked_amount,
          staking_protocol, stake_account, rewards_earned,
          last_reward_claim, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            this.db.run(sql, [
                stakingData.stakeId,
                stakingData.merchantId,
                stakingData.depositId,
                stakingData.stakedAmount,
                stakingData.stakingProtocol,
                stakingData.stakeAccount,
                stakingData.rewardsEarned,
                stakingData.lastRewardClaim,
                stakingData.status,
            ], function (err) {
                if (err) {
                    reject(new DatabaseError(`Failed to store staking record: ${err.message}`));
                    return;
                }
                resolve(this.lastID);
            });
        });
    }
    /**
     * Get staking record by deposit ID
     */
    async getStakingRecordByDeposit(depositId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM staking_records WHERE deposit_id = ? AND status = 'active'`;
            this.db.get(sql, [depositId], (err, row) => {
                if (err) {
                    reject(new DatabaseError(`Failed to get staking record: ${err.message}`));
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                resolve({
                    stakeId: row.stake_id,
                    merchantId: row.merchant_id,
                    depositId: row.deposit_id,
                    stakedAmount: row.staked_amount,
                    stakingProtocol: row.staking_protocol,
                    stakeAccount: row.stake_account,
                    rewardsEarned: row.rewards_earned,
                    lastRewardClaim: row.last_reward_claim,
                    status: row.status,
                });
            });
        });
    }
    /**
     * Close the database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(new DatabaseError(`Failed to close database: ${err.message}`));
                    }
                    else {
                        console.log('Affiliate database connection closed');
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
}
//# sourceMappingURL=affiliate-database.js.map