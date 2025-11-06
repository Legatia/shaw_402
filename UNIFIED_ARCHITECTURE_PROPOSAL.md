# Unified x402 Payment Architecture Proposal

## 🎯 Goals

Create a single, cohesive payment system that:
1. **Unifies** x402, Solana Pay, and agent systems
2. **Preserves** all existing functionality
3. **Adds** commission splits to all payment methods
4. **Integrates** ZK privacy
5. **Enables** affiliate tracking across all channels

---

## 🏗️ Proposed Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         CUSTOMER                               │
│                                                                │
│  Payment Method Options:                                       │
│  • Web Browser (x402 headers)                                 │
│  • Mobile Wallet (Solana Pay QR)                              │
│  • Direct Transfer (Legacy, for backwards compat)             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                    x402 UNIFIED SERVER                         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              PAYMENT INGESTION LAYER                     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  • x402 Middleware (existing)                           │ │
│  │  • Solana Pay Routes (enhanced)                         │ │
│  │  • Webhook for direct transfers (new)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         UNIFIED PAYMENT PROCESSOR (new)                  │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  1. Extract: amount, customer, affiliate ID             │ │
│  │  2. Verify: signature, nonce, balance                   │ │
│  │  3. Settle: customer → agent wallet                     │ │
│  │  4. Create: pending split record with ZK commitments    │ │
│  │  5. Grant: access to protected resource                 │ │
│  │  6. Return: content + payment receipt                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              PENDING SPLITS QUEUE                        │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  Database Table:                                         │ │
│  │  • split_id                                             │ │
│  │  • merchant_id                                          │ │
│  │  • payment_tx_signature                                 │ │
│  │  • total_amount (in agent wallet now)                  │ │
│  │  • affiliate_commitment (ZK)                            │ │
│  │  • split_commitment (ZK)                                │ │
│  │  • status: pending/processing/completed                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              AGENT API ENDPOINTS (new)                   │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  GET  /api/agent/pending-splits/:merchantId             │ │
│  │  POST /api/agent/execute-split                          │ │
│  │  POST /api/agent/report-failure                         │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                  PAYMENT PROCESSOR AGENTS                      │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Enhanced Agent (one per merchant)                      │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  NEW BEHAVIOR:                                          │  │
│  │  1. Poll server API (not blockchain)                   │  │
│  │  2. Get pending splits from server                     │  │
│  │  3. Verify agent wallet has funds                      │  │
│  │  4. Calculate splits privately                         │  │
│  │  5. Generate ZK proof (commitments)                    │  │
│  │  6. Encrypt split data                                 │  │
│  │  7. Submit to server                                   │  │
│  │                                                         │  │
│  │  FALLBACK BEHAVIOR (backwards compat):                 │  │
│  │  • Still monitor blockchain for direct transfers       │  │
│  │  • Process direct USDC payments (legacy)               │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                       FACILITATOR                              │
│                                                                │
│  Existing Endpoints:                                           │
│  • POST /verify - Verify payment signature                    │
│  • POST /settle - Settle customer → agent wallet             │
│  • POST /settle-usdc-split - Execute 3-way split             │
│                                                                │
│  Enhanced:                                                     │
│  • Add ZK proof verification (optional)                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                     SOLANA BLOCKCHAIN                          │
│                                                                │
│  Transaction 1 (payment):                                      │
│    Customer → Agent Wallet (100%)                             │
│                                                                │
│  Transaction 2 (split, seconds later):                        │
│    Agent → Platform (commission)                              │
│    Agent → Affiliate (commission)                             │
│    Agent → Merchant (remaining)                               │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Unified Payment Flow

### Step-by-Step (All Payment Methods)

#### Phase 1: Customer Payment
```
1. Customer initiates payment (web, mobile, or direct)
   ↓
2. Payment lands in: AGENT USDC ACCOUNT (not merchant)
   - x402: Customer → Agent (via facilitator settlement)
   - Solana Pay: Customer → Agent (transaction request)
   - Direct: Customer → Agent (direct transfer)
   ↓
3. Server creates pending split record:
   {
     "split_id": "uuid",
     "merchant_id": "merchant_123",
     "payment_tx": "signature",
     "total_amount": "1000000",
     "affiliate_id": "AFF_12345" (if provided),
     "affiliate_commitment": Hash(AFF_12345 + nonce),
     "split_commitment": Hash(platform|affiliate|merchant + nonce),
     "status": "pending"
   }
   ↓
4. Server grants access to content/resource
   ↓
5. Server returns response to customer
```

#### Phase 2: Commission Split (Asynchronous)
```
6. Agent polls server every 5 seconds:
   GET /api/agent/pending-splits/merchant_123
   ↓
7. Server returns pending splits:
   [{
     "split_id": "uuid",
     "total_amount": "1000000",
     "affiliate_commitment": "0x1234...",
     "split_commitment": "0x5678...",
     "timestamp": 1234567890
   }]
   ↓
8. Agent calculates split (private):
   platformFee = 1000000 × 0.02 = 20000
   affiliateCommission = 1000000 × 0.10 = 100000
   merchantAmount = 1000000 - 20000 - 100000 = 880000
   ↓
9. Agent generates ZK proof:
   Proves: platformFee + affiliateCommission + merchantAmount = total
   Without revealing: actual rates
   ↓
10. Agent encrypts split data:
    encrypted = Encrypt({
      platform: { wallet, amount: 20000 },
      affiliate: { wallet, amount: 100000 },
      merchant: { wallet, amount: 880000 }
    })
    ↓
11. Agent submits to server:
    POST /api/agent/execute-split
    {
      "split_id": "uuid",
      "zkProof": {...},
      "encryptedRecipients": {...}
    }
    ↓
12. Server verifies ZK proof:
    - Check commitments match
    - Verify amounts sum correctly
    - Verify constraints satisfied
    ↓
13. Server decrypts recipients:
    recipients = Decrypt(encryptedRecipients)
    ↓
14. Server calls facilitator:
    POST /settle-usdc-split
    {
      "agentPrivateKey": "...",
      "recipients": [
        { wallet: PLATFORM, amount: 20000 },
        { wallet: AFFILIATE, amount: 100000 },
        { wallet: MERCHANT, amount: 880000 }
      ]
    }
    ↓
15. Facilitator executes atomic split on-chain:
    Agent → Platform (2%)
    Agent → Affiliate (10%)
    Agent → Merchant (88%)
    ↓
16. Server updates split record:
    status: "completed"
    settlement_tx: "signature"
    ↓
17. Agent moves to next pending split
```

---

## 📋 Implementation Changes Required

### 1. Database Changes

**New Table: `pending_splits`**
```sql
CREATE TABLE pending_splits (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,  -- 'x402', 'solana-pay', 'direct'
  payment_tx_signature TEXT NOT NULL,
  customer_wallet TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  affiliate_id TEXT,
  affiliate_commitment TEXT NOT NULL,
  split_commitment TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  settlement_tx_signature TEXT,

  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE INDEX idx_pending_splits_merchant ON pending_splits(merchant_id, status);
CREATE INDEX idx_pending_splits_status ON pending_splits(status);
```

**New Table: `zk_proofs`**
```sql
CREATE TABLE zk_proofs (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL,
  proof_data TEXT NOT NULL,
  public_inputs TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at INTEGER,

  FOREIGN KEY (split_id) REFERENCES pending_splits(id)
);
```

**Modify Table: `merchants`**
```sql
-- Add column for payment destination
ALTER TABLE merchants ADD COLUMN payment_destination TEXT DEFAULT 'agent';
-- Options: 'agent' (new unified way) or 'direct' (legacy)
```

### 2. Server Code Changes

**New File: `src/lib/unified-payment-processor.ts`**
```typescript
export class UnifiedPaymentProcessor {
  async processPayment(params: {
    paymentMethod: 'x402' | 'solana-pay' | 'direct';
    merchantId: string;
    customerWallet: string;
    totalAmount: bigint;
    affiliateId?: string;
    transactionSignature: string;
  }): Promise<PendingSplit> {
    // 1. Initialize ZK privacy
    await ZKPrivacy.initializePoseidon();

    // 2. Generate nonce and commitments
    const nonce = ZKPrivacy.generateNonce();
    const affiliateCommitment = params.affiliateId
      ? ZKPrivacy.createAffiliateCommitment(params.affiliateId, nonce)
      : '0';

    // 3. Get merchant config
    const merchant = await affiliateDb.getMerchant(params.merchantId);

    // 4. Calculate split (for commitment only, not executed yet)
    const split = ZKPrivacy.calculateSplitWithCommitments(
      params.totalAmount,
      merchant.platformFeeRate,
      merchant.affiliateFeeRate,
      params.affiliateId,
      nonce
    );

    // 5. Create pending split record
    const pendingSplit = await pendingSplitsDb.create({
      merchantId: params.merchantId,
      paymentMethod: params.paymentMethod,
      paymentTxSignature: params.transactionSignature,
      customerWallet: params.customerWallet,
      totalAmount: params.totalAmount.toString(),
      affiliateId: params.affiliateId,
      affiliateCommitment: split.affiliateCommitment,
      splitCommitment: split.splitCommitment,
      nonce: nonce.toString(),
      status: 'pending',
    });

    return pendingSplit;
  }
}
```

**New File: `src/routes/agent-api.ts`**
```typescript
// GET /api/agent/pending-splits/:merchantId
router.get('/pending-splits/:merchantId', authenticateAgent, async (req, res) => {
  const { merchantId } = req.params;

  const pendingSplits = await pendingSplitsDb.getPending(merchantId);

  res.json({
    success: true,
    data: pendingSplits.map(split => ({
      splitId: split.id,
      totalAmount: split.totalAmount,
      affiliateCommitment: split.affiliateCommitment,
      splitCommitment: split.splitCommitment,
      timestamp: split.createdAt,
    }))
  });
});

// POST /api/agent/execute-split
router.post('/execute-split', authenticateAgent, async (req, res) => {
  const { splitId, zkProof, encryptedRecipients } = req.body;

  // 1. Verify ZK proof
  const isValid = await verifyZKProof(zkProof);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid ZK proof' });
  }

  // 2. Decrypt recipients
  const serverEncryption = ZKPrivacy.createServerEncryption();
  const recipients = serverEncryption.decryptSplitData(encryptedRecipients);

  // 3. Verify amounts sum to total
  const sum = BigInt(recipients.platform.amount) +
              BigInt(recipients.affiliate?.amount || 0) +
              BigInt(recipients.merchant.amount);

  const split = await pendingSplitsDb.get(splitId);
  if (sum !== BigInt(split.totalAmount)) {
    return res.status(400).json({ error: 'Amounts do not sum to total' });
  }

  // 4. Call facilitator to execute split
  const result = await executeSplitViaFacilitator(split.merchantId, recipients);

  // 5. Update split status
  await pendingSplitsDb.update(splitId, {
    status: 'completed',
    processedAt: Date.now(),
    settlementTxSignature: result.signature,
  });

  res.json({
    success: true,
    data: { transactionSignature: result.signature }
  });
});
```

**Modify: `src/lib/x402-middleware.ts`**
```typescript
// After settlement, create pending split
const settlementResult = await this.settlePayment(paymentRequest);

// NEW: Create pending split record
const processor = new UnifiedPaymentProcessor();
await processor.processPayment({
  paymentMethod: 'x402',
  merchantId: getMerchantIdFromRecipient(paymentRequest.payload.recipient),
  customerWallet: paymentRequest.clientPublicKey,
  totalAmount: BigInt(paymentRequest.payload.amount),
  affiliateId: extractAffiliateFromMemo(paymentRequest.memo),
  transactionSignature: settlementResult.transactionSignature,
});
```

**Modify: `src/routes/solana-pay.ts`**
```typescript
// After transaction creation
const serializedTransaction = transaction.serialize(...);

// NEW: Create pending split record (for when tx is confirmed)
const processor = new UnifiedPaymentProcessor();
await processor.processPayment({
  paymentMethod: 'solana-pay',
  merchantId: config.merchantId,
  customerWallet: account,
  totalAmount: BigInt(paymentInfo.amount),
  affiliateId: extractAffiliateFromReference(reference),
  transactionSignature: reference.toString(), // Will update with real sig later
});
```

### 3. Agent System Changes

**Modify: `src/agent/payment-processor.ts`**
```typescript
export class PaymentProcessorAgent {
  // REMOVE: Direct blockchain monitoring
  // REMOVE: private async startPolling()

  // ADD: Server API polling
  private async pollServerAPI(): Promise<void> {
    const poll = async () => {
      if (!this.isMonitoring) return;

      try {
        // Get pending splits from server
        const response = await fetch(
          `${this.config.serverUrl}/api/agent/pending-splits/${this.config.merchantData.merchantId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.agentToken}`
            }
          }
        );

        const { data: pendingSplits } = await response.json();

        // Process each pending split
        for (const split of pendingSplits) {
          await this.processPendingSplit(split);
        }
      } catch (error) {
        console.error('Server polling error:', error);
      }

      // Poll every 5 seconds
      setTimeout(poll, 5000);
    };

    poll();
  }

  // ADD: Process pending split
  private async processPendingSplit(split: PendingSplit): Promise<void> {
    // 1. Verify agent wallet has funds
    const balance = await this.checkAgentBalance();
    if (balance < BigInt(split.totalAmount)) {
      console.error('Insufficient agent balance');
      return;
    }

    // 2. Calculate splits
    const calculation = ZKPrivacy.calculateSplitWithCommitments(
      BigInt(split.totalAmount),
      this.config.merchantData.platformFeeRate,
      this.config.merchantData.affiliateFeeRate,
      split.affiliateId,
      BigInt(split.nonce)
    );

    // 3. Verify commitments match
    const verification = ZKPrivacy.verifySplitCalculation(
      calculation,
      split.affiliateId
    );

    if (!verification.splitValid) {
      console.error('Split commitment verification failed');
      return;
    }

    // 4. Generate ZK proof (for now, just commitments)
    const zkProof = {
      affiliateCommitment: calculation.affiliateCommitment,
      splitCommitment: calculation.splitCommitment,
      publicInputs: {
        totalAmount: split.totalAmount,
        affiliateCommitment: calculation.affiliateCommitment,
        splitCommitment: calculation.splitCommitment,
      }
    };

    // 5. Encrypt split data
    const agentEncryption = ZKPrivacy.createAgentEncryption(
      this.config.merchantData.agentPrivateKey
    );

    const splitData = {
      platform: {
        wallet: this.config.platformWallet,
        amount: calculation.platformFee.toString(),
      },
      affiliate: split.affiliateId ? {
        wallet: await this.getAffiliateWallet(split.affiliateId),
        amount: calculation.affiliateCommission.toString(),
      } : null,
      merchant: {
        wallet: this.config.merchantData.merchantWallet,
        amount: calculation.merchantAmount.toString(),
      }
    };

    const encrypted = agentEncryption.encryptSplitData(
      splitData,
      this.config.serverPublicKey
    );

    // 6. Submit to server
    await fetch(`${this.config.serverUrl}/api/agent/execute-split`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.agentToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        splitId: split.id,
        zkProof,
        encryptedRecipients: encrypted,
      })
    });
  }
}
```

---

## 🎯 Migration Strategy

### Phase 1: Parallel Operation (Week 1-2)
- Deploy new unified system alongside old system
- New payments use unified flow
- Old agent monitoring continues (backwards compat)
- Monitor both systems

### Phase 2: Traffic Migration (Week 3-4)
- Gradually move merchants to unified system
- Update agent configurations
- Test commission splits on all payment methods
- Verify ZK privacy working

### Phase 3: Deprecation (Week 5-6)
- Disable direct blockchain monitoring
- All payments through unified flow
- Remove legacy code
- Full production deployment

---

## ✅ Benefits of Unified Architecture

1. **Single Payment Path**: All payment methods follow same flow
2. **Universal Splits**: Commission splits on every payment
3. **Affiliate Tracking**: Works across web, mobile, and direct
4. **ZK Privacy**: Integrated into core payment flow
5. **Scalability**: Server controls rate limiting, not blockchain polling
6. **Auditability**: Every payment → split linkage in database
7. **Flexibility**: Easy to add new payment methods
8. **Monitoring**: Centralized logging and metrics
9. **Error Handling**: Server can retry failed splits
10. **Extensibility**: Future features (refunds, disputes) easier to add

---

## 📊 Comparison: Current vs Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| Payment methods | 3 isolated systems | Unified ingestion |
| Commission splits | Only direct transfers | All payment methods |
| Agent monitoring | Blockchain (expensive) | Server API (efficient) |
| Affiliate tracking | Only direct transfers | All payment methods |
| ZK privacy | Utilities only | Fully integrated |
| Content delivery | x402 only | All methods |
| Database linkage | Disconnected | Fully linked |
| Error recovery | Agent level only | Server + Agent |
| Scalability | Limited (blockchain) | High (API) |
| Cost | High (RPC calls) | Low (database) |

---

## 🚀 Next Steps

1. **Review** this proposal
2. **Prioritize** features (MVP vs nice-to-have)
3. **Implement** Phase 1 (database + server endpoints)
4. **Test** with one merchant
5. **Migrate** gradually
6. **Monitor** and iterate

---

## ❓ Open Questions

1. **Timing**: Should split happen immediately or batched?
2. **Retry**: How many retries for failed splits?
3. **Partial Success**: What if platform gets paid but affiliate fails?
4. **Refunds**: How to handle split reversal?
5. **Fees**: Who pays gas for split transaction?
6. **Minimum**: Minimum split amount to avoid dust?

---

This unified architecture resolves all the disconnects while preserving existing functionality. Ready to implement?
