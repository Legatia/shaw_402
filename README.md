# Shaw 402 - Affiliate Commerce Platform

A decentralized affiliate commerce platform on Solana with automated commission splits, featuring x402-protected payment processing and zero-knowledge privacy primitives.

## Overview

Shaw 402 is a data hub for affiliate commerce that enables merchants to run affiliate programs with automatic commission distribution. The platform combines Solana Pay for customer payments, autonomous payment processor agents, and x402 protocol for secure split execution.

### Key Features

- **Merchant Onboarding**: Register business and get autonomous payment processor agent
- **Affiliate Programs**: Create trackable referral links with custom commission rates
- **Solana Pay Integration**: Simple QR code payments for customers via mobile wallets
- **Automated Splits**: Atomic USDC distribution to platform, affiliate, and merchant
- **x402 Protected**: Split execution requires cryptographic payment authorization
- **Zero-Knowledge Privacy**: Optional ZK commitments for confidential commission rates
- **USDC Settlement**: All payments and commissions in USDC stablecoin

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Shaw 402 Architecture                           │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   Customer Wallet    │
                    │  (Solana Mobile)     │
                    └──────────┬───────────┘
                               │ Scans QR
                               │ Pays in USDC
                               ▼
                    ┌──────────────────────┐
                    │  Payment Agent       │◄─────────┐
                    │  (Merchant's)        │          │
                    │                      │          │
                    │  • Receives payment  │          │
                    │  • Detects memo      │          │
                    │  • Calls Hub API     │          │
                    └──────────┬───────────┘          │
                               │                      │
                               ▼                      │
┌─────────────────────────────────────────────────────┴────────┐
│                      Hub API (Shaw 402)                      │
│                                                               │
│  • Merchant registration & agent provisioning                │
│  • Affiliate registration & tracking                         │
│  • Split calculation (platform/affiliate/merchant)           │
│  • Payment split confirmation & recording                    │
└───────────────────────────────┬───────────────────────────────┘
                                │ Split instructions
                                ▼
                    ┌──────────────────────┐
                    │  Payment Agent       │
                    │                      │
                    │  Creates x402 auth   │
                    │  Signs with key      │
                    └──────────┬───────────┘
                               │ X-Payment header
                               ▼
                    ┌──────────────────────┐
                    │  Facilitator         │
                    │  (x402 Protected)    │
                    │                      │
                    │  • Verifies x402     │
                    │  • Executes split    │
                    │  • Atomic USDC tx    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Solana Blockchain   │
                    │                      │
                    │  Platform ← USDC     │
                    │  Affiliate ← USDC    │
                    │  Merchant ← USDC     │
                    └──────────────────────┘
```

### Payment Flow

1. **Merchant Registration**
   - Merchant registers business via Hub API
   - Hub provisions autonomous payment processor agent
   - Merchant receives affiliate program link

2. **Affiliate Registration**
   - Affiliate signs up through merchant's program
   - Hub generates unique tracking link with referral code
   - Affiliate shares link to promote merchant

3. **Customer Purchase**
   - Customer clicks affiliate link → redirected to merchant
   - Merchant website generates Solana Pay QR code
   - QR contains: agent wallet + USDC amount + affiliate ID in memo
   - Customer scans and pays via Solana mobile wallet

4. **Payment Detection**
   - Agent monitors blockchain for incoming USDC
   - Detects payment with affiliate ID in memo field
   - Calls Hub API: `POST /api/agent/get-split-instructions`

5. **Split Calculation**
   - Hub looks up merchant configuration and affiliate data
   - Calculates splits based on fee rates:
     - Platform fee (e.g., 5%)
     - Affiliate commission (e.g., 15%)
     - Merchant amount (remaining ~80%)
   - Returns split instructions with recipient addresses

6. **x402-Protected Execution**
   - Agent creates x402 payment authorization
   - Signs authorization with agent private key
   - Calls Facilitator: `POST /execute-split` (x402-protected)
   - Facilitator verifies x402 payment in header
   - Executes atomic 3-way USDC split transaction

7. **Confirmation**
   - Agent confirms to Hub: `POST /api/agent/confirm-split`
   - Hub records transaction in database
   - Updates affiliate earnings and statistics

## Project Structure

```
shaw_402/
├── src/
│   ├── agent/
│   │   ├── index.ts                    # Payment processor agent entry
│   │   └── payment-processor.ts        # Agent payment monitoring
│   ├── facilitator/
│   │   └── index.ts                    # x402 facilitator app
│   ├── server/
│   │   └── index.ts                    # Hub API server
│   ├── lib/
│   │   ├── affiliate-database.ts       # Merchant/affiliate data management
│   │   ├── nonce-database.ts           # x402 nonce replay protection
│   │   ├── solana-utils.ts             # Blockchain utilities
│   │   ├── x402-middleware.ts          # x402 Express middleware
│   │   ├── zk-privacy.ts               # Zero-knowledge primitives
│   │   └── ...
│   └── routes/
│       ├── agent-api.ts                # Hub endpoints for agents
│       ├── execute-split.ts            # x402-protected split endpoint
│       ├── solana-pay.ts               # Solana Pay QR generation
│       ├── settle-usdc-split.ts        # Legacy split settlement
│       └── ...
├── docs/
│   ├── AFFILIATE_PLATFORM.md           # Affiliate platform design
│   ├── AGENT_SYSTEM.md                 # Payment processor agents
│   ├── SOLANA_PAY_INTEGRATION.md       # Solana Pay implementation
│   ├── UNIFIED_ARCHITECTURE_PROPOSAL.md # Architecture overview
│   ├── USDC_SETTLEMENT.md              # USDC payment splitting
│   ├── ZK_PRIVACY_ARCHITECTURE.md      # Zero-knowledge privacy
│   └── SETUP.md                        # Detailed setup guide
├── test-*.mjs                          # Test scripts
├── package.json
└── README.md                           # This file
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp env.example .env
# Edit .env with your configuration
```

Required environment variables:

```env
# Facilitator (x402 service)
FACILITATOR_PORT=3001
FACILITATOR_PRIVATE_KEY=<base58_private_key>

# Hub Server
SERVER_PORT=3000
PLATFORM_WALLET=<platform_usdc_wallet>
USDC_MINT_ADDRESS=<usdc_mint_address>

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Database
AFFILIATE_DB_PATH=./data/affiliates.db
NONCE_DB_PATH=./data/nonce.db
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Initialize Database

```bash
# Create data directory
mkdir -p data

# Database will be created automatically on first run
```

### 5. Start Services

```bash
# Start all services with PM2
npm start

# Or run individual services in development:
npm run dev:server      # Hub API
npm run dev:facilitator # x402 Facilitator
npm run dev:agent       # Payment Processor Agent

# View logs
npm run logs

# Stop all services
npm stop
```

### 6. Test the Platform

```bash
# Test Solana Pay integration
npm run test:solana-pay

# Test USDC payment split
npm run test:usdc

# Test x402 protocol
npm test
```

## API Reference

### Hub API Endpoints

**For Agents** (requires Bearer token authentication)

```http
POST /api/agent/get-split-instructions
Authorization: Bearer <agent_token>
Content-Type: application/json

{
  "agentWallet": "agent_pubkey",
  "amount": "1000000",  // USDC micro-units (6 decimals)
  "referralCode": "AFF123",
  "paymentTxSignature": "tx_signature"
}

Response:
{
  "success": true,
  "data": {
    "splitId": "split_1699...",
    "merchantId": "merchant_abc",
    "totalAmount": "1000000",
    "recipients": [
      {
        "role": "platform",
        "wallet": "platform_pubkey",
        "amount": "50000",
        "usdcAccount": "platform_usdc_account"
      },
      {
        "role": "affiliate",
        "wallet": "affiliate_pubkey",
        "amount": "150000",
        "usdcAccount": "affiliate_usdc_account"
      },
      {
        "role": "merchant",
        "wallet": "merchant_pubkey",
        "amount": "800000",
        "usdcAccount": "merchant_usdc_account"
      }
    ],
    "facilitatorUrl": "http://localhost:3001",
    "calculation": {
      "platformFee": "50000",
      "affiliateCommission": "150000",
      "merchantAmount": "800000"
    }
  }
}
```

```http
POST /api/agent/confirm-split
Authorization: Bearer <agent_token>
Content-Type: application/json

{
  "splitId": "split_1699...",
  "settlementTx": "tx_signature",
  "status": "completed",
  "agentWallet": "agent_pubkey",
  "referralCode": "AFF123"
}

Response:
{
  "success": true,
  "data": {
    "splitId": "split_1699...",
    "status": "recorded",
    "message": "Split completion confirmed and recorded"
  }
}
```

### Facilitator Endpoints

**x402-Protected Split Execution**

```http
POST /execute-split
X-Payment: <x402_payment_authorization>
Content-Type: application/json

{
  "splitId": "split_1699...",
  "recipients": [
    {
      "role": "platform",
      "wallet": "platform_pubkey",
      "amount": "50000",
      "usdcAccount": "platform_usdc_account"
    },
    // ... more recipients
  ],
  "agentUSDCAccount": "agent_usdc_account",
  "usdcMint": "usdc_mint_address",
  "agentPrivateKey": "base58_private_key"
}

Response:
{
  "success": true,
  "data": {
    "splitId": "split_1699...",
    "transactionSignature": "5xK7...",
    "explorerUrl": "https://explorer.solana.com/tx/5xK7...?cluster=devnet",
    "recipients": [...],
    "x402Payment": {
      "verified": true,
      "agentWallet": "agent_pubkey",
      "transactionSignature": "4mN9..."
    }
  }
}
```

**Other Facilitator Endpoints**

```http
GET /health              # Health check
POST /verify             # Verify x402 payment
POST /settle             # Settle x402 payment
GET /nonce/:nonce        # Get nonce status
GET /stats               # Get statistics
POST /cleanup            # Cleanup expired nonces
```

### Solana Pay Endpoints

```http
POST /solana-pay/:endpoint
Content-Type: application/json

{
  "account": "customer_pubkey"
}

Response:
{
  "transaction": "base64_serialized_transaction",
  "message": "Payment for Order #123"
}
```

```http
GET /solana-pay/qr/:endpoint
Response: QR code image (PNG)
```

```http
GET /solana-pay/status/:reference
Response: {
  "status": "confirmed",
  "signature": "tx_signature",
  "amount": "1000000"
}
```

## How x402 is Used

Unlike typical x402 implementations where customers pay for access, Shaw 402 uses x402 to protect the **split execution service**:

### Why This Architecture?

1. **Customer Experience**: Customers pay simply via Solana Pay QR codes (no x402 complexity)
2. **Service Protection**: x402 protects the facilitator's split execution service
3. **Agent Authorization**: Only authorized agents can request splits
4. **Replay Protection**: x402 nonce system prevents duplicate split requests
5. **Fair Pricing**: Agents pay small fee to use split execution service

### x402 Flow for Split Execution

```typescript
// 1. Agent creates x402 payment authorization
const paymentRequest = {
  payload: {
    amount: "1000",           // Small fee for split service
    recipient: facilitatorAddress,
    resourceId: "/execute-split",
    resourceUrl: "/execute-split",
    nonce: generateNonce(),
    timestamp: Date.now(),
    expiry: Date.now() + 60000
  },
  signature: signPayload(payload, agentPrivateKey),
  clientPublicKey: agentPublicKey
};

// 2. Agent calls facilitator with x402 header
const response = await fetch('http://facilitator:3001/execute-split', {
  method: 'POST',
  headers: {
    'X-Payment': JSON.stringify(paymentRequest),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    splitId,
    recipients,
    agentUSDCAccount,
    usdcMint,
    agentPrivateKey
  })
});

// 3. Facilitator verifies x402 and executes split
// - Verifies signature and nonce
// - Validates agent keypair matches x402 auth
// - Executes atomic USDC split transaction
```

## Zero-Knowledge Privacy

Shaw 402 includes foundational ZK primitives for privacy-preserving affiliate commerce:

- **Poseidon Hash Commitments**: Hide affiliate IDs and commission amounts
- **NaCl Box Encryption**: Secure agent-server communication
- **ZK Circuit Integration**: Ready for SNARKs/STARKs (future)

See [docs/ZK_PRIVACY_ARCHITECTURE.md](docs/ZK_PRIVACY_ARCHITECTURE.md) for details.

## Development

### Run in Development Mode

```bash
# Terminal 1: Hub API
npm run dev:server

# Terminal 2: Facilitator
npm run dev:facilitator

# Terminal 3: Payment Processor Agent
npm run dev:agent
```

### Code Quality

```bash
npm run lint          # Run ESLint
npm run fmt           # Format with Prettier
npm run fmt:check     # Check formatting
```

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Blockchain**: Solana (Gill SDK + @solana/web3.js)
- **Payments**: Solana Pay, @solana/spl-token (USDC)
- **Database**: SQLite3
- **Privacy**: circomlibjs (Poseidon), tweetnacl (encryption)
- **Process Management**: PM2
- **Validation**: Zod

## Documentation

Detailed documentation available in [`docs/`](docs/):

- [**UNIFIED_ARCHITECTURE_PROPOSAL.md**](docs/UNIFIED_ARCHITECTURE_PROPOSAL.md) - Complete system architecture
- [**AFFILIATE_PLATFORM.md**](docs/AFFILIATE_PLATFORM.md) - Affiliate platform design
- [**AGENT_SYSTEM.md**](docs/AGENT_SYSTEM.md) - Payment processor agents
- [**SOLANA_PAY_INTEGRATION.md**](docs/SOLANA_PAY_INTEGRATION.md) - Solana Pay implementation
- [**USDC_SETTLEMENT.md**](docs/USDC_SETTLEMENT.md) - USDC split mechanics
- [**ZK_PRIVACY_ARCHITECTURE.md**](docs/ZK_PRIVACY_ARCHITECTURE.md) - Zero-knowledge privacy
- [**SETUP.md**](docs/SETUP.md) - Detailed setup instructions

## Security Considerations

- **Private Keys**: Never commit `.env` or private keys to git
- **x402 Authorization**: Validates agent identity before split execution
- **Nonce Replay Protection**: Prevents duplicate split requests
- **Atomic Transactions**: Splits execute atomically or fail completely
- **HTTPS**: Use HTTPS in production for all HTTP communication
- **Rate Limiting**: Implement rate limiting on all public endpoints
- **Input Validation**: All inputs validated with Zod schemas
- **Database Encryption**: Encrypt sensitive data in production

## Production Deployment

### Recommended Setup

1. **Separate Services**: Deploy Hub, Facilitator, and Agents separately
2. **Database**: Use PostgreSQL instead of SQLite for production
3. **Secrets Management**: Use environment-specific secret managers
4. **Monitoring**: Set up PM2 monitoring and alerts
5. **Load Balancing**: Use nginx or similar for reverse proxy
6. **HTTPS**: Configure SSL certificates
7. **Mainnet**: Switch to Solana mainnet-beta RPC endpoints
8. **USDC Mint**: Use mainnet USDC mint address

### Environment Variables for Production

```env
NODE_ENV=production
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
SIMULATE_TRANSACTIONS=false

# Use secure secrets management
FACILITATOR_PRIVATE_KEY=<from_secrets_manager>
```

## Troubleshooting

### Common Issues

**Agent not detecting payments**
- Check agent is monitoring correct wallet address
- Verify Solana RPC endpoint is accessible
- Check agent logs for blockchain polling errors

**Split execution fails**
- Ensure agent has sufficient USDC balance
- Verify all recipient addresses are valid
- Check x402 authorization is correctly signed

**x402 payment verification fails**
- Verify nonce is unique and not expired
- Check signature matches agent public key
- Ensure facilitator is running and accessible

**Database errors**
- Check database file permissions
- Verify SQLite3 is installed
- Ensure data directory exists

## License

MIT

## Contributing

Contributions welcome! Please maintain:

- TypeScript strict mode
- ES modules (import/export)
- Zod validation for all inputs
- Structured error handling
- Comprehensive tests
- Documentation for new features

## Credits

Built with:

- [Solana](https://solana.com/) - High-performance blockchain
- [Solana Pay](https://solanapay.com/) - Mobile wallet payments
- [Gill SDK](https://www.gillsdk.com/) - Solana TypeScript SDK
- [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) - Solana JavaScript API
- [Express.js](https://expressjs.com/) - Web framework
- [PM2](https://pm2.keymetrics.io/) - Process manager
- [circomlibjs](https://github.com/iden3/circomlibjs) - Zero-knowledge primitives
