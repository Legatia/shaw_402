/**
 * x402 Server Application
 * TypeScript implementation with x402 middleware using Gill template patterns
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServerContext } from '../lib/get-server-context.js';
import { createX402MiddlewareWithUtils } from '../lib/x402-middleware.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
import { REQUEST_TIMEOUT, RETRY_ATTEMPTS, REQUEST_BODY_LIMIT, PAYMENT_AMOUNTS } from '../lib/constants.js';
import { AffiliateDatabase } from '../lib/affiliate-database.js';
import { SolanaUtils } from '../lib/solana-utils.js';
import { NonceDatabase } from '../lib/nonce-database.js';
import { VaultManager } from '../lib/vault-manager.js';
import merchantRoutes, { initializeMerchantRoutes } from '../routes/merchant.js';
import solanaPayRoutes, { initializeSolanaPayRoutes } from '../routes/solana-pay.js';
import agentAPIRoutes, { initializeAgentAPI } from '../routes/agent-api.js';
import vaultAPIRoutes, { initializeVaultAPI } from '../routes/vault-api.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Initialize context
const context = getServerContext();
const app = express();
// Initialize affiliate database
const affiliateDb = new AffiliateDatabase('./data/affiliate.db');
// Initialize nonce database for Solana Pay
const nonceDb = new NonceDatabase('./data/solana-pay-nonces.db');
// Initialize Solana utils for merchant routes
const solanaUtils = new SolanaUtils({
    rpcEndpoint: context.config.solanaRpcUrl || 'https://api.devnet.solana.com',
    rpcSubscriptionsEndpoint: context.config.solanaWsUrl,
});
// Initialize Vault Manager
const vaultPrivateKey = process.env.VAULT_PRIVATE_KEY || process.env.FACILITATOR_PRIVATE_KEY;
if (!vaultPrivateKey) {
    throw new Error('VAULT_PRIVATE_KEY or FACILITATOR_PRIVATE_KEY must be set');
}
const vaultKeypair = Keypair.fromSecretKey(bs58.decode(vaultPrivateKey));
const usdcMint = new PublicKey(process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const vaultManager = new VaultManager({
    vaultKeypair,
    solanaUtils,
    usdcMint,
    minimumDeposit: {
        SOL: BigInt(process.env.MIN_DEPOSIT_SOL || '1000000000'), // 1 SOL default
        USDC: BigInt(process.env.MIN_DEPOSIT_USDC || '100000000'), // 100 USDC default
    },
    stakingEnabled: process.env.STAKING_ENABLED === 'true',
    rewardShareRate: parseFloat(process.env.REWARD_SHARE_RATE || '0.8'), // 80% to merchants, 20% to platform
});
// Setup middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for frontend
}));
app.use(cors());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));
// Serve static files from public directory
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));
// Request logging
app.use((req, _res, next) => {
    context.log.info(`${req.method} ${req.path}`);
    next();
});
// Create x402 utils instance
const x402Utils = createX402MiddlewareWithUtils({}, {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
});
// ============================================================================
// ROUTES
// ============================================================================
// Initialize merchant routes
initializeMerchantRoutes(affiliateDb, solanaUtils);
app.use('/merchant', merchantRoutes);
// Initialize Solana Pay routes
const merchantAddress = context.config.merchantSolanaAddress
    ? new PublicKey(context.config.merchantSolanaAddress)
    : new PublicKey(context.config.facilitatorPublicKey || '');
initializeSolanaPayRoutes({
    solanaUtils,
    nonceDb,
    merchantAddress,
    serverBaseUrl: process.env.SERVER_BASE_URL || `http://localhost:${context.config.port}`,
    label: process.env.SOLANA_PAY_LABEL || 'x402 Payment Server',
    iconUrl: process.env.SOLANA_PAY_ICON_URL,
});
app.use('/api/solana-pay', solanaPayRoutes);
// Initialize Agent API routes (for payment processor agents)
initializeAgentAPI({
    affiliateDb,
    platformWallet: process.env.PLATFORM_WALLET || '',
    usdcMint: process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
});
app.use('/api/agent', agentAPIRoutes);
// Initialize Vault API routes (for merchant deposits and staking)
initializeVaultAPI({
    vaultManager,
    affiliateDb,
});
app.use('/api/vault', vaultAPIRoutes);
// Config endpoint for frontend
app.get('/api/config', (_req, res) => {
    res.json(successResponse({
        platformWallet: process.env.PLATFORM_WALLET || '',
        registrationFee: process.env.REGISTRATION_FEE || '50000000',
        platformBaseUrl: process.env.PLATFORM_BASE_URL || 'http://localhost:3000',
        solanaNetwork: context.config.solanaNetwork || 'devnet',
    }));
});
// Health check endpoint
app.get('/health', async (_req, res) => {
    try {
        const facilitatorHealth = await x402Utils.healthCheck();
        res.json(successResponse({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            facilitator: facilitatorHealth,
        }));
    }
    catch (error) {
        res
            .status(500)
            .json(errorResponse(error instanceof Error ? error.message : 'Unknown error', 'HEALTH_CHECK_FAILED', 500));
    }
});
// Public endpoint (no payment required)
app.get('/public', (_req, res) => {
    res.json(successResponse({
        message: 'This is a public endpoint - no payment required',
        timestamp: new Date().toISOString(),
    }));
});
// ============================================================================
// PROTECTED ENDPOINTS (x402 Payment Required)
// ============================================================================
// Premium data endpoint - 0.01 SOL
const premiumRouteMw = createX402MiddlewareWithUtils({
    amount: PAYMENT_AMOUNTS.PREMIUM_DATA,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: `solana-${context.config.solanaNetwork}`,
}, {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
});
app.get('/api/premium-data', premiumRouteMw.middleware, (req, res) => {
    res.set({
        'x-payment-processed': 'true',
        'x-payment-method': 'solana-sol',
        'x-payment-network': 'devnet',
        'x-payment-transaction': req.payment?.transactionSignature,
    });
    res.json(successResponse({
        message: 'Premium data accessed successfully',
        data: {
            secret: 'This is premium content that requires payment',
            timestamp: new Date().toISOString(),
            payment: req.payment,
        },
    }));
});
// Generate content endpoint - 0.005 SOL
const generateContentMw = createX402MiddlewareWithUtils({
    amount: PAYMENT_AMOUNTS.GENERATE_CONTENT,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: `solana-${context.config.solanaNetwork}`,
}, {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
});
app.post('/api/generate-content', generateContentMw.middleware, (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        res.status(400).json(errorResponse('Prompt is required', 'MISSING_PROMPT', 400));
        return;
    }
    res.json(successResponse({
        message: 'Content generated successfully',
        data: {
            prompt: prompt,
            generatedContent: `AI-generated content for: "${prompt}"`,
            timestamp: new Date().toISOString(),
            payment: req.payment,
        },
    }));
});
// File download endpoint - 0.02 SOL
const downloadMw = createX402MiddlewareWithUtils({
    amount: PAYMENT_AMOUNTS.DOWNLOAD_FILE,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: `solana-${context.config.solanaNetwork}`,
}, {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
});
app.get('/api/download/:fileId', downloadMw.middleware, (req, res) => {
    const { fileId } = req.params;
    res.json(successResponse({
        message: 'File download authorized',
        data: {
            fileId: fileId,
            // TODO: Implement actual file download URL generation
            downloadUrl: `/files/${fileId}`,
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
            payment: req.payment,
        },
    }));
});
// Tier-based access endpoint - 0.05 SOL
const tierMw = createX402MiddlewareWithUtils({
    amount: PAYMENT_AMOUNTS.TIER_ACCESS,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: `solana-${context.config.solanaNetwork}`,
}, {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
});
app.get('/api/tier/:tier', tierMw.middleware, (req, res) => {
    const { tier } = req.params;
    const payment = req.payment;
    res.json(successResponse({
        message: `Access granted to ${tier} tier`,
        data: {
            tier: tier,
            features: [`${tier} tier features enabled`],
            payment: payment,
        },
    }));
});
// Stats endpoint - public
app.get('/stats', async (_req, res) => {
    try {
        // Get facilitator stats
        const statsResponse = await fetch(`${context.config.facilitatorUrl}/stats`);
        const stats = await statsResponse.json();
        res.json(successResponse(stats));
    }
    catch (error) {
        res
            .status(500)
            .json(errorResponse(error instanceof Error ? error.message : 'Failed to get stats', 'STATS_ERROR', 500));
    }
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json(errorResponse('The requested resource was not found', 'NOT_FOUND', 404));
});
// ============================================================================
// START SERVER
// ============================================================================
async function start() {
    try {
        // Initialize affiliate database
        await affiliateDb.initialize();
        context.log.info('Affiliate database initialized');
        // Initialize nonce database
        await nonceDb.initialize();
        context.log.info('Solana Pay nonce database initialized');
        app.listen(context.config.port, () => {
            context.log.info(`Server App running on port ${context.config.port}`);
            context.log.info(`Facilitator URL: ${context.config.facilitatorUrl}`);
            context.log.info('');
            context.log.info('Available endpoints:');
            context.log.info('  GET  / - Merchant registration landing page');
            context.log.info('  POST /merchant/register - Register new merchant');
            context.log.info('  GET  /merchant/:id - Get merchant details');
            context.log.info('  POST /merchant/affiliate/register - Register affiliate');
            context.log.info('  GET  /health - Health check');
            context.log.info('  GET  /public - Public endpoint (no payment)');
            context.log.info('  GET  /api/premium-data - Premium data (payment required)');
            context.log.info('  POST /api/generate-content - Generate content (payment required)');
            context.log.info('  GET  /api/download/:fileId - Download file (payment required)');
            context.log.info('  GET  /api/tier/:tier - Tier-based access (payment required)');
            context.log.info('  GET  /stats - Payment statistics');
            context.log.info('');
            context.log.info('Solana Pay endpoints:');
            context.log.info('  GET/POST /api/solana-pay/:endpoint - Transaction request');
            context.log.info('  GET  /api/solana-pay/:endpoint/qr - QR code');
            context.log.info('  GET  /api/solana-pay/:endpoint/status/:ref - Payment status');
            context.log.info('  POST /api/solana-pay/:endpoint/validate - Validate payment');
            context.log.info('  GET  /api/solana-pay/transfer/:endpoint - Transfer URL');
        });
    }
    catch (error) {
        context.log.error('Failed to start Server App:', error);
        process.exit(1);
    }
}
// Graceful shutdown
async function shutdown() {
    context.log.info('Shutting down Server App...');
    await affiliateDb.close();
    await nonceDb.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Start the app
start();
export { app, context };
//# sourceMappingURL=index.js.map