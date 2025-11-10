# USDC Settlement Model

## 🎯 Overview

The platform uses a **dual-token model** that combines the best of both worlds:
- **SOL** for one-time merchant registration (barrier to entry, platform revenue)
- **USDC** for ongoing commission settlements (stable, predictable, professional)

This model solves the biggest problem with crypto affiliate programs: **volatility**.

---

## 💰 The Dual-Token Model

### Registration: One-Time SOL Payment

**Merchants pay:** 0.05 SOL (one time)

**Why SOL?**
- ✅ Shows commitment to Solana ecosystem
- ✅ Spam prevention (actual cost barrier)
- ✅ Platform revenue appreciates with SOL price
- ✅ Simple for initial setup (no token accounts needed yet)

**What happens:**
1. Merchant connects Phantom wallet
2. Sends 0.05 SOL to platform wallet
3. Transaction verified on-chain
4. Platform registers merchant

### Commissions: USDC Settlements

**All business operations use:** USDC

**Why USDC?**
- ✅ **Stable value:** 1 USDC = $1 USD always
- ✅ **Predictable budgets:** Merchants know costs
- ✅ **Professional:** Real businesses think in dollars
- ✅ **Tax accounting:** Much easier than volatile tokens
- ✅ **Affiliate trust:** Influencers know what they'll earn

**What happens:**
1. Customer pays 100 USDC to agent wallet
2. Agent splits atomically:
   - Platform: 5 USDC (5%)
   - Affiliate: 15 USDC (15%)
   - Merchant: 80 USDC (80%)
3. All parties receive USDC instantly (~400ms)

---

## 🏗️ Technical Implementation

### Merchant Registration Flow

```typescript
1. Merchant pays 0.05 SOL → Platform wallet (verified on-chain)

2. Platform creates Payment Processor Agent:
   - Generates Solana keypair
   - Creates USDC associated token account for agent
   - Creates USDC associated token account for merchant (if doesn't exist)
   - Funds agent with 0.01 SOL for gas fees

3. Stores in database:
   {
     merchantId: "MER_ABC123",
     agentWallet: "Agent123...",        // SOL address
     agentUSDCAccount: "AgentUSDC...",  // USDC token account
     merchantUSDCAccount: "MerchUSDC...", // Merchant's USDC account
     settlementToken: "USDC",
     usdcMint: "4zMMC...", // Devnet USDC mint
     ...
   }

4. Returns to merchant:
   - Agent wallet address
   - Agent USDC account (where customers pay)
   - Merchant USDC account (where they receive commission)
   - Affiliate recruitment link
```

### Payment Settlement Flow (Phase 2)

```typescript
1. Customer sends 100 USDC to agent USDC account
   - Memo includes: "AFF_12345" (affiliate ID)

2. Payment Processor Agent detects payment (WebSocket):
   - Parses memo for affiliate ID
   - Looks up affiliate USDC account
   - Calculates splits

3. Agent calls facilitator /settle-usdc-split:
   POST /settle-usdc-split
   {
     agentPrivateKey: "base58...",
     usdcMint: "4zMMC...",
     recipients: [
       { publicKey: "PlatformUSDC...", amount: "5000000" },  // 5 USDC
       { publicKey: "AffiliateUSDC...", amount: "15000000" }, // 15 USDC
       { publicKey: "MerchantUSDC...", amount: "80000000" }   // 80 USDC
     ]
   }

4. Facilitator creates atomic SPL token transaction:
   - 3 USDC transfers in single transaction
   - Agent signs (has SOL for gas)
   - Broadcasts to Solana
   - All parties receive USDC instantly

5. Agent records in database:
   {
     txSignature: "5K2...",
     totalAmount: "100000000", // 100 USDC (6 decimals!)
     platformFee: "5000000",
     affiliateCommission: "15000000",
     merchantAmount: "80000000",
     status: "completed"
   }
```

---

## 📊 Database Schema

### Merchants Table

```sql
CREATE TABLE merchants (
  merchant_id TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  merchant_wallet TEXT NOT NULL,              -- SOL address
  agent_wallet TEXT UNIQUE NOT NULL,          -- Agent SOL address
  agent_private_key TEXT NOT NULL,            -- Encrypted

  -- USDC Settlement fields
  settlement_token TEXT DEFAULT 'USDC',
  usdc_mint TEXT NOT NULL,                    -- USDC mint address
  agent_usdc_account TEXT NOT NULL,           -- Agent's USDC token account
  merchant_usdc_account TEXT NOT NULL,        -- Merchant's USDC account

  platform_fee_rate REAL DEFAULT 0.05,        -- 5%
  affiliate_fee_rate REAL DEFAULT 0.15,       -- 15%
  registration_tx_signature TEXT,              -- SOL payment tx
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Payment Splits Table

```sql
CREATE TABLE payment_splits (
  tx_signature TEXT UNIQUE NOT NULL,
  merchant_id TEXT NOT NULL,
  affiliate_id TEXT,
  buyer_wallet TEXT NOT NULL,

  -- All amounts in USDC (6 decimals, not 9!)
  total_amount TEXT NOT NULL,                  -- e.g., "100000000" = 100 USDC
  platform_fee TEXT NOT NULL,                  -- e.g., "5000000" = 5 USDC
  affiliate_commission TEXT NOT NULL,          -- e.g., "15000000" = 15 USDC
  merchant_amount TEXT NOT NULL,               -- e.g., "80000000" = 80 USDC

  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

---

## 🔧 Environment Variables

```bash
# Platform Wallet (receives SOL registration fees)
PLATFORM_WALLET=YourSolanaWallet...
PLATFORM_PRIVATE_KEY=YourBase58PrivateKey...

# Registration Fee (in lamports)
REGISTRATION_FEE=50000000  # 0.05 SOL

# USDC Configuration
# Devnet: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDC_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## 💡 Why This Model Works

### For Merchants

| Aspect | Traditional Platforms | Our USDC Model |
|--------|----------------------|----------------|
| **Setup cost** | $99-299/month | 0.05 SOL one-time (~$5-10) |
| **Commission budgeting** | Volatile if crypto | Stable (USDC = USD) |
| **Accounting** | Complex | Simple (USDC = dollars) |
| **Payout speed** | 30-60 days | Instant (~400ms) |
| **International** | Expensive | Borderless |

**Example Budget:**
```
Merchant wants 1,000 sales/month at $100 each
Traditional: $100,000 revenue → Wait 30 days → Pay $20,000 fees
Our model: Customer pays 100 USDC → Instant 80 USDC to merchant
          Predictable: 1,000 sales = 80,000 USDC guaranteed
```

### For Affiliates

| Aspect | Traditional | Our Model |
|--------|------------|-----------|
| **Payment currency** | Fiat (ACH/wire) | USDC (stable) |
| **Minimum payout** | $50-100 | None (can earn $0.01) |
| **Payout time** | 30-60 days | Instant |
| **Volatility risk** | None | None (USDC = USD) |
| **Global access** | Restricted | Borderless |

**Example Earnings:**
```
Affiliate drives 10 sales @ 100 USDC each
Traditional: Wait 30 days → Get $150 (15%) via wire transfer
Our model: Instant 15 USDC per sale = 150 USDC in wallet immediately
           Can hold as USDC or convert to SOL/fiat
```

### For Platform (You)

**Revenue Streams:**
1. **SOL Registration Fees**
   - 100 merchants × 0.05 SOL = 5 SOL
   - If SOL appreciates: $100 → $500 → $2,500 value growth
   - Hold SOL for upside potential

2. **USDC Transaction Fees**
   - 5% of every transaction
   - Stable, predictable monthly revenue
   - Example: $1M USDC volume = $50,000 USDC monthly

**Best of both:**
- SOL exposure (upside potential)
- USDC stability (operational revenue)

---

## 🚀 Key Technical Components

### SolanaUtils Extensions

```typescript
// Create USDC token accounts
async getOrCreateAssociatedTokenAccount(
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair
): Promise<PublicKey>

// Get USDC balance
async getUSDCBalance(
  owner: PublicKey,
  usdcMint: PublicKey
): Promise<bigint>

// Transfer SOL (for funding agents)
async transferSOL(
  from: Keypair,
  to: PublicKey,
  lamports: number
): Promise<string>

// Atomic USDC split (THE CORE!)
async splitUSDCPayment(
  agentKeypair: Keypair,
  usdcMint: PublicKey,
  recipients: Array<{ owner: PublicKey; amount: bigint }>
): Promise<string>

// Conversions
usdcToHuman(amount: bigint): number  // 6 decimals
humanToUSDC(amount: number): bigint
```

### Facilitator Route

**POST /settle-usdc-split**

```typescript
Body: {
  agentPrivateKey: string,  // Agent signs transaction
  usdcMint: string,         // USDC mint address
  recipients: [
    { publicKey: string, amount: string }, // Platform
    { publicKey: string, amount: string }, // Affiliate
    { publicKey: string, amount: string }  // Merchant
  ]
}

Response: {
  signature: string,
  status: "completed",
  recipients: 3,
  totalAmount: "100000000",
  explorerUrl: "https://explorer.solana.com/tx/..."
}
```

---

## 🎨 Frontend Display

Landing page shows the dual-token model clearly:

```html
💰 Dual-Token Model
- Registration: One-time 0.05 SOL payment
- Commissions: All settled in USDC (stable value)
- Agent Funding: We fund your agent with 0.01 SOL for gas
- Your Customers Pay: In USDC (predictable budgets)

Example: Customer pays 100 USDC
→ Platform gets 5 USDC
→ Affiliate gets 15 USDC
→ You get 80 USDC
```

Results display after registration:
- Merchant ID
- Payment Agent Wallet (SOL) - "Funded with 0.01 SOL for gas fees"
- Agent USDC Account - "Receives Payments"
- Your USDC Account - "Receives Commission"
- Affiliate Recruitment Link
- Settlement Token: **USDC**

---

## 📈 Competitive Advantages

### vs Traditional Affiliate Platforms

**ShareASale, CJ Affiliate, Impact:**
- ❌ 30-60 day payouts
- ❌ $50-100 minimums
- ❌ 20-30% platform fees
- ❌ Complex international payments
- ❌ Opaque tracking

**Our USDC Model:**
- ✅ Instant payouts (~400ms)
- ✅ No minimums (micropayments)
- ✅ 5% platform fee
- ✅ Borderless (Solana)
- ✅ Fully transparent (on-chain)

### vs Other Crypto Platforms

**Hypothetical SOL-only affiliate programs:**
- ❌ Volatile commission rates
- ❌ Hard to budget
- ❌ Accounting nightmare
- ❌ Merchants won't adopt

**Our USDC Model:**
- ✅ Stable commission rates
- ✅ Easy budgeting
- ✅ Simple accounting
- ✅ Professional businesses will adopt

---

## 🎯 Target Market

### Perfect For:

1. **NFT Marketplaces**
   - Already use Solana
   - Customers have USDC
   - Want influencer marketing
   - Example: "Promote our NFT drop, earn 10 USDC per mint"

2. **DeFi Protocols**
   - Lending, DEX, yield aggregators
   - Want referral programs
   - Example: "Refer users, earn 5% of their trading fees in USDC"

3. **Web3 SaaS**
   - Analytics tools, wallets, services
   - Subscription-based revenue
   - Example: "Monthly subscription = monthly recurring USDC commission"

4. **Crypto Gaming**
   - Play-to-earn games
   - In-game purchases
   - Example: "Streamer gets 15 USDC per player signup"

### Not For:

1. Traditional e-commerce (customers don't have USDC)
2. Fiat-only businesses
3. Non-crypto merchants

---

## 🚧 Future Enhancements

### Phase 2: Payment Processor Agent

Build autonomous agents that:
- Monitor agent USDC accounts via WebSocket
- Parse transaction memos for affiliate IDs
- Automatically trigger /settle-usdc-split
- Handle retries and error cases

### Phase 3: Advanced Features

1. **Multi-currency support**
   - USDT, EURC, other stablecoins
   - Merchant chooses settlement currency

2. **Dynamic commission rates**
   - Time-based campaigns
   - Performance bonuses
   - Tiered affiliate levels

3. **On-chain program**
   - Move logic to Solana program (Anchor)
   - Trustless escrow
   - Programmable vesting

4. **Analytics dashboard**
   - Real-time conversion tracking
   - Affiliate leaderboards
   - Revenue forecasting

---

## 📊 Economics Example

### Year 1 Projections

**Merchant Registrations:**
- 100 merchants × 0.05 SOL = 5 SOL revenue
- SOL at $100 = $500 initial value
- SOL appreciates to $500 = $2,500 value (5x gain)

**Transaction Volume:**
- 100 merchants × $10,000/month = $1M USDC/month
- Platform fee (5%) = $50,000 USDC/month
- Annual = $600,000 USDC stable revenue

**Total Platform Value:**
- SOL holdings: $2,500 (appreciation potential)
- Annual USDC revenue: $600,000 (stable operations)
- Combined: $602,500 first year

### Scaling to 1,000 Merchants

**Registration Revenue:**
- 1,000 × 0.05 SOL = 50 SOL
- At $500/SOL = $25,000 value

**Transaction Revenue:**
- $10M USDC monthly volume
- 5% fee = $500,000/month
- Annual = $6M USDC revenue

---

## 🎬 Getting Started

1. **Set environment variables:**
```bash
cp env.example .env
# Edit .env and set:
# - PLATFORM_WALLET (your Solana address)
# - PLATFORM_PRIVATE_KEY (your base58 private key)
# - USDC_MINT_ADDRESS (devnet: 4zMMC...)
```

2. **Fund platform wallet:**
```bash
# Get devnet SOL
solana airdrop 2 <PLATFORM_WALLET> --url devnet

# Get devnet USDC (use faucet)
# https://spl-token-faucet.com/
```

3. **Start server:**
```bash
npm run build
npm run dev:server
```

4. **Test registration:**
- Open http://localhost:3000
- Connect Phantom wallet (devnet)
- Register with 0.05 SOL
- Receive agent USDC accounts
- Start recruiting affiliates!

---

## 🔐 Security Notes

### Production Checklist

1. **Encrypt agent private keys**
   - Use AWS KMS, HashiCorp Vault, or similar
   - Never store raw keys in database

2. **Secure platform private key**
   - Environment variable only
   - Never commit to git
   - Rotate periodically

3. **Verify USDC transfers**
   - Always confirm on-chain before crediting
   - Check exact amounts
   - Validate USDC mint address

4. **Rate limiting**
   - Prevent registration spam
   - Limit settlement API calls

5. **Monitoring**
   - Alert on failed splits
   - Track agent SOL balances (need gas)
   - Monitor USDC volumes

---

Built with ❤️ using Solana, USDC, and SPL Tokens
