# Payment Processor Agent System

## 🤖 Overview

The **Payment Processor Agent System** is the autonomous layer that monitors USDC payments and automatically executes commission splits for the affiliate program platform.

Each registered merchant gets their own dedicated **Payment Processor Agent** that:
- Monitors their agent's USDC token account 24/7
- Detects incoming USDC payments via polling (every 5 seconds)
- Parses transaction memos to identify affiliate IDs
- Calculates platform/affiliate/merchant commission splits
- Calls facilitator to execute atomic USDC settlement
- Records transactions in the database
- Updates affiliate earnings automatically

**This is fully autonomous** - no manual processing required!

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  AGENT MANAGER                             │
│  - Loads all active merchants from database                │
│  - Spawns PaymentProcessorAgent for each merchant          │
│  - Manages agent lifecycle                                 │
└─────────────────┬──────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────────┐ ┌──────────────────┐
│ PaymentProcessor │ │ PaymentProcessor │
│  Agent #1        │ │  Agent #2        │
│                  │ │                  │
│ Merchant: ABC    │ │ Merchant: XYZ    │
│ Monitoring:      │ │ Monitoring:      │
│ AgentUSDC123...  │ │ AgentUSDC456...  │
└──────────────────┘ └──────────────────┘
         │                 │
         │ Polls every 5s  │
         ▼                 ▼
    USDC Account      USDC Account
         │                 │
         │ Payment arrives │
         ▼                 ▼
    Parse memo → Calculate split → Call /settle-usdc-split
         │                 │
         ▼                 ▼
    [Platform]       [Platform]
    [Affiliate]      [Merchant] (no affiliate)
    [Merchant]
```

---

## 📋 Components

### 1. PaymentProcessorAgent (`src/agent/payment-processor.ts`)

**The core autonomous agent** - one instance per merchant.

**Key Features:**
- Polls agent USDC account every 5 seconds
- Parses SPL token transfer transactions
- Extracts memos from Memo program instructions
- Identifies affiliate ID (pattern: `AFF_12345`)
- Calculates commission splits
- Calls facilitator `/settle-usdc-split` endpoint
- Records transactions in database
- Updates affiliate earnings

**Configuration:**
```typescript
interface PaymentProcessorConfig {
  merchantData: MerchantData;         // Merchant info from DB
  solanaUtils: SolanaUtils;           // Solana utilities
  affiliateDb: AffiliateDatabase;     // Database access
  facilitatorUrl: string;             // Facilitator endpoint
  platformWallet: string;             // Platform wallet address
  platformUSDCAccount: string;        // Platform USDC account
}
```

**Lifecycle:**
```typescript
const agent = new PaymentProcessorAgent(config);
await agent.start();   // Start monitoring
await agent.stop();    // Stop monitoring
const status = agent.getStatus(); // Get status
```

### 2. AgentManager (`src/agent/agent-manager.ts`)

**Orchestrates all agents** - one instance for the platform.

**Key Features:**
- Loads all active merchants from database on startup
- Creates PaymentProcessorAgent for each merchant
- Starts all agents concurrently
- Provides management API (start, stop, refresh, add, remove)
- Handles graceful shutdown

**API:**
```typescript
const manager = new AgentManager(config);

await manager.startAll();              // Start all agents
await manager.stopAll();               // Stop all agents
await manager.refresh();               // Reload and restart
await manager.addMerchant(merchantId); // Add new merchant agent
await manager.removeMerchant(merchantId); // Remove merchant agent
const statuses = manager.getStatus();  // Get all agent statuses
```

### 3. Agent Application (`src/agent/index.ts`)

**Standalone app** that runs the agent system.

**What it does:**
1. Initializes affiliate database
2. Creates SolanaUtils instance
3. Creates AgentManager
4. Starts all agents
5. Displays status
6. Handles graceful shutdown (Ctrl+C)

**Run standalone:**
```bash
npm run dev:agent        # Development (auto-reload)
npm run start:agent      # Production
```

**Run with PM2:**
```bash
npm start                # Starts all 3 apps (facilitator, server, agent)
pm2 logs x402-agent      # View agent logs
```

---

## 🔄 Payment Processing Flow

### Step-by-Step Example

**Setup:**
- Merchant "CoolNFTs" registered
- Agent wallet: `Agent123...`
- Agent USDC account: `AgentUSDC123...`
- Affiliate "Alice" registered with ID: `AFF_ALICE_001`

**Customer Purchase:**
1. Customer wants to buy NFT for 100 USDC
2. CoolNFTs frontend shows: "Pay to: AgentUSDC123..."
3. Customer sends 100 USDC with memo: `AFF_ALICE_001`

**Agent Detection (automatic):**
4. Agent polls USDC account every 5 seconds
5. Detects new transaction with 100 USDC transfer
6. Parses transaction instructions
7. Finds Memo program instruction
8. Extracts memo data: `AFF_ALICE_001`

**Commission Calculation:**
9. Agent looks up affiliate in database
10. Finds Alice's wallet and USDC account
11. Calculates splits:
    - Platform (5%): 5 USDC
    - Affiliate (15%): 15 USDC
    - Merchant (80%): 80 USDC

**Atomic Settlement:**
12. Agent calls `/settle-usdc-split` endpoint:
```json
{
  "agentPrivateKey": "base58...",
  "usdcMint": "4zMMC...",
  "recipients": [
    { "publicKey": "PlatformWallet...", "amount": "5000000" },
    { "publicKey": "AliceWallet...", "amount": "15000000" },
    { "publicKey": "MerchantWallet...", "amount": "80000000" }
  ]
}
```

13. Facilitator creates atomic SPL token transaction
14. Three USDC transfers in single transaction
15. Agent signs (has SOL for gas)
16. Broadcast to Solana
17. All three parties receive USDC instantly (~400ms)

**Database Recording:**
18. Agent records transaction in `payment_splits` table
19. Updates Alice's `total_earned` in `affiliates` table
20. Logs completion

**Result:**
- ✅ Platform received 5 USDC
- ✅ Alice received 15 USDC
- ✅ Merchant received 80 USDC
- ✅ All transparent on-chain
- ✅ Fully automated

---

## 📊 Transaction Memo Format

**Supported formats:**
```
AFF_12345              ← Affiliate ID only
REF:AFF_12345          ← Prefixed with "REF:"
AFF_ALICE_001          ← Alphanumeric
```

**Regex pattern:** `/AFF_[A-Z0-9]+/i`

**No memo = no affiliate:**
- If memo missing or doesn't match pattern
- Merchant gets affiliate's commission too
- Platform still gets platform fee

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
FACILITATOR_URL=http://localhost:3001
PLATFORM_WALLET=YourPlatformWallet...
PLATFORM_PRIVATE_KEY=YourBase58PrivateKey... # Needed for funding agents
USDC_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Optional
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
AFFILIATE_DATABASE_PATH=./data/affiliate.db
```

### PM2 Configuration

Added to `ecosystem.config.cjs`:
```javascript
{
  name: 'x402-agent',
  script: './dist/agent/index.js',
  instances: 1,
  autorestart: true,
  error_file: './logs/agent-error.log',
  out_file: './logs/agent-out.log',
}
```

---

## 🚀 Usage

### Starting the Agent System

**Development (auto-reload on code changes):**
```bash
npm run dev:agent
```

**Production (single instance):**
```bash
npm run build
npm run start:agent
```

**Production (with PM2 - all 3 apps):**
```bash
npm run build
npm start                    # Start all apps
pm2 logs x402-agent          # View agent logs
pm2 restart x402-agent       # Restart agent
pm2 stop x402-agent          # Stop agent
```

### Testing Payment Flow

**1. Register a merchant:**
```bash
# Visit http://localhost:3000
# Connect wallet and pay 0.05 SOL
# Note the agent USDC account address
```

**2. Register an affiliate:**
```bash
curl -X POST http://localhost:3000/merchant/affiliate/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "MER_ABC123",
    "affiliateWallet": "AffiliateWallet..."
  }'

# Note the referral code (e.g., AFF_12345)
```

**3. Get devnet USDC:**
```bash
# Visit https://spl-token-faucet.com/
# Get USDC airdrop to your test wallet
```

**4. Send test payment:**
```bash
npm run test:payment <payer_private_key> <agent_usdc_account> 100 AFF_12345
```

**5. Watch agent logs:**
```bash
# You should see:
💰 INCOMING USDC PAYMENT DETECTED
  Amount: 100 USDC
  From: PayerWallet...
  Memo: AFF_12345

💵 COMMISSION SPLIT:
  Platform (5%): 5 USDC
  Affiliate (15%): 15 USDC
  Merchant: 80 USDC

🔀 Executing atomic USDC split...
✅ Split executed: 5K2mBh...
Explorer: https://explorer.solana.com/tx/5K2mBh...?cluster=devnet
✅ Transaction recorded in database
✅ Payment processed successfully!
```

---

## 🔍 Monitoring & Debugging

### View Agent Status

Agents log their activity in real-time:

**Key log messages:**
```
🤖 PAYMENT PROCESSOR AGENT STARTED
  Merchant: CoolNFTs
  Agent USDC Account: AgentUSDC123...
  🔍 Monitoring USDC payments...

💰 INCOMING USDC PAYMENT DETECTED
  Amount: 100 USDC
  Memo: AFF_ALICE_001

💵 COMMISSION SPLIT:
  Platform (5%): 5 USDC
  Affiliate (15%): 15 USDC
  Merchant: 80 USDC

🔀 Executing atomic USDC split...
  ✅ Split executed: 5K2...
```

### Check Database

**View all transactions:**
```bash
sqlite3 data/affiliate.db "SELECT * FROM payment_splits;"
```

**Check affiliate earnings:**
```bash
sqlite3 data/affiliate.db "SELECT affiliate_id, total_referrals, total_earned FROM affiliates;"
```

### Common Issues

**1. Agent not starting:**
- Check database path in `.env`
- Ensure database initialized
- Verify merchants table exists

**2. Payments not detected:**
- Confirm agent monitoring correct USDC account
- Check RPC endpoint connectivity
- Verify transaction actually sent to agent account

**3. Split failing:**
- Check facilitator is running (`/settle-usdc-split` endpoint)
- Verify agent has SOL for gas fees
- Ensure all recipient USDC accounts exist

---

## 📈 Performance

### Polling Interval

**Current:** 5 seconds
**Tradeoff:** Balance between responsiveness and RPC rate limits

**Adjust in** `src/agent/payment-processor.ts`:
```typescript
// Poll every 5 seconds
setTimeout(poll, 5000);  // Change to 1000 for 1-second polling
```

### Scaling

**Current setup:**
- One agent per merchant
- All agents run in single process
- Suitable for ~100-1000 merchants

**For large scale (>1000 merchants):**
1. **Horizontal scaling:** Run multiple agent processes
2. **Sharding:** Distribute merchants across processes
3. **WebSocket:** Replace polling with WebSocket subscriptions
4. **Worker threads:** Use Node.js worker threads

---

## 🔐 Security Considerations

### Agent Private Keys

**Current:** Stored in database (plaintext)

**Production:** Must encrypt!
```typescript
// Before storing
const encrypted = await encryptKey(agentPrivateKey, MASTER_KEY);
merchantData.agentPrivateKey = encrypted;

// Before using
const decrypted = await decryptKey(merchantData.agentPrivateKey, MASTER_KEY);
const keypair = Keypair.fromSecretKey(bs58.decode(decrypted));
```

**Options:**
- AWS KMS
- HashiCorp Vault
- Azure Key Vault
- Encrypted database fields

### Gas Funding

Agents need SOL for gas fees:
- ✅ Funded with 0.01 SOL at registration
- ⚠️ Monitor SOL balance
- 🔄 Auto-refill when below threshold

**Add monitoring:**
```typescript
const solBalance = await solanaUtils.getSOLBalance(agentWallet);
if (solBalance < MIN_BALANCE) {
  await refillAgent(agentWallet);
}
```

### Rate Limiting

**Protect facilitator endpoint:**
```typescript
// Add rate limiting to /settle-usdc-split
app.use('/settle-usdc-split', rateLimit({
  windowMs: 1000, // 1 second
  max: 10,        // Max 10 requests per second
}));
```

---

## 🚧 Future Enhancements

### Phase 3: Advanced Features

**1. WebSocket Subscriptions**
Replace polling with real-time account change notifications:
```typescript
connection.onAccountChange(agentUSDCAccount, (accountInfo) => {
  // Process payment immediately
});
```

**2. Retry Logic**
Handle failed splits gracefully:
```typescript
async executeSplit() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await callFacilitator();
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

**3. Multi-Currency Support**
Support multiple stablecoins:
```typescript
const supportedTokens = {
  USDC: '4zMMC...',
  USDT: 'Es9v...',
  EURC: 'HzwqB...',
};
```

**4. Analytics Dashboard**
Real-time agent monitoring:
- Payments processed per hour
- Average split time
- Error rates
- Agent health status

**5. Alert System**
Notify on important events:
- Large payment detected (>$10,000)
- Split failure
- Low gas balance
- Suspicious patterns

---

## 🎬 Complete Example

**End-to-end workflow:**

```bash
# 1. Start all services
npm run build
npm start

# Wait for: "AGENTS ARE NOW MONITORING"

# 2. Register merchant (via frontend)
# Visit http://localhost:3000
# Pay 0.05 SOL → Get merchant ID and agent USDC account

# 3. Register affiliate (via API)
curl -X POST http://localhost:3000/merchant/affiliate/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "MER_ABC123",
    "affiliateWallet": "YourAffiliateWallet..."
  }'
# Returns: { affiliateId: "AFF_12345", referralCode: "AFF_12345" }

# 4. Get devnet USDC
# Visit https://spl-token-faucet.com/
# Airdrop 1000 USDC to test wallet

# 5. Send test payment
npm run test:payment <your_private_key> <agent_usdc_account> 100 AFF_12345

# 6. Watch magic happen
pm2 logs x402-agent

# You'll see:
# - Payment detected
# - Commission calculated
# - Split executed
# - Transaction recorded
# - All in ~5-10 seconds!

# 7. Verify on-chain
# Visit Solana Explorer with transaction signature
# See all 3 transfers in single atomic transaction
```

---

## 📚 Code Reference

**Key files:**
- `src/agent/payment-processor.ts` - Core agent logic
- `src/agent/agent-manager.ts` - Agent orchestration
- `src/agent/index.ts` - Standalone app entry point
- `src/routes/settle-usdc-split.ts` - Facilitator endpoint
- `test-usdc-payment.mjs` - Test payment script

**Database schema:**
- `merchants` table - Agent configuration
- `affiliates` table - Affiliate info
- `payment_splits` table - Transaction records

---

Built with ❤️ for autonomous Solana affiliate management
