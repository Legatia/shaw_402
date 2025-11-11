# Merchant Cancellation & Deposit Refund

## Overview

Merchants can cancel their Shaw 402 service at any time and receive a full refund of their 1 SOL security deposit. This document describes the cancellation flow and implementation.

## Business Policy

### Refund Policy
- **Deposit Amount**: 1 SOL (held in platform wallet)
- **Refundable**: 100% refundable, no cancellation fees
- **Processing Time**: Instant on-chain refund
- **Data Deletion**: All merchant data removed from database upon cancellation

### What Happens on Cancellation
1. ✅ 1 SOL returned to merchant's wallet
2. 🗑️ Merchant data deleted from database
3. 🔒 Agent wallet deactivated (keys removed)
4. 🚫 Affiliate links deactivated
5. 📊 Historical transaction data preserved (for compliance)

## API Endpoint Design

### POST /merchant/:merchantId/cancel

**Description**: Cancel merchant account and refund security deposit

**Authentication**: Requires merchant wallet signature verification

**Request:**
```json
{
  "merchantWallet": "7xYzPqR...",
  "signature": "5wojeLe...",  // Signature of cancellation message
  "message": "Cancel Shaw 402 service for merchant_abc123"
}
```

**Process:**
1. Verify merchant exists and is active
2. Verify signature from merchant wallet
3. Transfer 1 SOL from platform wallet to merchant wallet
4. Mark merchant as cancelled in database
5. Delete sensitive data (agent private keys)
6. Deactivate all affiliate links
7. Return transaction signature

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "merchantId": "merchant_abc123",
    "refundTxSignature": "3GH7Ks...",
    "refundAmount": "1000000000",
    "cancelledAt": "2025-11-11T00:00:00.000Z",
    "message": "Your 1 SOL deposit has been refunded. Thank you for using Shaw 402!"
  }
}
```

**Response (Error - Insufficient Balance):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PLATFORM_BALANCE",
    "message": "Platform wallet does not have enough SOL for refund. Please contact support.",
    "status": 500
  }
}
```

## Database Schema Updates

### Merchants Table

Add columns:
```sql
ALTER TABLE merchants ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE merchants ADD COLUMN cancelled_at TEXT NULL;
ALTER TABLE merchants ADD COLUMN refund_tx_signature TEXT NULL;
```

**Status Values:**
- `active` - Merchant is operational
- `cancelled` - Merchant cancelled, deposit refunded
- `suspended` - Temporarily suspended (policy violation)

### Soft Delete Approach

We use **soft delete** to preserve historical transaction data:

```sql
-- Mark as cancelled but keep record
UPDATE merchants
SET status = 'cancelled',
    cancelled_at = datetime('now'),
    refund_tx_signature = '3GH7Ks...',
    agent_private_key = NULL  -- Remove sensitive data
WHERE merchant_id = 'merchant_abc123';
```

## Implementation Steps

### 1. Backend Route (src/routes/merchant.ts)

```typescript
/**
 * POST /merchant/:merchantId/cancel
 * Cancel merchant account and refund deposit
 */
router.post('/:merchantId/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchantId } = req.params;
    const { merchantWallet, signature, message } = req.body;

    // 1. Verify merchant exists and is active
    const merchant = await affiliateDb.getMerchant(merchantId);
    if (!merchant) {
      res.status(404).json(errorResponse('Merchant not found', 'NOT_FOUND', 404));
      return;
    }

    if (merchant.status === 'cancelled') {
      res.status(400).json(errorResponse('Merchant already cancelled', 'ALREADY_CANCELLED', 400));
      return;
    }

    if (merchant.merchantWallet !== merchantWallet) {
      res.status(403).json(errorResponse('Wallet mismatch', 'UNAUTHORIZED', 403));
      return;
    }

    // 2. Verify signature
    const isValid = await solanaUtils.verifySignature(
      merchantWallet,
      message,
      signature
    );

    if (!isValid) {
      res.status(401).json(errorResponse('Invalid signature', 'INVALID_SIGNATURE', 401));
      return;
    }

    // 3. Refund 1 SOL to merchant
    const platformKeypair = Keypair.fromSecretKey(bs58.decode(PLATFORM_PRIVATE_KEY));
    const merchantPubkey = new PublicKey(merchantWallet);
    const refundAmount = parseInt(process.env.REGISTRATION_FEE || '1000000000');

    console.log(`💰 Refunding ${refundAmount / 1e9} SOL to ${merchantWallet}...`);
    const refundTxSignature = await solanaUtils.transferSOL(
      platformKeypair,
      merchantPubkey,
      refundAmount
    );

    // 4. Update database
    await affiliateDb.cancelMerchant(merchantId, refundTxSignature);

    console.log(`✅ Merchant ${merchantId} cancelled, refund tx: ${refundTxSignature}`);

    // 5. Return success
    res.json(
      successResponse({
        merchantId,
        refundTxSignature,
        refundAmount: refundAmount.toString(),
        cancelledAt: new Date().toISOString(),
        message: 'Your 1 SOL deposit has been refunded. Thank you for using Shaw 402!',
      })
    );
  } catch (error: any) {
    console.error('Merchant cancellation error:', error);
    res.status(500).json(
      errorResponse(
        error.message || 'Failed to cancel merchant',
        'CANCELLATION_ERROR',
        500
      )
    );
  }
});
```

### 2. Database Method (src/lib/affiliate-database.ts)

```typescript
/**
 * Cancel merchant and mark as refunded
 */
async cancelMerchant(merchantId: string, refundTxSignature: string): Promise<void> {
  const stmt = this.db.prepare(`
    UPDATE merchants
    SET status = 'cancelled',
        cancelled_at = datetime('now'),
        refund_tx_signature = ?,
        agent_private_key = NULL
    WHERE merchant_id = ?
  `);

  stmt.run(refundTxSignature, merchantId);

  // Deactivate all affiliates for this merchant
  const deactivateStmt = this.db.prepare(`
    UPDATE affiliates
    SET status = 'inactive'
    WHERE merchant_id = ?
  `);

  deactivateStmt.run(merchantId);

  console.log(`Merchant ${merchantId} cancelled and affiliates deactivated`);
}
```

### 3. Frontend UI (public/dashboard.html or new cancellation page)

```html
<div class="cancellation-section">
  <h3>⚠️ Cancel Service</h3>
  <p>If you wish to cancel your Shaw 402 service, you will receive a full refund of your 1 SOL deposit.</p>

  <div class="warning-box">
    <strong>Warning:</strong> This action will:
    <ul>
      <li>Refund 1 SOL to your wallet</li>
      <li>Delete all your merchant data</li>
      <li>Deactivate your agent wallet</li>
      <li>Disable all affiliate links</li>
    </ul>
    <p><strong>This cannot be undone.</strong></p>
  </div>

  <button id="cancelServiceBtn" class="btn btn-danger">
    Cancel Service & Get Refund
  </button>
</div>

<script>
document.getElementById('cancelServiceBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to cancel? This will delete all your data and refund your deposit.')) {
    return;
  }

  try {
    // Sign cancellation message
    const message = `Cancel Shaw 402 service for ${merchantId}`;
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');

    // Call cancellation API
    const response = await fetch(`/merchant/${merchantId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantWallet: walletAddress,
        signature: bs58.encode(signedMessage.signature),
        message: message
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Service cancelled! Refund tx: ${result.data.refundTxSignature}`);
      window.location.href = '/';
    } else {
      alert(`❌ Cancellation failed: ${result.error.message}`);
    }
  } catch (err) {
    console.error(err);
    alert('Error cancelling service');
  }
});
</script>
```

## Security Considerations

### 1. Signature Verification
- Must verify that the cancellation request comes from the merchant's registered wallet
- Use Solana's `nacl.sign.detached.verify()` to verify signatures
- Prevent unauthorized cancellations

### 2. Platform Balance Check
- Ensure platform wallet has sufficient SOL before processing refund
- If insufficient, queue refund and notify admin
- Never mark merchant as cancelled until refund is confirmed on-chain

### 3. Rate Limiting
- Limit cancellation attempts to prevent DoS
- Max 3 attempts per merchant per hour

### 4. Audit Trail
- Log all cancellation requests (successful and failed)
- Preserve transaction signatures for accounting
- Keep cancelled merchant records for 7 years (compliance)

## Testing Checklist

- [ ] Happy path: Merchant cancels and receives refund
- [ ] Invalid signature: Cancellation rejected
- [ ] Wrong wallet: Cannot cancel another merchant's account
- [ ] Already cancelled: Cannot cancel twice
- [ ] Insufficient platform balance: Graceful error handling
- [ ] Network failure during refund: Retry logic
- [ ] Data deletion: Verify sensitive data removed
- [ ] Affiliate deactivation: Verify links stop working

## Monitoring & Alerts

### Metrics to Track
- **Cancellation rate**: % of merchants who cancel
- **Refund volume**: Total SOL refunded per day/week/month
- **Platform wallet balance**: Alert if balance < 50 SOL
- **Failed refunds**: Alert immediately if refund transaction fails

### Dashboard Queries
```sql
-- Daily cancellation rate
SELECT
  DATE(cancelled_at) as date,
  COUNT(*) as cancellations,
  (SELECT COUNT(*) FROM merchants WHERE status = 'active') as active_merchants,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM merchants), 2) as cancellation_rate
FROM merchants
WHERE status = 'cancelled'
GROUP BY DATE(cancelled_at)
ORDER BY date DESC;

-- Total refunded
SELECT
  COUNT(*) as total_cancelled,
  SUM(1.0) as total_sol_refunded
FROM merchants
WHERE status = 'cancelled' AND refund_tx_signature IS NOT NULL;
```

## Future Enhancements

### 1. Partial Refunds
If merchant used service for X months, charge a small service fee:
- < 1 month: 100% refund
- 1-3 months: 90% refund
- 3-6 months: 80% refund
- > 6 months: 50% refund

### 2. Reactivation
Allow cancelled merchants to re-activate by paying deposit again:
- Restore previous merchant data if within 30 days
- Keep same merchant ID for continuity

### 3. Exit Surveys
Ask merchants why they're cancelling:
- Dropdown: "Too expensive / Not enough sales / Technical issues / Other"
- Free text feedback
- Use insights to improve product

## Contact & Support

If refund fails or merchant has issues:
- Email: support@shaw402.com
- Discord: shaw402 community
- Emergency hotline: Check platform wallet balance immediately

---

**Last Updated**: 2025-11-11
**Owner**: Shaw 402 Platform Team
