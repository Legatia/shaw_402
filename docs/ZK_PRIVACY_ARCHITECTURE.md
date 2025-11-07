# Zero-Knowledge Enhanced x402 Payment System

## 🔒 Privacy Goals

The ZK integration provides:

1. **Private Commission Rates** - Merchant commission rates remain confidential
2. **Anonymous Affiliate Tracking** - Affiliate identities hidden from public blockchain
3. **Verifiable Payment Splits** - Prove correctness without revealing amounts
4. **Hidden Revenue Analytics** - Private merchant earnings tracking
5. **Selective Disclosure** - Reveal only necessary information to parties involved

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER                                  │
│                                                                     │
│  • Pays via x402 protocol (with optional affiliate memo)           │
│  • Payment amount is public (required by blockchain)               │
│  • Affiliate ID encrypted in payment memo                          │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      x402 SERVER                                    │
│                                                                     │
│  • Receives x402 payment                                           │
│  • Decrypts affiliate ID from memo (server-side)                   │
│  • Stores payment record with encrypted affiliate reference        │
│  • Creates pending split with ZK commitment                        │
│  • Grants access to protected resource                             │
│                                                                     │
│  Pending Split Record:                                             │
│  {                                                                  │
│    paymentId: "uuid",                                              │
│    merchantId: "merchant_123",                                     │
│    totalAmount: "1000000",  // Public (USDC microunits)           │
│    affiliateCommitment: Hash(affiliateId + nonce),  // Hidden     │
│    splitCommitment: Hash(platform|affiliate|merchant + nonce),     │
│    timestamp: 1234567890,                                          │
│    status: "pending"                                               │
│  }                                                                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PAYMENT PROCESSOR AGENT (ZK-Enhanced)                  │
│                                                                     │
│  1. Poll Server API: GET /api/pending-splits/:merchantId           │
│     Response: [{ paymentId, totalAmount, commitments, ... }]       │
│                                                                     │
│  2. Retrieve Private Data (Agent has access):                      │
│     - Merchant commission rates (from secure config)               │
│     - Affiliate ID (decrypt from commitment using agent key)       │
│     - Platform fee structure                                       │
│                                                                     │
│  3. Calculate Splits (Off-chain, private):                         │
│     platformFee = totalAmount × platformRate                       │
│     affiliateCommission = totalAmount × affiliateRate              │
│     merchantAmount = totalAmount - platformFee - affiliateCommission│
│                                                                     │
│  4. Generate ZK Proof:                                             │
│     Prove: "I know (rates, affiliateId) such that:"                │
│       • platformFee + affiliateCommission + merchantAmount = total │
│       • 0 ≤ platformRate ≤ 0.10 (max 10%)                         │
│       • 0 ≤ affiliateRate ≤ 0.30 (max 30%)                        │
│       • Hash(affiliateId + nonce) = affiliateCommitment            │
│       • Hash(splits + nonce) = splitCommitment                     │
│                                                                     │
│     Without revealing: actual rates, affiliate identity, amounts   │
│                                                                     │
│  5. Submit to Server: POST /api/execute-split                      │
│     {                                                               │
│       paymentId: "uuid",                                           │
│       zkProof: { proof, publicInputs },                            │
│       encryptedRecipients: [                                       │
│         { wallet: Encrypt(platformWallet), amount: Encrypt(fee) }, │
│         { wallet: Encrypt(affiliateWallet), amount: Encrypt(comm) },│
│         { wallet: Encrypt(merchantWallet), amount: Encrypt(amt) }  │
│       ]                                                             │
│     }                                                               │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    x402 SERVER (Verification)                       │
│                                                                     │
│  1. Verify ZK Proof:                                               │
│     - Check proof is valid for the payment                         │
│     - Verify split commitments match                               │
│     - Ensure constraints satisfied (rates in range, sum correct)   │
│                                                                     │
│  2. Decrypt Recipients (server has decryption key):                │
│     - Extract recipient wallets and amounts                        │
│     - Verify amounts sum to total payment                          │
│                                                                     │
│  3. Call Facilitator: POST /settle-usdc-split                      │
│     {                                                               │
│       agentPrivateKey: "...",                                      │
│       usdcMint: "...",                                             │
│       recipients: [{ publicKey, amount }, ...]                     │
│     }                                                               │
│                                                                     │
│  4. Record on-chain settlement (public):                           │
│     - Transaction signature visible                                │
│     - Recipient addresses visible (but unlinkable to affiliates)   │
│     - Individual amounts visible                                   │
│     - BUT: Commission rates and affiliate identity remain private  │
│                                                                     │
│  5. Store proof in database for audit:                             │
│     - ZK proof can be verified later                               │
│     - Commitment opening available to authorized parties           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Privacy Properties

### What Remains Private:

1. **Commission Rates**
   - Exact platform fee percentage (e.g., 2%)
   - Exact affiliate commission percentage (e.g., 10%)
   - Merchant's negotiated rates
   - Competitive information protected

2. **Affiliate Identity**
   - Link between affiliate ID and wallet address
   - Affiliate's real identity
   - Which affiliates are most successful
   - Competitive affiliate intelligence

3. **Revenue Breakdown**
   - Exact commission amounts (observers see total only)
   - Merchant's actual earnings after splits
   - Platform's fee collection per merchant
   - Affiliate's commission per transaction

### What Remains Public:

1. **Total Payment Amount** - Required by blockchain for verification
2. **Transaction Signatures** - Blockchain requirement
3. **Recipient Addresses** - But unlinkable to roles (platform/affiliate/merchant)
4. **Timing Information** - When payments occur

### Who Can See What:

| Information | Customer | Merchant | Affiliate | Platform | Public |
|------------|----------|----------|-----------|----------|--------|
| Payment Amount | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commission Rates | ❌ | ✅ | ❌ | ✅ | ❌ |
| Affiliate Identity | ❌ | ❌ | ✅ | ✅ | ❌ |
| Split Amounts | ❌ | ✅ (own) | ✅ (own) | ✅ | ❌ |
| Transaction Proof | ❌ | ✅ | ✅ | ✅ | ✅ (verify only) |

---

## 🧮 ZK Circuit Design

### Circuit: `CommissionSplitProof`

**Public Inputs:**
- `totalAmount` - Total payment amount (USDC microunits)
- `affiliateCommitment` - Hash(affiliateId || nonce)
- `splitCommitment` - Hash(platformFee || affiliateCommission || merchantAmount || nonce)
- `merkleRoot` - Root of merchant config merkle tree

**Private Inputs (Witness):**
- `platformRate` - Platform commission rate (0-0.10)
- `affiliateRate` - Affiliate commission rate (0-0.30)
- `affiliateId` - Affiliate identifier
- `nonce` - Random nonce for commitments
- `merchantConfigPath` - Merkle proof for merchant's config

**Constraints:**
```
1. Range checks:
   0 ≤ platformRate ≤ 0.10
   0 ≤ affiliateRate ≤ 0.30

2. Split calculation:
   platformFee = totalAmount × platformRate
   affiliateCommission = totalAmount × affiliateRate
   merchantAmount = totalAmount - platformFee - affiliateCommission

   Verify: platformFee + affiliateCommission + merchantAmount = totalAmount

3. Commitment verification:
   Hash(affiliateId || nonce) = affiliateCommitment
   Hash(platformFee || affiliateCommission || merchantAmount || nonce) = splitCommitment

4. Merkle proof verification:
   MerkleVerify(merchantConfigPath, merkleRoot, Hash(platformRate || affiliateRate))
```

**Output:**
- ZK proof π that proves all constraints satisfied
- Without revealing private inputs

---

## 🛠️ Implementation Stack

### 1. ZK Proof System

**Option A: Light Protocol (Recommended for Solana)**
```typescript
import { Light, CompressedAccount } from "@lightprotocol/sdk";

// Use Light Protocol's ZK compression for private state
const compressedAccount = await Light.compress({
  data: affiliateCommission,
  owner: affiliateWallet,
});
```

**Option B: Circom + SnarkJS (Custom Circuits)**
```bash
# Install dependencies
npm install snarkjs circomlib

# Compile circuit
circom commission_split.circom --r1cs --wasm --sym

# Generate proving/verification keys (one-time setup)
snarkjs groth16 setup commission_split.r1cs pot.ptau circuit_final.zkey

# Generate proof (per transaction)
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json
```

**Option C: Elusiv SDK (Transaction Privacy)**
```typescript
import { Elusiv } from "@elusiv/sdk";

// Create private USDC transfer
const elusiv = await Elusiv.getElusivInstance(
  connection,
  wallet,
  "mainnet-beta"
);

await elusiv.buildSendTx(
  amount,
  recipientPublicKey,
  "USDC"
);
```

### 2. Encryption Layer

**Hybrid Encryption for Recipient Data:**
```typescript
import { box, randomBytes } from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

// Server has encryption keypair
const serverKeypair = box.keyPair();

// Agent encrypts split data
function encryptSplitData(splitData: SplitInfo): EncryptedData {
  const nonce = randomBytes(box.nonceLength);
  const message = JSON.stringify(splitData);

  const encrypted = box(
    Buffer.from(message),
    nonce,
    serverKeypair.publicKey,
    agentKeypair.secretKey
  );

  return { encrypted, nonce };
}

// Server decrypts to execute split
function decryptSplitData(encrypted: EncryptedData): SplitInfo {
  const decrypted = box.open(
    encrypted.encrypted,
    encrypted.nonce,
    agentKeypair.publicKey,
    serverKeypair.secretKey
  );

  return JSON.parse(Buffer.from(decrypted).toString());
}
```

### 3. Commitment Scheme

**Poseidon Hash for ZK-Friendly Commitments:**
```typescript
import { poseidon } from 'circomlibjs';

// Create commitment to affiliate ID
function createAffiliateCommitment(
  affiliateId: string,
  nonce: bigint
): bigint {
  const affiliateIdNum = BigInt('0x' + Buffer.from(affiliateId).toString('hex'));
  return poseidon([affiliateIdNum, nonce]);
}

// Create commitment to split amounts
function createSplitCommitment(
  platformFee: bigint,
  affiliateCommission: bigint,
  merchantAmount: bigint,
  nonce: bigint
): bigint {
  return poseidon([platformFee, affiliateCommission, merchantAmount, nonce]);
}

// Verify commitment
function verifyCommitment(
  value: string,
  nonce: bigint,
  commitment: bigint
): boolean {
  const computed = createAffiliateCommitment(value, nonce);
  return computed === commitment;
}
```

---

## 📊 Database Schema Extensions

### Pending Splits Table
```sql
CREATE TABLE pending_splits (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  payment_tx_signature TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  affiliate_commitment TEXT NOT NULL,  -- Hash(affiliateId + nonce)
  split_commitment TEXT NOT NULL,      -- Hash(splits + nonce)
  nonce TEXT NOT NULL,                 -- For commitment opening
  status TEXT NOT NULL,                -- 'pending', 'processing', 'completed', 'failed'
  created_at INTEGER NOT NULL,

  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

### ZK Proofs Table
```sql
CREATE TABLE zk_proofs (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL,
  proof_data TEXT NOT NULL,           -- Serialized ZK proof
  public_inputs TEXT NOT NULL,        -- Public inputs JSON
  verification_key_id TEXT NOT NULL,  -- Which circuit/key was used
  verified BOOLEAN DEFAULT FALSE,
  verified_at INTEGER,
  settlement_tx_signature TEXT,

  FOREIGN KEY (split_id) REFERENCES pending_splits(id)
);
```

### Encrypted Split Details Table
```sql
CREATE TABLE encrypted_splits (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL,
  encrypted_recipients TEXT NOT NULL, -- Encrypted recipient info
  encryption_nonce TEXT NOT NULL,
  decrypted_at INTEGER,

  FOREIGN KEY (split_id) REFERENCES pending_splits(id)
);
```

---

## 🚀 API Endpoints

### 1. Server Endpoints (x402 Server)

**Create Pending Split (Internal - after x402 payment)**
```typescript
// Called internally after successful x402 payment
async function createPendingSplit(payment: PaymentInfo): Promise<string> {
  const nonce = generateRandomNonce();
  const affiliateCommitment = createAffiliateCommitment(payment.affiliateId, nonce);
  const splitCommitment = createSplitCommitment(
    calculatePlatformFee(payment.amount),
    calculateAffiliateCommission(payment.amount),
    calculateMerchantAmount(payment.amount),
    nonce
  );

  await db.createPendingSplit({
    merchantId: payment.merchantId,
    totalAmount: payment.amount,
    affiliateCommitment,
    splitCommitment,
    nonce,
  });
}
```

**Get Pending Splits (For Agents)**
```typescript
GET /api/agent/pending-splits/:merchantId
Authorization: Bearer <agent-token>

Response:
{
  success: true,
  data: [
    {
      splitId: "split_123",
      totalAmount: "1000000",
      affiliateCommitment: "0x1234...",
      splitCommitment: "0x5678...",
      timestamp: 1234567890
    }
  ]
}
```

**Execute Split with ZK Proof**
```typescript
POST /api/agent/execute-split
Authorization: Bearer <agent-token>
Content-Type: application/json

Body:
{
  splitId: "split_123",
  zkProof: {
    proof: { pi_a: [...], pi_b: [...], pi_c: [...] },
    publicInputs: [totalAmount, affiliateCommitment, splitCommitment]
  },
  encryptedRecipients: {
    encrypted: "base64...",
    nonce: "base64..."
  }
}

Response:
{
  success: true,
  data: {
    transactionSignature: "5eykt...",
    status: "completed"
  }
}
```

### 2. Verification Endpoint (Public)

**Verify Split Proof**
```typescript
GET /api/public/verify-split/:splitId

Response:
{
  success: true,
  data: {
    splitId: "split_123",
    totalAmount: "1000000",
    proofVerified: true,
    transactionSignature: "5eykt...",
    timestamp: 1234567890,
    // Note: Individual amounts and recipients NOT revealed
  }
}
```

---

## 🔄 Complete Flow

### 1. Customer Makes Payment
```
Customer → x402 Server
- Payment: 10 USDC via x402 protocol
- Memo: Encrypted("AFF_12345")
```

### 2. Server Processes Payment
```typescript
// x402 middleware verifies payment
const payment = await verifyX402Payment(req);

// Decrypt affiliate ID
const affiliateId = decryptMemo(payment.memo);

// Create commitments
const nonce = generateRandomNonce();
const affiliateCommitment = hash(affiliateId, nonce);
const splitCommitment = hash(platformFee, affiliateComm, merchantAmt, nonce);

// Store pending split
await db.createPendingSplit({
  merchantId: payment.merchantId,
  totalAmount: payment.amount,
  affiliateCommitment,
  splitCommitment,
  nonce,
  encryptedMemo: payment.memo
});

// Grant access to content
res.json({ success: true, content: protectedData });
```

### 3. Agent Processes Split
```typescript
// Agent polls for pending splits
const pendingSplits = await fetch(
  `${serverUrl}/api/agent/pending-splits/${merchantId}`,
  { headers: { Authorization: `Bearer ${agentToken}` }}
);

for (const split of pendingSplits.data) {
  // Retrieve merchant config (rates)
  const config = merchantConfigs.get(split.merchantId);

  // Calculate splits (private)
  const platformFee = split.totalAmount * config.platformRate;
  const affiliateComm = split.totalAmount * config.affiliateRate;
  const merchantAmt = split.totalAmount - platformFee - affiliateComm;

  // Generate ZK proof
  const proof = await generateCommissionProof({
    publicInputs: {
      totalAmount: split.totalAmount,
      affiliateCommitment: split.affiliateCommitment,
      splitCommitment: split.splitCommitment
    },
    privateInputs: {
      platformRate: config.platformRate,
      affiliateRate: config.affiliateRate,
      affiliateId: decryptAffiliateId(split.encryptedMemo),
      nonce: split.nonce,
      amounts: { platformFee, affiliateComm, merchantAmt }
    }
  });

  // Encrypt recipient details
  const encrypted = encryptRecipients({
    platform: { wallet: platformWallet, amount: platformFee },
    affiliate: { wallet: affiliateWallet, amount: affiliateComm },
    merchant: { wallet: merchantWallet, amount: merchantAmt }
  });

  // Submit to server
  await fetch(`${serverUrl}/api/agent/execute-split`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${agentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      splitId: split.splitId,
      zkProof: proof,
      encryptedRecipients: encrypted
    })
  });
}
```

### 4. Server Verifies and Settles
```typescript
// Verify ZK proof
const isValid = await verifyGroth16Proof(
  proof,
  publicInputs,
  verificationKey
);

if (!isValid) {
  throw new Error('Invalid ZK proof');
}

// Decrypt recipients
const recipients = decryptRecipients(encryptedRecipients);

// Verify sum
const sum = recipients.reduce((acc, r) => acc + r.amount, 0n);
if (sum !== BigInt(split.totalAmount)) {
  throw new Error('Amounts do not sum to total');
}

// Call facilitator to settle
const result = await fetch(`${facilitatorUrl}/settle-usdc-split`, {
  method: 'POST',
  body: JSON.stringify({
    agentPrivateKey: merchant.agentPrivateKey,
    usdcMint: merchant.usdcMint,
    recipients
  })
});

// Mark split as completed
await db.updateSplit(splitId, {
  status: 'completed',
  transactionSignature: result.signature
});
```

---

## 🧪 Testing Strategy

### 1. ZK Circuit Tests
```bash
# Test circuit compilation
npm run test:circuit:compile

# Test proof generation
npm run test:circuit:prove

# Test proof verification
npm run test:circuit:verify

# Test with different inputs
npm run test:circuit:fuzzing
```

### 2. Integration Tests
```typescript
describe('ZK-Enhanced Payment Flow', () => {
  it('should process payment with private affiliate', async () => {
    // 1. Customer makes payment
    const payment = await makeX402Payment({
      amount: 1000000,
      affiliateMemo: 'AFF_12345'
    });

    // 2. Server creates pending split
    const split = await server.getPendingSplit(merchantId);
    expect(split.affiliateCommitment).toBeDefined();

    // 3. Agent generates proof
    const proof = await agent.generateSplitProof(split);
    expect(await verifyProof(proof)).toBe(true);

    // 4. Server settles split
    const result = await server.executeSplit(split.id, proof);
    expect(result.transactionSignature).toBeDefined();

    // 5. Verify privacy
    const publicData = await fetchPublicSplitData(split.id);
    expect(publicData.platformFee).toBeUndefined(); // Private!
    expect(publicData.affiliateId).toBeUndefined(); // Private!
  });
});
```

---

## 📈 Performance Considerations

### Proof Generation Time
- **Groth16**: ~1-2 seconds per proof (acceptable for batching)
- **PLONK**: ~5-10 seconds but smaller proof size
- **Batching**: Process multiple splits in one proof for efficiency

### On-Chain Costs
- **Verification**: ~50-100k compute units on Solana
- **Storage**: Minimal (only commitments stored)
- **Batching**: Amortize costs across multiple splits

### Privacy-Performance Tradeoff
```
High Privacy          Medium Privacy        Low Privacy
(Full ZK)            (Hybrid)              (Encrypted Only)
    |                    |                      |
    |                    |                      |
Slow (2s/tx)        Fast (0.5s/tx)        Very Fast (0.1s/tx)
Expensive           Medium Cost           Low Cost
Complex             Moderate              Simple
```

**Recommended**: Hybrid approach for production
- Use ZK proofs for commission rate privacy
- Use encryption for affiliate identity
- Keep payment amounts public (blockchain requirement)

---

## 🔐 Security Considerations

### 1. Trusted Setup
- Use multi-party computation (MPC) for circuit setup
- Or use transparent setup (PLONK, STARKs)
- Publish verification keys publicly

### 2. Key Management
- Agent private keys stored in secure enclave
- Server encryption keys rotated regularly
- Hardware security modules (HSM) for production

### 3. Proof Replay Protection
- Include timestamp in public inputs
- Store proof hashes to prevent reuse
- Bind proofs to specific split IDs

### 4. Side-Channel Protection
- Constant-time operations in circuits
- No timing leaks in verification
- Rate limiting on proof submission

---

## 📚 References

1. **Groth16**: "On the Size of Pairing-based Non-interactive Arguments"
2. **Light Protocol**: https://www.lightprotocol.com/
3. **Elusiv**: https://elusiv.io/
4. **Circom**: https://docs.circom.io/
5. **SnarkJS**: https://github.com/iden3/snarkjs
6. **Poseidon Hash**: ZK-friendly hash function
7. **Solana Programs**: Anchor framework for verification

---

## 🎯 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up ZK development environment
- Choose ZK library (Light Protocol or Circom)
- Design and test basic commitment scheme
- Implement encryption layer

### Phase 2: Circuit Development (Week 3-4)
- Write commission split circuit
- Test circuit with various inputs
- Generate trusted setup parameters
- Deploy verification contract/program

### Phase 3: Integration (Week 5-6)
- Integrate agents with x402 server API
- Add pending splits queue
- Implement ZK proof generation in agents
- Add proof verification to server

### Phase 4: Testing (Week 7-8)
- End-to-end integration tests
- Security audit
- Performance optimization
- Load testing

### Phase 5: Production (Week 9+)
- Deploy to devnet
- Monitor and iterate
- Deploy to mainnet
- Documentation and training

---

## 💡 Future Enhancements

1. **Recursive Proofs**: Aggregate multiple split proofs into one
2. **zkRollup**: Batch thousands of splits off-chain
3. **Private Analytics**: ZK-based merchant dashboard
4. **Confidential Assets**: Support for private stablecoins
5. **Cross-chain Privacy**: Bridge ZK proofs to other chains
