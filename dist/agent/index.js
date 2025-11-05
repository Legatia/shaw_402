/**
 * Payment Processor Agent Application
 * Runs autonomous agents for all registered merchants
 */
import 'dotenv/config';
import { AgentManager } from './agent-manager.js';
import { AffiliateDatabase } from '../lib/affiliate-database.js';
import { SolanaUtils } from '../lib/solana-utils.js';
// Configuration from environment
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:3001';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '';
const USDC_MINT_ADDRESS = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_WS_URL = process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com';
const DATABASE_PATH = process.env.AFFILIATE_DATABASE_PATH || './data/affiliate.db';
// Initialize services
const affiliateDb = new AffiliateDatabase(DATABASE_PATH);
const solanaUtils = new SolanaUtils({
    rpcEndpoint: SOLANA_RPC_URL,
    rpcSubscriptionsEndpoint: SOLANA_WS_URL,
});
// Create agent manager
const agentManager = new AgentManager({
    affiliateDb,
    solanaUtils,
    facilitatorUrl: FACILITATOR_URL,
    platformWallet: PLATFORM_WALLET,
    usdcMint: USDC_MINT_ADDRESS,
});
/**
 * Start the agent application
 */
async function start() {
    try {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                       ║');
        console.log('║           PAYMENT PROCESSOR AGENT APPLICATION                         ║');
        console.log('║                                                                       ║');
        console.log('║   Autonomous USDC payment monitoring and commission splitting         ║');
        console.log('║                                                                       ║');
        console.log('╚═══════════════════════════════════════════════════════════════════════╝');
        console.log('');
        // Initialize database
        console.log('📊 Initializing affiliate database...');
        await affiliateDb.initialize();
        console.log('✅ Database initialized');
        console.log('');
        // Start all agents
        await agentManager.startAll();
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════════════╗');
        console.log('║                                                                       ║');
        console.log('║                    AGENTS ARE NOW MONITORING                          ║');
        console.log('║                                                                       ║');
        console.log('║   Send USDC to agent wallets to test automatic commission splits     ║');
        console.log('║                                                                       ║');
        console.log('╚═══════════════════════════════════════════════════════════════════════╝');
        console.log('');
        // Display agent status
        const statuses = agentManager.getStatus();
        if (statuses.length > 0) {
            console.log('Active Agents:');
            statuses.forEach((status, index) => {
                console.log(`  ${index + 1}. ${status.businessName} (${status.merchantId})`);
                console.log(`     Agent: ${status.agentWallet}`);
                console.log(`     Status: ${status.isMonitoring ? '🟢 Monitoring' : '🔴 Stopped'}`);
            });
            console.log('');
        }
        // Keep process alive
        console.log('Press Ctrl+C to stop all agents and exit');
        console.log('');
    }
    catch (error) {
        console.error('❌ Failed to start agent application:', error);
        process.exit(1);
    }
}
/**
 * Graceful shutdown
 */
async function shutdown() {
    console.log('');
    console.log('🛑 Shutting down agent application...');
    await agentManager.stopAll();
    await affiliateDb.close();
    console.log('✅ Shutdown complete');
    console.log('');
    process.exit(0);
}
// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    shutdown();
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    shutdown();
});
// Start the application
start();
//# sourceMappingURL=index.js.map