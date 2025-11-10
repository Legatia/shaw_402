/**
 * Solana Pay Transaction Request API
 * Implements the Solana Pay specification for interactive transaction requests
 */
import { Router } from 'express';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, } from '@solana/web3.js';
import { encodeURL, findReference, validateTransfer, FindReferenceError, ValidateTransferError, } from '@solana/pay';
import { Keypair } from '@solana/web3.js';
import QRCode from 'qrcode';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
import { PAYMENT_AMOUNTS } from '../lib/constants.js';
const router = Router();
let config;
/**
 * Initialize Solana Pay routes with configuration
 */
export function initializeSolanaPayRoutes(cfg) {
    config = cfg;
}
/**
 * Payment endpoint definitions
 */
const PAYMENT_ENDPOINTS = {
    'premium-data': {
        amount: PAYMENT_AMOUNTS.PREMIUM_DATA,
        label: 'Premium Data Access',
        message: 'Unlock premium data',
    },
    'generate-content': {
        amount: PAYMENT_AMOUNTS.GENERATE_CONTENT,
        label: 'Generate Content',
        message: 'Generate AI content',
    },
    'download': {
        amount: PAYMENT_AMOUNTS.DOWNLOAD_FILE,
        label: 'File Download',
        message: 'Download file',
    },
    'tier-access': {
        amount: PAYMENT_AMOUNTS.TIER_ACCESS,
        label: 'Tier Access',
        message: 'Access premium tier',
    },
};
/**
 * GET /api/solana-pay/:endpoint
 * Returns label and icon for Solana Pay transaction request
 */
router.get('/:endpoint', async (req, res) => {
    try {
        const { endpoint } = req.params;
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        res.json({
            label: config.label,
            icon: config.iconUrl,
        });
    }
    catch (error) {
        console.error('Solana Pay GET error:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Internal server error', 'SOLANA_PAY_ERROR', 500));
    }
});
/**
 * POST /api/solana-pay/:endpoint
 * Returns a serialized transaction for the client to sign
 */
router.post('/:endpoint', async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { account } = req.body;
        if (!account) {
            res.status(400).json(errorResponse('Missing account in request body', 'MISSING_ACCOUNT', 400));
            return;
        }
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        const paymentInfo = PAYMENT_ENDPOINTS[endpoint];
        // Generate unique reference for this transaction
        const reference = Keypair.generate().publicKey;
        // Create a nonce for replay protection
        const nonce = Buffer.from(reference.toBytes()).toString('hex');
        const timestamp = Date.now();
        const expiry = timestamp + 3600000; // 1 hour
        await config.nonceDb.storeNonce({
            nonce,
            clientPublicKey: account,
            amount: paymentInfo.amount.toString(),
            recipient: config.merchantAddress.toString(),
            resourceId: endpoint,
            resourceUrl: `/api/solana-pay/${endpoint}`,
            timestamp,
            expiry,
        });
        // Create the transaction
        const payerPublicKey = new PublicKey(account);
        const connection = config.solanaUtils.getConnection();
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const transaction = new Transaction({
            feePayer: payerPublicKey,
            blockhash,
            lastValidBlockHeight,
        });
        // Add transfer instruction
        transaction.add(SystemProgram.transfer({
            fromPubkey: payerPublicKey,
            toPubkey: config.merchantAddress,
            lamports: Number(paymentInfo.amount),
        }));
        // Add reference as read-only account (for transaction lookup)
        transaction.add({
            keys: [
                {
                    pubkey: reference,
                    isSigner: false,
                    isWritable: false,
                },
            ],
            programId: new PublicKey('11111111111111111111111111111111'),
            data: Buffer.alloc(0),
        });
        // Serialize the transaction
        const serializedTransaction = transaction
            .serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        })
            .toString('base64');
        // Mark nonce as used (transaction signature will be added later when confirmed)
        await config.nonceDb.markNonceUsed(nonce, reference.toString());
        res.json({
            transaction: serializedTransaction,
            message: paymentInfo.message,
        });
    }
    catch (error) {
        console.error('Solana Pay POST error:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Internal server error', 'SOLANA_PAY_ERROR', 500));
    }
});
/**
 * GET /api/solana-pay/:endpoint/qr
 * Returns a QR code for the Solana Pay URL
 */
router.get('/:endpoint/qr', async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { format = 'png' } = req.query;
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        // Construct the Solana Pay transaction request URL
        const apiUrl = `${config.serverBaseUrl}/api/solana-pay/${endpoint}`;
        const solanaPayUrl = encodeURL({
            link: new URL(apiUrl),
        });
        if (format === 'svg') {
            const qrCodeSvg = await QRCode.toString(solanaPayUrl.toString(), {
                type: 'svg',
                width: 512,
                margin: 2,
            });
            res.setHeader('Content-Type', 'image/svg+xml');
            res.send(qrCodeSvg);
        }
        else {
            const qrCodeBuffer = await QRCode.toBuffer(solanaPayUrl.toString(), {
                width: 512,
                margin: 2,
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(qrCodeBuffer);
        }
    }
    catch (error) {
        console.error('Solana Pay QR generation error:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'QR code generation failed', 'QR_GENERATION_ERROR', 500));
    }
});
/**
 * GET /api/solana-pay/:endpoint/status/:reference
 * Check payment status by reference
 */
router.get('/:endpoint/status/:reference', async (req, res) => {
    try {
        const { endpoint, reference } = req.params;
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        const referencePublicKey = new PublicKey(reference);
        // Search for transaction with this reference
        try {
            const connection = config.solanaUtils.getConnection();
            const signatureInfo = await findReference(connection, referencePublicKey, { finality: 'confirmed' });
            // Found the transaction
            res.json(successResponse({
                status: 'confirmed',
                signature: signatureInfo.signature,
                reference: reference,
            }));
        }
        catch (error) {
            if (error instanceof FindReferenceError) {
                // Transaction not found yet
                res.json(successResponse({
                    status: 'pending',
                    reference: reference,
                }));
            }
            else {
                throw error;
            }
        }
    }
    catch (error) {
        console.error('Solana Pay status check error:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Status check failed', 'STATUS_CHECK_ERROR', 500));
    }
});
/**
 * POST /api/solana-pay/:endpoint/validate
 * Validate a completed payment
 */
router.post('/:endpoint/validate', async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { reference } = req.body;
        if (!reference) {
            res.status(400).json(errorResponse('Missing reference in request body', 'MISSING_REFERENCE', 400));
            return;
        }
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        const paymentInfo = PAYMENT_ENDPOINTS[endpoint];
        const referencePublicKey = new PublicKey(reference);
        const connection = config.solanaUtils.getConnection();
        // Find the transaction
        const signatureInfo = await findReference(connection, referencePublicKey, { finality: 'confirmed' });
        // Validate the transfer amount and recipient
        try {
            await validateTransfer(connection, signatureInfo.signature, {
                recipient: config.merchantAddress,
                amount: BigInt(paymentInfo.amount), // Type compatibility with @solana/pay BigNumber
                reference: referencePublicKey,
            }, { commitment: 'confirmed' });
            res.json(successResponse({
                valid: true,
                signature: signatureInfo.signature,
                reference: reference,
            }));
        }
        catch (error) {
            if (error instanceof ValidateTransferError) {
                res.status(400).json(errorResponse('Payment validation failed', 'INVALID_PAYMENT', 400));
            }
            else {
                throw error;
            }
        }
    }
    catch (error) {
        if (error instanceof FindReferenceError) {
            res.status(404).json(errorResponse('Transaction not found', 'TRANSACTION_NOT_FOUND', 404));
        }
        else {
            console.error('Solana Pay validation error:', error);
            res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Validation failed', 'VALIDATION_ERROR', 500));
        }
    }
});
/**
 * GET /api/solana-pay/transfer/:endpoint
 * Generate a transfer request URL (non-interactive)
 */
router.get('/transfer/:endpoint', async (req, res) => {
    try {
        const { endpoint } = req.params;
        if (!isValidEndpoint(endpoint)) {
            res.status(404).json(errorResponse('Payment endpoint not found', 'INVALID_ENDPOINT', 404));
            return;
        }
        const paymentInfo = PAYMENT_ENDPOINTS[endpoint];
        const reference = Keypair.generate().publicKey;
        // Create transfer request URL
        // encodeURL expects amount in SOL (not lamports)
        const amountInLamports = Number(paymentInfo.amount);
        const amountInSol = amountInLamports / LAMPORTS_PER_SOL;
        const url = encodeURL({
            recipient: config.merchantAddress,
            amount: amountInSol, // Type compatibility with @solana/pay BigNumber
            reference,
            label: paymentInfo.label,
            message: paymentInfo.message,
        });
        res.json(successResponse({
            url: url.toString(),
            reference: reference.toString(),
            amount: paymentInfo.amount,
            recipient: config.merchantAddress.toString(),
        }));
    }
    catch (error) {
        console.error('Solana Pay transfer URL generation error:', error);
        res.status(500).json(errorResponse(error instanceof Error ? error.message : 'Transfer URL generation failed', 'TRANSFER_URL_ERROR', 500));
    }
});
/**
 * Helper function to validate endpoint
 */
function isValidEndpoint(endpoint) {
    return endpoint in PAYMENT_ENDPOINTS;
}
export default router;
//# sourceMappingURL=solana-pay.js.map