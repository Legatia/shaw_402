# Solana Affiliate Program Management Platform

A decentralized affiliate program management system built on Solana using the 402 payment protocol for instant, transparent commission payouts.

## 🎯 Overview

This platform enables merchants to:
- Register their business with a one-time SOL payment
- Get a dedicated Payment Processor Agent with its own Solana wallet
- Recruit affiliates through a unique signup link
- Automatically split payments between platform, affiliates, and merchants
- Track all transactions on-chain with full transparency

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         MERCHANT LANDING PAGE           │
│   - Connect Phantom Wallet              │
│   - Pay 0.05 SOL Registration Fee       │
│   - Get Agent Wallet & Affiliate Link   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│         BACKEND API SERVER              │
│                                         │
│  POST /merchant/register                │
│  GET  /merchant/:id                     │
│  POST /merchant/affiliate/register      │
│  GET  /api/config                       │
│                                         │
│  📊 Affiliate Database (SQLite)         │
│     - merchants table                   │
│     - affiliates table                  │
│     - payment_splits table              │
│                                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│    PAYMENT PROCESSOR AGENTS (Future)    │
│  - Monitor agent wallet                 │
│  - Detect incoming payments             │
│  - Trigger 402 splits                   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌──────────┴───────────┐
        ▼          ▼           ▼
   [Platform]  [Affiliate]  [Merchant]
     5%          15%          80%
```

## 📋 What's Implemented

### ✅ Phase 1: Merchant Registration (COMPLETE)

1. **Landing Page** (`/public/index.html`)
   - Beautiful, responsive UI
   - Phantom wallet integration
   - Real-time payment processing
   - Configuration loaded from backend

2. **Backend API** (`/src/routes/merchant.ts`)
   - `POST /merchant/register` - Register new merchant
   - `GET /merchant/:merchantId` - Get merchant details
   - `GET /merchant/:merchantId/affiliates` - List affiliates
   - `POST /merchant/affiliate/register` - Register affiliate
   - `GET /api/config` - Frontend configuration

3. **Database Layer** (`/src/lib/affiliate-database.ts`)
   - Merchants table (business info, agent wallet, fees)
   - Affiliates table (referral codes, earnings)
   - Payment splits table (transaction history)

4. **Merchant Registration Flow**
   - Merchant connects Phantom wallet
   - Pays 0.05 SOL to platform wallet
   - Backend verifies payment on-chain
   - Generates Payment Processor Agent keypair
   - Returns affiliate recruitment link
   - Merchant can start recruiting affiliates

### 🔜 Phase 2: Payment Processor Agents (TODO)

**Next steps to implement:**

1. **Create Payment Processor Agent Class** (`/src/agent/payment-processor.ts`)
   ```typescript
   class PaymentProcessorAgent {
     - WebSocket subscription to agent wallet
     - Parse incoming transaction memos for affiliate ID
     - Calculate platform/affiliate/merchant splits
     - Trigger 402 settlement endpoint
     - Record transaction in database
   }
   ```

2. **Multi-Party 402 Settlement** (Extend facilitator)
   ```typescript
   POST /settle-split
   - Takes agent private key
   - Takes 3 recipients (platform, affiliate, merchant)
   - Creates atomic transaction with 3 transfers
   - Signs with agent wallet
   - Broadcasts to Solana
   ```

3. **Agent Lifecycle Management**
   - Spawn agent when merchant registers
   - Keep agents running (PM2 or Docker)
   - Monitor agent health
   - Restart on failure

4. **Transaction Memo Format**
   ```
   Customer payment includes memo: "AFF_<affiliate_id>"
   Agent reads memo → Looks up affiliate wallet → Splits payment
   ```

## 🚀 Quick Start

### 1. Environment Setup

Copy and configure environment variables:

```bash
cp env.example .env
```

Edit `.env` and set:

```env
# Your platform's wallet to receive registration fees
PLATFORM_WALLET=<your_solana_wallet_address>

# Registration fee (default 0.05 SOL = 50000000 lamports)
REGISTRATION_FEE=50000000

# Base URL for affiliate links
PLATFORM_BASE_URL=http://localhost:3000

# Solana network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Start Server

```bash
npm run dev:server
```

The landing page will be available at: `http://localhost:3000`

### 5. Test Merchant Registration

1. Open `http://localhost:3000` in browser
2. Install Phantom wallet extension
3. Switch to Devnet in Phantom
4. Get devnet SOL: `solana airdrop 1 <your_wallet> --url devnet`
5. Connect wallet on landing page
6. Enter business name
7. Click "Pay 0.05 SOL & Register"
8. Approve transaction in Phantom
9. Receive merchant ID and affiliate link!

## 📊 Database Schema

### Merchants Table

```sql
CREATE TABLE merchants (
  merchant_id TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  merchant_wallet TEXT NOT NULL,
  agent_wallet TEXT UNIQUE NOT NULL,      -- Payment Processor Agent address
  agent_private_key TEXT NOT NULL,        -- Agent's private key (encrypted)
  platform_fee_rate REAL DEFAULT 0.05,    -- 5%
  affiliate_fee_rate REAL DEFAULT 0.15,   -- 15%
  registration_tx_signature TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Affiliates Table

```sql
CREATE TABLE affiliates (
  affiliate_id TEXT UNIQUE NOT NULL,
  merchant_id TEXT NOT NULL,
  affiliate_wallet TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  total_earned TEXT DEFAULT '0',          -- bigint as string (lamports)
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Payment Splits Table

```sql
CREATE TABLE payment_splits (
  tx_signature TEXT UNIQUE NOT NULL,
  merchant_id TEXT NOT NULL,
  affiliate_id TEXT,                      -- NULL if no affiliate
  buyer_wallet TEXT NOT NULL,
  total_amount TEXT NOT NULL,             -- Total payment in lamports
  platform_fee TEXT NOT NULL,             -- Platform's cut
  affiliate_commission TEXT NOT NULL,     -- Affiliate's cut
  merchant_amount TEXT NOT NULL,          -- Merchant's cut
  status TEXT DEFAULT 'pending',          -- pending, completed, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

## 🔐 Security Considerations

### Current Implementation

1. **Payment Verification**: Backend verifies registration payment on Solana blockchain
2. **Agent Key Storage**: Private keys stored in SQLite (should be encrypted in production)
3. **CORS**: Enabled for local development

### Production Recommendations

1. **Encrypt Agent Keys**: Use encryption at rest for agent private keys
2. **Use Vault**: Consider HashiCorp Vault or AWS KMS for key management
3. **Rate Limiting**: Add rate limiting on registration endpoint
4. **HTTPS Only**: Enforce HTTPS in production
5. **Webhook Authentication**: Sign webhooks to merchants with HMAC
6. **Fraud Detection**: Monitor for suspicious registration patterns
7. **Key Rotation**: Implement periodic agent key rotation

## 💡 Use Cases

### 1. NFT Marketplace

```
- Merchant: NFT marketplace
- Affiliate: Crypto influencer
- Customer: Buys NFT for 10 SOL
- Payment: 0.5 SOL platform fee, 1.5 SOL affiliate, 8 SOL merchant
- All instant, on-chain
```

### 2. DeFi Protocol

```
- Merchant: Lending protocol
- Affiliate: DeFi educator
- Customer: Deposits 100 SOL
- Payment: 5 SOL platform fee, 15 SOL affiliate, 80 SOL protocol
```

### 3. SaaS on Solana

```
- Merchant: Web3 analytics tool
- Affiliate: Developer community
- Customer: Subscribes for 1 SOL/month
- Payment: Instant split every month
```

## 🎨 Features vs Traditional Platforms

| Feature | Traditional | This Platform |
|---------|------------|---------------|
| Payout Speed | 30-60 days | Instant (~400ms) |
| Minimum Payout | $50-100 | No minimum |
| Platform Fee | 20-30% | 5% (configurable) |
| Transparency | Opaque | Fully on-chain |
| Setup Time | Days/weeks | Minutes |
| International | Complex | Borderless |
| Commission Models | Limited | Fully flexible |

## 📈 Future Enhancements

### Phase 3: Advanced Features

1. **Multi-Tier Affiliates**
   - Sub-affiliates (MLM structure)
   - Different commission rates per tier

2. **Performance Bonuses**
   - Bonus payouts for top performers
   - Time-based campaigns

3. **SPL Token Support**
   - Accept USDC, USDT payments
   - Multi-token commission payouts

4. **Analytics Dashboard**
   - Real-time conversion tracking
   - Affiliate leaderboard
   - Revenue charts

5. **Smart Contract Integration**
   - On-chain affiliate program (Anchor)
   - Trustless commission guarantees
   - Programmable vesting schedules

6. **White-Label Solution**
   - Merchants can customize their affiliate portal
   - Custom domains
   - Branded recruitment pages

## 🐛 Known Limitations

1. **Payment Verification**: Current implementation is simplified. Production should verify exact transfer amounts.
2. **Agent Management**: Agents not yet implemented - need to build autonomous monitoring.
3. **Error Handling**: Need better retry logic for failed splits.
4. **Key Security**: Agent keys stored unencrypted (demo only).

## 📞 API Reference

### POST /merchant/register

Register a new merchant and create their Payment Processor Agent.

**Request Body:**
```json
{
  "businessName": "My NFT Store",
  "merchantWallet": "8xJ...",
  "txSignature": "5K2...",
  "platformFeeRate": 0.05,
  "affiliateFeeRate": 0.15
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "MER_A1B2C3D4",
    "businessName": "My NFT Store",
    "agentWallet": "9pL...",
    "affiliateSignupUrl": "http://localhost:3000/affiliate/signup?merchant=MER_A1B2C3D4",
    "platformFeeRate": 0.05,
    "affiliateFeeRate": 0.15,
    "status": "active"
  }
}
```

### GET /merchant/:merchantId

Get merchant details and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "MER_A1B2C3D4",
    "businessName": "My NFT Store",
    "agentWallet": "9pL...",
    "stats": {
      "totalAffiliates": 5,
      "totalTransactions": 100,
      "totalVolume": "50000000000",
      "totalMerchantEarnings": "40000000000"
    }
  }
}
```

### POST /merchant/affiliate/register

Register a new affiliate for a merchant.

**Request Body:**
```json
{
  "merchantId": "MER_A1B2C3D4",
  "affiliateWallet": "7hK..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affiliateId": "AFF_X1Y2Z3",
    "referralCode": "A1B2C3D4E5",
    "referralUrl": "http://localhost:3000/pay?merchant=MER_A1B2C3D4&ref=A1B2C3D4E5"
  }
}
```

## 🤝 Contributing

To add Payment Processor Agent functionality:

1. Create `/src/agent/payment-processor.ts`
2. Implement WebSocket monitoring of agent wallet
3. Add memo parsing logic
4. Create `/src/facilitator/routes/settle-split.ts`
5. Test with devnet transactions

## 📄 License

MIT

---

Built with ❤️ using Solana, 402 Protocol, and TypeScript
