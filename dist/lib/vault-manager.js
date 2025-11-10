/**
 * Vault Manager
 * Handles merchant deposits, staking, and reward distribution
 */
import { PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, } from '@solana/spl-token';
export class VaultManager {
    config;
    connection;
    constructor(config) {
        this.config = config;
        this.connection = config.solanaUtils['connection']; // Access underlying connection
    }
    /**
     * Get vault public key
     */
    getVaultAddress() {
        return this.config.vaultKeypair.publicKey.toString();
    }
    /**
     * Get vault USDC token account
     */
    async getVaultUSDCAccount() {
        return await getAssociatedTokenAddress(this.config.usdcMint, this.config.vaultKeypair.publicKey);
    }
    /**
     * Get vault SOL balance
     */
    async getVaultSOLBalance() {
        return await this.config.solanaUtils.getSOLBalance(this.getVaultAddress());
    }
    /**
     * Get vault USDC balance
     */
    async getVaultUSDCBalance() {
        try {
            const vaultUSDCAccount = await this.getVaultUSDCAccount();
            const accountInfo = await getAccount(this.connection, vaultUSDCAccount);
            return accountInfo.amount;
        }
        catch (error) {
            console.error('Error getting vault USDC balance:', error);
            return BigInt(0);
        }
    }
    /**
     * Verify merchant deposit transaction
     * Checks that the transaction sent the correct amount to vault
     */
    async verifyDeposit(txSignature, expectedAmount, merchantWallet, token) {
        try {
            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log('🔍 VERIFYING MERCHANT DEPOSIT');
            console.log('═══════════════════════════════════════════════');
            console.log(`Transaction: ${txSignature}`);
            console.log(`Merchant: ${merchantWallet}`);
            console.log(`Expected Amount: ${expectedAmount} ${token}`);
            console.log('');
            // Fetch transaction from blockchain
            const tx = await this.connection.getParsedTransaction(txSignature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });
            if (!tx || !tx.meta) {
                console.log('❌ Transaction not found or not confirmed');
                return false;
            }
            // Verify transaction succeeded
            if (tx.meta.err) {
                console.log('❌ Transaction failed on-chain');
                return false;
            }
            const vaultAddress = this.getVaultAddress();
            if (token === 'SOL') {
                // Verify SOL transfer
                const instructions = tx.transaction.message.instructions;
                for (const ix of instructions) {
                    if ('parsed' in ix && ix.program === 'system') {
                        const parsed = ix.parsed;
                        if (parsed.type === 'transfer' &&
                            parsed.info.source === merchantWallet &&
                            parsed.info.destination === vaultAddress) {
                            const transferredAmount = BigInt(parsed.info.lamports);
                            if (transferredAmount >= expectedAmount) {
                                console.log(`✅ Verified SOL deposit: ${transferredAmount} lamports`);
                                return true;
                            }
                        }
                    }
                }
            }
            else if (token === 'USDC') {
                // Verify USDC transfer (SPL token transfer)
                // Check token balance changes
                const postTokenBalances = tx.meta.postTokenBalances || [];
                const preTokenBalances = tx.meta.preTokenBalances || [];
                for (const postBalance of postTokenBalances) {
                    if (postBalance.owner === vaultAddress && postBalance.mint === this.config.usdcMint.toString()) {
                        const preBalance = preTokenBalances.find((pre) => pre.accountIndex === postBalance.accountIndex);
                        const postAmount = BigInt(postBalance.uiTokenAmount.amount);
                        const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : BigInt(0);
                        const depositedAmount = postAmount - preAmount;
                        if (depositedAmount >= expectedAmount) {
                            console.log(`✅ Verified USDC deposit: ${depositedAmount} micro-units`);
                            return true;
                        }
                    }
                }
            }
            console.log('❌ Deposit verification failed: amount mismatch or invalid transfer');
            return false;
        }
        catch (error) {
            console.error('Error verifying deposit:', error);
            return false;
        }
    }
    /**
     * Return deposit to merchant
     * Transfers funds from vault back to merchant wallet
     */
    async returnDeposit(merchantWallet, amount, token) {
        try {
            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log('💸 RETURNING MERCHANT DEPOSIT');
            console.log('═══════════════════════════════════════════════');
            console.log(`Merchant: ${merchantWallet}`);
            console.log(`Amount: ${amount} ${token}`);
            console.log('');
            let txSignature;
            if (token === 'SOL') {
                // Return SOL
                const transaction = new Transaction().add(SystemProgram.transfer({
                    fromPubkey: this.config.vaultKeypair.publicKey,
                    toPubkey: new PublicKey(merchantWallet),
                    lamports: amount,
                }));
                txSignature = await sendAndConfirmTransaction(this.connection, transaction, [this.config.vaultKeypair]);
            }
            else {
                // Return USDC
                const vaultUSDCAccount = await this.getVaultUSDCAccount();
                const merchantUSDCAccount = await getAssociatedTokenAddress(this.config.usdcMint, new PublicKey(merchantWallet));
                const transaction = new Transaction().add(createTransferInstruction(vaultUSDCAccount, merchantUSDCAccount, this.config.vaultKeypair.publicKey, amount));
                txSignature = await sendAndConfirmTransaction(this.connection, transaction, [this.config.vaultKeypair]);
            }
            console.log('✅ Deposit returned successfully');
            console.log(`Transaction: ${txSignature}`);
            console.log(`Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
            console.log('');
            return { success: true, txSignature };
        }
        catch (error) {
            console.error('Error returning deposit:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    /**
     * Calculate staking rewards
     * For now, uses a simple APY calculation
     * In production, integrate with actual staking protocol
     */
    calculateRewards(stakedAmount, stakingDurationDays, apy = 0.07 // 7% default APY
    ) {
        // Simple calculation: (stakedAmount * APY * days) / 365
        const annualReward = (stakedAmount * BigInt(Math.floor(apy * 1000))) / 1000n;
        const dailyReward = annualReward / 365n;
        const totalReward = dailyReward * BigInt(stakingDurationDays);
        // Apply reward share rate (platform keeps a percentage)
        const merchantShare = (totalReward * BigInt(Math.floor(this.config.rewardShareRate * 100))) / 100n;
        return merchantShare;
    }
    /**
     * Get total value locked (TVL) in vault
     */
    async getTVL() {
        const solBalance = await this.getVaultSOLBalance();
        const usdcBalance = await this.getVaultUSDCBalance();
        // Simple conversion (in production, use oracle price feeds)
        const SOL_PRICE_USD = 25; // Placeholder
        const solValueUSD = (Number(solBalance) / 1e9) * SOL_PRICE_USD;
        const usdcValueUSD = Number(usdcBalance) / 1e6;
        return {
            SOL: solBalance.toString(),
            USDC: usdcBalance.toString(),
            totalUSD: (solValueUSD + usdcValueUSD).toFixed(2),
        };
    }
    /**
     * Validate deposit amount meets minimum requirement
     */
    validateDepositAmount(amount, token) {
        const minimum = this.config.minimumDeposit[token];
        return amount >= minimum;
    }
    /**
     * Get minimum deposit requirements
     */
    getMinimumDeposits() {
        return {
            SOL: this.config.minimumDeposit.SOL.toString(),
            USDC: this.config.minimumDeposit.USDC.toString(),
        };
    }
}
/**
 * Helper: Generate unique deposit ID
 */
export function generateDepositId() {
    return `dep_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
/**
 * Helper: Generate unique stake ID
 */
export function generateStakeId() {
    return `stake_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
//# sourceMappingURL=vault-manager.js.map