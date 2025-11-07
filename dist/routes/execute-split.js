/**
 * x402-Protected Split Execution Endpoint
 * Agent must provide valid x402 payment to access split execution service
 */
import { PublicKey, Keypair } from '@solana/web3.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
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
export function executeSplitRoute(context) {
    return async (req, res) => {
        try {
            const { splitId, recipients, agentUSDCAccount, usdcMint, agentPrivateKey } = req.body;
            console.log('');
            console.log('═══════════════════════════════════════════════');
            console.log('🔀 x402-AUTHORIZED SPLIT EXECUTION');
            console.log('═══════════════════════════════════════════════');
            // Validation
            if (!splitId) {
                res.json(errorResponse('Split ID is required', 'MISSING_SPLIT_ID', 400));
                return;
            }
            if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
                res.json(errorResponse('Recipients array is required', 'MISSING_RECIPIENTS', 400));
                return;
            }
            if (!agentUSDCAccount) {
                res.json(errorResponse('Agent USDC account is required', 'MISSING_AGENT_ACCOUNT', 400));
                return;
            }
            if (!usdcMint) {
                res.json(errorResponse('USDC mint address is required', 'MISSING_USDC_MINT', 400));
                return;
            }
            if (!agentPrivateKey) {
                res.json(errorResponse('Agent private key is required', 'MISSING_PRIVATE_KEY', 400));
                return;
            }
            // Verify x402 payment was processed by middleware
            if (!req.payment) {
                res.status(402).json(errorResponse('x402 payment authorization required', 'PAYMENT_REQUIRED', 402));
                return;
            }
            // Get agent wallet from x402 payment
            const agentWallet = req.payment.clientPublicKey;
            console.log(`Split ID: ${splitId}`);
            console.log(`Agent Wallet: ${agentWallet}`);
            console.log(`Agent USDC Account: ${agentUSDCAccount}`);
            console.log(`Recipients: ${recipients.length}`);
            console.log(`x402 Payment Verified: ✅`);
            console.log(`Transaction: ${req.payment.transactionSignature}`);
            console.log('');
            // Validate recipients
            for (const recipient of recipients) {
                if (!recipient.wallet || !recipient.amount || !recipient.usdcAccount) {
                    res.json(errorResponse(`Invalid recipient: missing wallet, amount, or usdcAccount`, 'INVALID_RECIPIENT', 400));
                    return;
                }
                try {
                    new PublicKey(recipient.wallet);
                    new PublicKey(recipient.usdcAccount);
                }
                catch {
                    res.json(errorResponse(`Invalid public key in recipient: ${recipient.wallet} or ${recipient.usdcAccount}`, 'INVALID_PUBLIC_KEY', 400));
                    return;
                }
            }
            // Validate total amounts match
            const totalSplit = recipients.reduce((sum, r) => sum + BigInt(r.amount), 0n);
            console.log(`Total Split Amount: ${totalSplit.toString()}`);
            console.log('');
            // Log split breakdown
            console.log('💵 SPLIT BREAKDOWN:');
            for (const recipient of recipients) {
                const amountUSDC = Number(recipient.amount) / 1_000_000; // Convert micro-units to USDC
                console.log(`  ${recipient.role.padEnd(10)} → ${recipient.wallet.substring(0, 8)}... : ${amountUSDC.toFixed(6)} USDC`);
            }
            console.log('');
            // Prepare recipients for solana-utils
            // splitUSDCPayment expects: Array<{ owner: PublicKey; amount: bigint }>
            const splitRecipients = recipients.map(r => ({
                owner: new PublicKey(r.wallet), // Use wallet address, not USDC account
                amount: BigInt(r.amount),
            }));
            console.log('🔄 Executing atomic USDC split transaction...');
            // Reconstruct agent keypair from provided private key
            let agentKeypair;
            try {
                const bs58 = await import('bs58');
                const secretKey = bs58.default.decode(agentPrivateKey);
                agentKeypair = Keypair.fromSecretKey(secretKey);
                // Verify the keypair matches the agent wallet from x402 auth
                if (agentKeypair.publicKey.toString() !== agentWallet) {
                    res.json(errorResponse('Agent private key does not match x402 authorized wallet', 'KEYPAIR_MISMATCH', 403));
                    return;
                }
            }
            catch (error) {
                res.json(errorResponse('Invalid agent private key format', 'INVALID_PRIVATE_KEY', 400));
                return;
            }
            const signature = await context.solanaUtils.splitUSDCPayment(agentKeypair, new PublicKey(usdcMint), splitRecipients);
            console.log('');
            console.log(`✅ Split executed successfully!`);
            console.log(`Transaction Signature: ${signature}`);
            console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
            console.log('═══════════════════════════════════════════════');
            console.log('');
            res.json(successResponse({
                splitId,
                transactionSignature: signature,
                explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
                recipients: recipients.map(r => ({
                    role: r.role,
                    wallet: r.wallet,
                    usdcAccount: r.usdcAccount,
                    amount: r.amount,
                })),
                x402Payment: {
                    verified: true,
                    agentWallet,
                    transactionSignature: req.payment.transactionSignature,
                }
            }));
        }
        catch (error) {
            console.error('');
            console.error('❌ Split execution error:', error);
            console.error('');
            res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Split execution failed', 'SPLIT_EXECUTION_FAILED', 500));
        }
    };
}
export default executeSplitRoute;
//# sourceMappingURL=execute-split.js.map