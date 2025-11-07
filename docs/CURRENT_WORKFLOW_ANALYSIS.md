# Current System Workflow Analysis

## 🎯 Use Case Simulations

Let me trace through the actual workflows in the current system to identify what works and what's disconnected.

---

## Use Case 1: Web Customer Uses x402 to Access Premium Content

### Actors:
- **Customer**: Web browser user
- **Merchant**: Content provider
- **Facilitator**: Payment verifier/settler
- **Database**: Nonce tracking

### Current Flow:

```
1. Customer visits: GET /api/premium-data
   ↓
2. Server responds: HTTP 402 Payment Required
   {
     "accepts": [{
       "amount": "10000000",  // 0.01 SOL
       "payTo": "MERCHANT_WALLET",
       "asset": "SOL",
       "network": "solana-devnet"
     }]
   }
   ↓
3. Customer's wallet/SDK creates payment:
   - Generate nonce
   - Create payload (amount, recipient, nonce, etc)
   - Sign payload with private key
   - Create Solana transaction (Customer → Merchant)
   - Sign transaction
   ↓
4. Customer sends: GET /api/premium-data
   Headers: {
     "X-Payment": "{payload, signature, signedTransaction}"
   }
   ↓
5. x402 Middleware intercepts:
   ↓
   5a. Calls Facilitator: POST /verify
       - Validates signature
       - Checks nonce unused
       - Marks nonce as used
       → Returns: { isValid: true }
   ↓
   5b. Calls Facilitator: POST /settle
       - Deserializes customer's signed transaction
       - Facilitator adds signature as fee payer
       - Broadcasts to Solana blockchain
       - Customer's SOL → Merchant (INSTANT)
       → Returns: { status: "settled", transactionSignature: "..." }
   ↓
6. Middleware attaches payment info to request:
   req.payment = {
     verified: true,
     amount: "10000000",
     recipient: "MERCHANT_WALLET",
     transactionSignature: "5eykt..."
   }
   ↓
7. Route handler executes:
   res.json({
     message: "Premium data accessed",
     data: { secret: "premium content" },
     payment: req.payment
   })
```

### What Happens:
✅ Payment verified
✅ Transaction settled on-chain
✅ Customer's SOL → Merchant wallet (INSTANT)
✅ Content delivered
✅ Facilitator paid gas fees

### What Doesn't Happen:
❌ No commission split
❌ No affiliate tracking
❌ No agent involvement
❌ Payment goes directly to merchant (100%)

---

## Use Case 2: Mobile Customer Uses Solana Pay

### Actors:
- **Customer**: Mobile wallet user (Phantom, Solflare)
- **Merchant**: Content provider
- **Server**: QR code generator

### Current Flow:

```
1. Merchant generates QR code:
   GET /api/solana-pay/premium-data/qr
   ↓
2. Server creates Solana Pay URL:
   solana:https://myserver.com/api/solana-pay/premium-data
   ↓
3. Server returns QR code (PNG/SVG)
   ↓
4. Customer scans QR with mobile wallet
   ↓
5. Wallet makes GET request:
   GET /api/solana-pay/premium-data
   ↓
6. Server responds:
   {
     "label": "x402 Payment Server",
     "icon": "https://..."
   }
   ↓
7. Wallet makes POST request:
   POST /api/solana-pay/premium-data
   Body: { "account": "CUSTOMER_PUBKEY" }
   ↓
8. Server creates transaction:
   - SystemProgram.transfer(Customer → Merchant)
   - Adds reference key (for tracking)
   - Creates nonce for replay protection
   - Serializes unsigned transaction
   ↓
9. Server returns:
   {
     "transaction": "base64_encoded_tx",
     "message": "Unlock premium data"
   }
   ↓
10. Wallet deserializes transaction:
    - Shows user: "Send 0.01 SOL to MERCHANT"
    - User approves
    - Wallet signs with customer's key
    - Wallet broadcasts to Solana
    ↓
11. Transaction confirmed on-chain:
    Customer's SOL → Merchant (INSTANT)
    ↓
12. Customer can verify:
    GET /api/solana-pay/premium-data/status/REFERENCE_KEY
    → { status: "confirmed", signature: "..." }
```

### What Happens:
✅ QR code generated
✅ Transaction created
✅ Payment broadcast by wallet
✅ On-chain settlement (Customer → Merchant)
✅ Payment tracking via reference

### What Doesn't Happen:
❌ No content delivery (payment separate from access)
❌ No commission split
❌ No affiliate tracking
❌ No agent involvement
❌ No integration with x402 protected routes

### The Problem:
Solana Pay is a **payment mechanism only**. It doesn't:
- Deliver protected content
- Track what was purchased
- Link payment to specific resource access
- Integrate with x402 middleware

---

## Use Case 3: Agent System Monitors Direct USDC Payments

### Actors:
- **Customer**: Sends USDC directly to agent wallet
- **Agent**: Monitors blockchain, calculates splits
- **Facilitator**: Executes atomic USDC split
- **Platform**: Receives commission
- **Affiliate**: Receives commission (if memo included)
- **Merchant**: Receives remaining amount

### Current Flow:

```
1. Merchant registers on platform:
   POST /merchant/register
   {
     "businessName": "Acme Corp",
     "merchantWallet": "MERCHANT_WALLET",
     "platformFeeRate": 0.02,      // 2%
     "affiliateFeeRate": 0.10       // 10%
   }
   ↓
2. Server creates:
   - Agent keypair (for this merchant)
   - Agent USDC account
   - Stores in database
   ↓
3. Agent Manager starts agent:
   - Loads merchant config from DB
   - Agent polls blockchain every 5 seconds
   - Monitors: Agent's USDC account
   ↓
4. Customer sends USDC (OUTSIDE OF x402):
   Transfer: 100 USDC
   From: CUSTOMER_WALLET
   To: AGENT_USDC_ACCOUNT
   Memo: "AFF_12345"  (optional affiliate ID)
   ↓
5. Agent detects payment:
   - Parses transaction
   - Extracts amount: 100 USDC
   - Extracts memo: "AFF_12345"
   ↓
6. Agent calculates split:
   platformFee = 100 × 0.02 = 2 USDC
   affiliateCommission = 100 × 0.10 = 10 USDC
   merchantAmount = 100 - 2 - 10 = 88 USDC
   ↓
7. Agent looks up affiliate:
   - Query DB: WHERE referral_code = "AFF_12345"
   - Get affiliate's USDC account
   ↓
8. Agent calls Facilitator:
   POST /settle-usdc-split
   {
     "agentPrivateKey": "...",
     "usdcMint": "...",
     "recipients": [
       { "publicKey": "PLATFORM_WALLET", "amount": "2000000" },
       { "publicKey": "AFFILIATE_WALLET", "amount": "10000000" },
       { "publicKey": "MERCHANT_WALLET", "amount": "88000000" }
     ]
   }
   ↓
9. Facilitator executes ATOMIC split:
   - Creates transaction with 3 SPL token transfers
   - Agent USDC Account → Platform (2 USDC)
   - Agent USDC Account → Affiliate (10 USDC)
   - Agent USDC Account → Merchant (88 USDC)
   - Signs with agent's key
   - Broadcasts to Solana
   ↓
10. Agent records in database:
    - Transaction signature
    - Split amounts
    - Updates affiliate earnings
```

### What Happens:
✅ Direct USDC payments monitored
✅ Commission splits calculated
✅ Atomic 3-way split executed
✅ Affiliate commissions tracked
✅ Database records maintained

### What Doesn't Happen:
❌ Not integrated with x402 payments
❌ Not integrated with Solana Pay
❌ Customer must know agent's USDC account
❌ No protected content delivery
❌ No payment gating

---

## 🚨 Critical System Disconnects

### Disconnect #1: Payment Methods Isolated

```
x402 Web Payments          Solana Pay Mobile        Agent USDC Monitoring
      ↓                           ↓                          ↓
 Customer → Merchant          Customer → Merchant      Customer → Agent
   (100% SOL)                  (100% SOL)              (USDC split)
      ↓                           ↓                          ↓
No commission split         No content access        No x402 integration
```

### Disconnect #2: No Unified Payment Flow

Current system has **3 separate payment flows**:
1. **x402**: Payment → Verification → Settlement → Content
2. **Solana Pay**: QR → Transaction → Broadcast (no content link)
3. **Agent**: Monitor → Detect → Split (no x402 link)

### Disconnect #3: Agent System Orphaned

Agents work completely independently:
- Monitor blockchain directly (not server)
- Don't know about x402 payments
- Don't know about Solana Pay payments
- Only process direct USDC transfers to agent wallets

### Disconnect #4: ZK Privacy Not Integrated

ZK utilities exist but:
- No server endpoints to use them
- Agents don't generate proofs
- No commitment verification
- No encrypted communication

---

## 📊 Feature Matrix - What Works Where?

| Feature | x402 Web | Solana Pay | Agent System | ZK Privacy |
|---------|----------|------------|--------------|------------|
| Payment verification | ✅ | ✅ | ✅ | ❌ |
| On-chain settlement | ✅ | ✅ | ✅ | ❌ |
| Content delivery | ✅ | ❌ | ❌ | ❌ |
| Commission splits | ❌ | ❌ | ✅ | ❌ |
| Affiliate tracking | ❌ | ❌ | ✅ | ❌ |
| QR code payments | ❌ | ✅ | ❌ | ❌ |
| Mobile wallet support | ❌ | ✅ | ❌ | ❌ |
| Protected routes | ✅ | ❌ | ❌ | ❌ |
| Privacy protection | ❌ | ❌ | ❌ | 🟡 (utilities only) |
| Server integration | ✅ | 🟡 (partial) | ❌ | ❌ |

✅ = Fully implemented
🟡 = Partially implemented
❌ = Not implemented

---

## 🔄 Data Flow Gaps

### Gap 1: x402 → Agent Communication
```
Current:
x402 payment → Merchant wallet (100%)
Agent → Monitoring unrelated wallets

Needed:
x402 payment → Server → Pending split record → Agent polls → Execute split
```

### Gap 2: Solana Pay → Content Delivery
```
Current:
Solana Pay → Payment broadcast
No link to what was purchased

Needed:
Solana Pay → Payment verification → Content delivery API
```

### Gap 3: Affiliate ID Transmission
```
Current:
x402: No memo field
Solana Pay: No memo field
Agent: Memo in direct USDC transfer only

Needed:
Universal memo/affiliate tracking across all payment methods
```

---

## 💾 Database State Analysis

### What's Stored:

**Merchants Table:**
```sql
merchant_id, business_name, merchant_wallet, agent_wallet,
agent_private_key, platform_fee_rate, affiliate_fee_rate,
agent_usdc_account, merchant_usdc_account
```

**Affiliates Table:**
```sql
affiliate_id, referral_code, affiliate_wallet,
total_referrals, total_earnings
```

**Payment Splits Table:**
```sql
tx_signature, merchant_id, affiliate_id, buyer_wallet,
total_amount, platform_fee, affiliate_commission, merchant_amount
```

**Nonces Table (x402):**
```sql
nonce, client_public_key, amount, recipient, resource_id,
transaction_signature, used_at
```

### What's Missing:

❌ **Pending Splits Table**
```sql
-- Needed for agent polling
split_id, merchant_id, payment_tx_signature, total_amount,
affiliate_id, status, created_at
```

❌ **ZK Proofs Table**
```sql
-- Needed for privacy
proof_id, split_id, proof_data, public_inputs,
verified, verification_timestamp
```

❌ **Payment→Split Link**
```
No way to connect:
- x402 payment (nonces table)
- To pending split (doesn't exist)
- To agent processing (happens independently)
```

---

## 🎭 Actor Communication Matrix

### Who Talks to Who:

```
        Customer  Server  Facilitator  Agent  Database  Blockchain
Customer    -       ✅        ❌        ❌       ❌         ✅
Server      ✅      -         ✅        ❌       ✅         ❌
Facilitator ❌      ✅        -         ❌       ✅         ✅
Agent       ❌      ❌        ✅        -        ✅         ✅
```

### Problems:
- ❌ Server and Agent don't communicate
- ❌ Agent monitors blockchain directly (should poll server)
- ❌ No API for agent to get pending splits from server

---

## 🔧 What Actually Works End-to-End

### ✅ Scenario A: Simple x402 Payment (No Splits)
```
1. Customer accesses protected route
2. Pays via x402 header
3. Payment verified & settled
4. Customer → Merchant (100%)
5. Content delivered
```
**Status: WORKS**

### ❌ Scenario B: x402 with Commission Split
```
1. Customer accesses protected route
2. Pays via x402 header
3. Payment verified & settled
4. Customer → Merchant (100%)  ← PROBLEM: Should split
5. Content delivered
6. Agent never knows about this payment ← PROBLEM: Disconnected
```
**Status: BROKEN**

### ❌ Scenario C: Solana Pay with Content Access
```
1. Customer scans QR code
2. Pays via mobile wallet
3. Payment settles on-chain
4. Customer → Merchant (100%)
5. ??? How does customer get content? ← PROBLEM: No link
```
**Status: BROKEN**

### ✅ Scenario D: Direct USDC to Agent (No x402)
```
1. Customer sends USDC to agent wallet directly
2. Agent detects payment
3. Agent calculates split
4. Agent calls facilitator
5. Atomic 3-way split executed
6. ??? What did customer buy? ← PROBLEM: No content delivery
```
**Status: PARTIAL (splits work, but no content)

---

## 🎯 Core Architecture Problem

The system has **THREE INDEPENDENT SUBSYSTEMS** that don't talk to each other:

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 1                              │
│                   x402 Web Payments                         │
│   Customer → Server → Facilitator → Merchant               │
│        ↓                                                     │
│   Content Delivery                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 2                              │
│                 Solana Pay Mobile                           │
│   Customer → QR → Wallet → Blockchain → Merchant           │
│   (No content link)                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 3                              │
│              Agent Commission Splits                        │
│   Customer → Agent Wallet → Agent Detects →                │
│   Facilitator Splits → Platform/Affiliate/Merchant          │
│   (No x402 link, no Solana Pay link)                       │
└─────────────────────────────────────────────────────────────┘

         ↑
         NO COMMUNICATION BETWEEN SUBSYSTEMS
```

---

## 🚀 What Needs to Happen: Unified Architecture

See next section for proposed redesign...
