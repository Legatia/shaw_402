# Solana Pay Integration

This document describes the Solana Pay integration for the x402 payment protocol, enabling mobile wallet payments via QR codes and standardized transaction requests.

## Overview

Solana Pay is a decentralized payment protocol that enables merchants to accept payments directly from Solana wallets. This integration adds Solana Pay support to the x402 server, allowing:

- **QR Code Payments** - Generate scannable QR codes for mobile wallets
- **Transaction Requests** - Interactive API-based payment flows
- **Transfer Requests** - Simple non-interactive payment URLs
- **Payment Verification** - Track and validate completed payments

## Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│                 │   QR    │              │  API    │                 │
│  Mobile Wallet  │◄───────┤ x402 Server  │────────►│ Solana Network  │
│                 │         │              │         │                 │
│ • Scans QR      │         │ • Generates  │         │ • Confirms tx   │
│ • Signs tx      │  POST   │   QR codes   │         │ • Settles       │
│ • Sends tx      │────────►│ • Creates tx │         │   payment       │
└─────────────────┘         │ • Verifies   │         └─────────────────┘
                            └──────────────┘
```

## Payment Flow

### 1. Transaction Request Flow (Interactive)

The recommended approach for most use cases:

```
1. Merchant generates QR code or Solana Pay URL
   GET /api/solana-pay/:endpoint/qr

2. Customer scans QR with wallet app

3. Wallet makes GET request for payment details
   GET /api/solana-pay/:endpoint
   Response: { label, icon }

4. Wallet makes POST request with customer's account
   POST /api/solana-pay/:endpoint
   Body: { account: "customer_public_key" }
   Response: { transaction: "base64_transaction", message: "..." }

5. Wallet deserializes, signs, and broadcasts transaction

6. Merchant checks payment status
   GET /api/solana-pay/:endpoint/status/:reference
   Response: { status: "confirmed", signature: "..." }

7. Merchant validates payment
   POST /api/solana-pay/:endpoint/validate
   Body: { reference: "..." }
   Response: { valid: true, signature: "..." }
```

### 2. Transfer Request Flow (Non-Interactive)

Simpler but less flexible:

```
1. Merchant generates transfer URL
   GET /api/solana-pay/transfer/:endpoint
   Response: { url: "solana:recipient?amount=X&reference=Y", ... }

2. Customer scans QR code

3. Wallet directly creates and signs transaction
   (No server interaction needed)

4. Merchant monitors blockchain for reference
   GET /api/solana-pay/:endpoint/status/:reference
```

## API Endpoints

### Payment Endpoints

The following payment endpoints are available:

- `premium-data` - Premium data access (0.01 SOL)
- `generate-content` - Generate AI content (0.005 SOL)
- `download` - File download (0.02 SOL)
- `tier-access` - Premium tier access (0.05 SOL)

### QR Code Generation

**GET `/api/solana-pay/:endpoint/qr`**

Generates a QR code for the Solana Pay URL.

**Query Parameters:**
- `format` - `png` (default) or `svg`

**Response:**
- Content-Type: `image/png` or `image/svg+xml`
- Body: QR code image data

**Example:**
```bash
curl http://localhost:3000/api/solana-pay/premium-data/qr \
  --output payment-qr.png
```

### Transaction Request Label (GET)

**GET `/api/solana-pay/:endpoint`**

Returns merchant label and icon for wallet display.

**Response:**
```json
{
  "label": "x402 Payment Server",
  "icon": "https://example.com/icon.png"
}
```

**Example:**
```bash
curl http://localhost:3000/api/solana-pay/premium-data
```

### Transaction Request (POST)

**POST `/api/solana-pay/:endpoint`**

Creates a payment transaction for the customer to sign.

**Request Body:**
```json
{
  "account": "customer_public_key_base58"
}
```

**Response:**
```json
{
  "transaction": "base64_serialized_transaction",
  "message": "Unlock premium data"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/solana-pay/premium-data \
  -H "Content-Type: application/json" \
  -d '{"account": "9aKj...xyz"}'
```

### Payment Status

**GET `/api/solana-pay/:endpoint/status/:reference`**

Checks if a payment has been confirmed on-chain.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "signature": "transaction_signature",
    "reference": "reference_public_key"
  }
}
```

Or if pending:
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "reference": "reference_public_key"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/solana-pay/premium-data/status/REFERENCE_KEY
```

### Payment Validation

**POST `/api/solana-pay/:endpoint/validate`**

Validates that a payment matches the expected amount and recipient.

**Request Body:**
```json
{
  "reference": "reference_public_key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "signature": "transaction_signature",
    "reference": "reference_public_key"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/solana-pay/premium-data/validate \
  -H "Content-Type: application/json" \
  -d '{"reference": "REFERENCE_KEY"}'
```

### Transfer URL Generation

**GET `/api/solana-pay/transfer/:endpoint`**

Generates a non-interactive transfer request URL.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "solana:recipient?amount=0.01&reference=xyz&label=...",
    "reference": "reference_public_key",
    "amount": 10000000,
    "recipient": "merchant_public_key"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/solana-pay/transfer/premium-data
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Solana Pay Configuration
SERVER_BASE_URL=http://localhost:3000
SOLANA_PAY_LABEL=x402 Payment Server
SOLANA_PAY_ICON_URL=https://yourserver.com/icon.png
```

### Server Configuration

The Solana Pay routes are automatically initialized in `src/server/index.ts`:

```typescript
initializeSolanaPayRoutes({
  solanaUtils,
  nonceDb,
  merchantAddress,
  serverBaseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3000',
  label: process.env.SOLANA_PAY_LABEL || 'x402 Payment Server',
  iconUrl: process.env.SOLANA_PAY_ICON_URL,
});
```

## Testing

### Running Tests

```bash
# Start the server
npm start

# Run Solana Pay integration tests
npm run test:solana-pay
```

### Test Script Features

The test script (`test-solana-pay.mjs`) performs the following tests:

1. **QR Code Generation** - Generates and saves a PNG QR code
2. **Transfer URL** - Creates a non-interactive payment URL
3. **Transaction Request** - Full interactive payment flow
4. **Payment Status** - Checks transaction confirmation status
5. **Payment Validation** - Validates completed payments

### Simulated vs Real Transactions

By default, tests run in simulation mode. To test with real blockchain transactions:

```bash
# Set environment variable
export SEND_REAL_TRANSACTION=true

# Run tests (requires funded wallet)
npm run test:solana-pay
```

### Testing with Mobile Wallets

1. Start the server and expose it publicly (use ngrok or similar):
```bash
npm start

# In another terminal
ngrok http 3000
```

2. Update `SERVER_BASE_URL` in `.env` to your public URL:
```env
SERVER_BASE_URL=https://your-ngrok-url.ngrok.io
```

3. Generate a QR code:
```bash
curl https://your-ngrok-url.ngrok.io/api/solana-pay/premium-data/qr \
  --output payment-qr.png
```

4. Scan with a Solana Pay-compatible wallet:
   - Phantom
   - Solflare
   - Slope
   - Backpack
   - Glow

## Integration Examples

### Frontend Integration

#### React Component

```typescript
import { useEffect, useState } from 'react';

function SolanaPayButton({ endpoint }) {
  const [qrUrl, setQrUrl] = useState('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    // Generate QR code URL
    setQrUrl(`${SERVER_URL}/api/solana-pay/${endpoint}/qr`);

    // Create transaction and get reference
    async function createPayment() {
      const response = await fetch(
        `${SERVER_URL}/api/solana-pay/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: walletPublicKey })
        }
      );
      const data = await response.json();
      // Parse transaction to get reference
      // (Implementation depends on your wallet library)
    }
  }, [endpoint]);

  // Poll for payment status
  useEffect(() => {
    if (!reference) return;

    const interval = setInterval(async () => {
      const response = await fetch(
        `${SERVER_URL}/api/solana-pay/${endpoint}/status/${reference}`
      );
      const data = await response.json();

      if (data.data.status === 'confirmed') {
        setStatus('confirmed');
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [reference, endpoint]);

  return (
    <div>
      <img src={qrUrl} alt="Scan to pay" />
      <p>Status: {status}</p>
    </div>
  );
}
```

### Backend Integration

#### Express Middleware

```typescript
import { findReference, validateTransfer } from '@solana/pay';
import { PublicKey } from '@solana/web3.js';

async function verifyPayment(req, res, next) {
  const { reference, endpoint } = req.body;

  try {
    // Find transaction
    const signatureInfo = await findReference(
      connection,
      new PublicKey(reference),
      { finality: 'confirmed' }
    );

    // Validate payment
    await validateTransfer(
      connection,
      signatureInfo.signature,
      {
        recipient: merchantAddress,
        amount: BigInt(PAYMENT_AMOUNTS[endpoint]),
        reference: new PublicKey(reference),
      }
    );

    // Payment verified - grant access
    req.paymentVerified = true;
    next();
  } catch (error) {
    res.status(402).json({ error: 'Payment required' });
  }
}
```

## Comparison: x402 Headers vs Solana Pay

| Feature | x402 Headers | Solana Pay |
|---------|-------------|------------|
| **Client** | Web browsers | Mobile wallets |
| **Flow** | HTTP headers | QR codes / Deep links |
| **Signing** | Custom SDK | Native wallet |
| **UX** | Seamless | Scan & approve |
| **Integration** | JavaScript required | Works with any wallet |
| **Use Case** | Web APIs | Point of sale, Mobile |

Both methods use the same underlying payment verification and can be used together:
- **Web clients** → x402 headers
- **Mobile clients** → Solana Pay QR codes

## Security Considerations

### Nonce System

The integration uses a separate nonce database (`data/solana-pay-nonces.db`) to prevent replay attacks:

- Each payment request generates a unique reference (nonce)
- Nonces are marked as used after transaction creation
- Expired nonces are cleaned up automatically

### Amount Validation

Payment validation verifies:
- Correct recipient (merchant address)
- Correct amount (exact match)
- Valid reference (matches request)
- Transaction confirmed on-chain

### Reference Keys

Reference keys are used to:
- Track specific payment requests
- Enable transaction lookup via `getSignaturesForAddress`
- Prevent payment reuse across endpoints

## Troubleshooting

### QR Code Not Scanning

- Ensure `SERVER_BASE_URL` is publicly accessible
- Check that the URL uses HTTPS (required for production)
- Verify the QR code image is not corrupted

### Transaction Not Found

- Wait for transaction to be confirmed (1-2 seconds)
- Check reference key is correct
- Verify transaction was broadcast to the network

### Payment Validation Fails

- Ensure correct payment amount
- Verify merchant address matches configuration
- Check transaction is confirmed (not just sent)

### Low Balance Error

Fund your test wallet:
```bash
solana airdrop 0.1 YOUR_PUBLIC_KEY --url devnet
```

## References

- [Solana Pay Specification](https://docs.solanapay.com/spec)
- [Solana Pay GitHub](https://github.com/solana-foundation/solana-pay)
- [x402 Protocol Documentation](./README.md)
- [Test Implementation](./test-solana-pay.mjs)

## License

MIT - Same as the main x402 project
