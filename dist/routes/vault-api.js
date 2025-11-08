/**
 * Vault API Routes
 * Endpoints for merchant deposits, withdrawals, and staking
 */
import { Router } from 'express';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
import { generateDepositId } from '../lib/vault-manager.js';
const router = Router();
let config;
/**
 * Initialize vault API routes
 */
export function initializeVaultAPI(cfg) {
    config = cfg;
}
/**
 * GET /api/vault/info
 * Get vault information and minimum deposit requirements
 */
router.get('/info', async (_req, res) => {
    try {
        const vaultAddress = config.vaultManager.getVaultAddress();
        const minimumDeposits = config.vaultManager.getMinimumDeposits();
        const tvl = await config.vaultManager.getTVL();
        res.json(successResponse({
            vaultAddress,
            minimumDeposits: {
                SOL: {
                    amount: minimumDeposits.SOL,
                    humanReadable: `${Number(minimumDeposits.SOL) / 1e9} SOL`,
                },
                USDC: {
                    amount: minimumDeposits.USDC,
                    humanReadable: `${Number(minimumDeposits.USDC) / 1e6} USDC`,
                },
            },
            tvl: {
                SOL: {
                    amount: tvl.SOL,
                    humanReadable: `${Number(tvl.SOL) / 1e9} SOL`,
                },
                USDC: {
                    amount: tvl.USDC,
                    humanReadable: `${Number(tvl.USDC) / 1e6} USDC`,
                },
                totalUSD: tvl.totalUSD,
            },
        }));
    }
    catch (error) {
        console.error('Error getting vault info:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to get vault info', 'VAULT_INFO_ERROR', 500));
    }
});
/**
 * POST /api/vault/verify-deposit
 * Verify a merchant's deposit transaction
 */
router.post('/verify-deposit', async (req, res) => {
    try {
        const { merchantId, txSignature, amount, token } = req.body;
        if (!merchantId || !txSignature || !amount || !token) {
            res.status(400).json(errorResponse('Missing required fields: merchantId, txSignature, amount, token', 'MISSING_FIELDS', 400));
            return;
        }
        console.log('');
        console.log('═══════════════════════════════════════════════');
        console.log('🔐 VERIFYING MERCHANT DEPOSIT');
        console.log('═══════════════════════════════════════════════');
        console.log(`Merchant ID: ${merchantId}`);
        console.log(`Transaction: ${txSignature}`);
        console.log(`Amount: ${amount} ${token}`);
        console.log('');
        // Get merchant data
        const merchant = await config.affiliateDb.getMerchant(merchantId);
        if (!merchant) {
            res.status(404).json(errorResponse('Merchant not found', 'MERCHANT_NOT_FOUND', 404));
            return;
        }
        // Validate amount meets minimum
        const depositAmount = BigInt(amount);
        const depositToken = token;
        if (!config.vaultManager.validateDepositAmount(depositAmount, depositToken)) {
            const minimums = config.vaultManager.getMinimumDeposits();
            res.status(400).json(errorResponse(`Deposit amount below minimum requirement of ${minimums[depositToken]} ${token}`, 'INSUFFICIENT_DEPOSIT', 400));
            return;
        }
        // Verify deposit transaction on blockchain
        const verified = await config.vaultManager.verifyDeposit(txSignature, depositAmount, merchant.merchantWallet, token);
        if (!verified) {
            res.status(400).json(errorResponse('Deposit verification failed', 'VERIFICATION_FAILED', 400));
            return;
        }
        // Store deposit record
        const depositId = generateDepositId();
        const vaultAddress = config.vaultManager.getVaultAddress();
        await config.affiliateDb.storeMerchantDeposit({
            depositId,
            merchantId,
            depositAmount: amount,
            depositToken: token,
            depositTxSignature: txSignature,
            vaultAddress,
            status: 'active',
            depositedAt: Date.now(),
            accruedRewards: '0',
        });
        console.log('✅ Deposit verified and recorded');
        console.log(`Deposit ID: ${depositId}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        res.json(successResponse({
            depositId,
            merchantId,
            verified: true,
            amount,
            token,
            txSignature,
            vaultAddress,
            status: 'active',
        }));
    }
    catch (error) {
        console.error('Error verifying deposit:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to verify deposit', 'DEPOSIT_VERIFICATION_ERROR', 500));
    }
});
/**
 * POST /api/vault/withdraw
 * Request withdrawal of merchant deposit
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { merchantId, depositId } = req.body;
        if (!merchantId || !depositId) {
            res.status(400).json(errorResponse('Missing required fields: merchantId, depositId', 'MISSING_FIELDS', 400));
            return;
        }
        console.log('');
        console.log('═══════════════════════════════════════════════');
        console.log('💰 PROCESSING DEPOSIT WITHDRAWAL');
        console.log('═══════════════════════════════════════════════');
        console.log(`Merchant ID: ${merchantId}`);
        console.log(`Deposit ID: ${depositId}`);
        console.log('');
        // Get deposit record
        const deposit = await config.affiliateDb.getMerchantDeposit(depositId);
        if (!deposit) {
            res.status(404).json(errorResponse('Deposit not found', 'DEPOSIT_NOT_FOUND', 404));
            return;
        }
        // Verify deposit belongs to merchant
        if (deposit.merchantId !== merchantId) {
            res.status(403).json(errorResponse('Deposit does not belong to this merchant', 'UNAUTHORIZED', 403));
            return;
        }
        // Check deposit is active
        if (deposit.status !== 'active') {
            res.status(400).json(errorResponse(`Deposit is not active (status: ${deposit.status})`, 'INVALID_STATUS', 400));
            return;
        }
        // Get merchant wallet
        const merchant = await config.affiliateDb.getMerchant(merchantId);
        if (!merchant) {
            res.status(404).json(errorResponse('Merchant not found', 'MERCHANT_NOT_FOUND', 404));
            return;
        }
        // Calculate total amount (deposit + rewards)
        const depositAmount = BigInt(deposit.depositAmount);
        const rewardsAmount = BigInt(deposit.accruedRewards);
        const totalAmount = depositAmount + rewardsAmount;
        // Execute withdrawal
        const result = await config.vaultManager.returnDeposit(merchant.merchantWallet, totalAmount, deposit.depositToken);
        if (!result.success) {
            res.status(500).json(errorResponse(result.error || 'Withdrawal failed', 'WITHDRAWAL_FAILED', 500));
            return;
        }
        // Update deposit status
        await config.affiliateDb.updateMerchantDepositStatus(depositId, 'withdrawn', Date.now(), result.txSignature);
        console.log('✅ Withdrawal completed successfully');
        console.log(`Amount: ${totalAmount} ${deposit.depositToken}`);
        console.log(`Transaction: ${result.txSignature}`);
        console.log('═══════════════════════════════════════════════');
        console.log('');
        res.json(successResponse({
            depositId,
            merchantId,
            withdrawn: true,
            amount: totalAmount.toString(),
            deposit: deposit.depositAmount,
            rewards: deposit.accruedRewards,
            token: deposit.depositToken,
            txSignature: result.txSignature,
        }));
    }
    catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to process withdrawal', 'WITHDRAWAL_ERROR', 500));
    }
});
/**
 * GET /api/vault/deposit/:depositId
 * Get deposit information including accrued rewards
 */
router.get('/deposit/:depositId', async (req, res) => {
    try {
        const { depositId } = req.params;
        const deposit = await config.affiliateDb.getMerchantDeposit(depositId);
        if (!deposit) {
            res.status(404).json(errorResponse('Deposit not found', 'DEPOSIT_NOT_FOUND', 404));
            return;
        }
        // Calculate current rewards (if applicable)
        if (deposit.status === 'active' && deposit.depositToken === 'SOL') {
            const depositedAt = deposit.depositedAt;
            const now = Date.now();
            const daysPassed = (now - depositedAt) / (1000 * 60 * 60 * 24);
            const calculatedRewards = config.vaultManager.calculateRewards(BigInt(deposit.depositAmount), Math.floor(daysPassed));
            // Update accrued rewards in database
            if (calculatedRewards > BigInt(deposit.accruedRewards)) {
                await config.affiliateDb.updateMerchantDepositRewards(depositId, calculatedRewards.toString());
                deposit.accruedRewards = calculatedRewards.toString();
            }
        }
        res.json(successResponse({
            depositId: deposit.depositId,
            merchantId: deposit.merchantId,
            amount: deposit.depositAmount,
            token: deposit.depositToken,
            status: deposit.status,
            vaultAddress: deposit.vaultAddress,
            depositTxSignature: deposit.depositTxSignature,
            depositedAt: deposit.depositedAt,
            withdrawnAt: deposit.withdrawnAt,
            withdrawTxSignature: deposit.withdrawTxSignature,
            accruedRewards: deposit.accruedRewards,
            totalValue: (BigInt(deposit.depositAmount) + BigInt(deposit.accruedRewards)).toString(),
        }));
    }
    catch (error) {
        console.error('Error getting deposit info:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to get deposit info', 'DEPOSIT_INFO_ERROR', 500));
    }
});
/**
 * GET /api/vault/merchant/:merchantId/deposits
 * Get all deposits for a merchant
 */
router.get('/merchant/:merchantId/deposits', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const deposits = await config.affiliateDb.getMerchantDeposits(merchantId);
        res.json(successResponse({
            merchantId,
            deposits: deposits.map((d) => ({
                depositId: d.depositId,
                amount: d.depositAmount,
                token: d.depositToken,
                status: d.status,
                depositedAt: d.depositedAt,
                accruedRewards: d.accruedRewards,
                totalValue: (BigInt(d.depositAmount) + BigInt(d.accruedRewards)).toString(),
            })),
            totalDeposits: deposits.length,
        }));
    }
    catch (error) {
        console.error('Error getting merchant deposits:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Failed to get merchant deposits', 'MERCHANT_DEPOSITS_ERROR', 500));
    }
});
export default router;
//# sourceMappingURL=vault-api.js.map