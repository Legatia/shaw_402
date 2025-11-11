# Shaw 402 - Decentralized Affiliate Commerce Platform

> The future of affiliate commerce. Automatic commission splits, powered by Solana.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=flat&logo=solana)](https://explorer.solana.com/address/CNLu8rq8jrAeB4ykwTZJiAmBw5GJMZRURZZSnuZNXJ2h?cluster=devnet)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.1-coral)](https://www.anchor-lang.com/)

## 🚀 What is Shaw 402?

Shaw 402 is a decentralized affiliate commerce platform that enables merchants to run affiliate programs with **automatic commission distribution**. Built on Solana with the x402 cryptographic payment protocol, it combines:

- ✅ **Instant Payouts**: Automatic USDC commission splits on-chain
- 🤖 **Autonomous Agents**: Each merchant gets a dedicated payment processor
- 🔒 **Secure**: x402 protocol with cryptographic authorization
- 💰 **Vault System**: Earn dynamic yield (3-11.5% APY) on merchant deposits
- ⚡ **Fast**: Powered by Solana's high-speed blockchain

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Smart Contract](#smart-contract)
- [Configuration](#configuration)
- [Testing](#testing)
- [Production Checklist](#production-checklist)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### For Merchants
- **One-Click Registration**: 1 SOL refundable security deposit, get instant setup
- **Automatic Agent Provisioning**: Dedicated payment processor with USDC wallet
- **Affiliate Program**: Unique recruitment link with custom commission rates
- **Real-time Tracking**: Monitor transactions and commissions
- **Vault Deposits**: Lock SOL/USDC to earn dynamic APY based on performance
- **Cancel Anytime**: Get your 1 SOL deposit back when you cancel service

### For Affiliates
- **15% Commission**: Automatic USDC payouts on every sale
- **Simple Signup**: Register through merchant's unique link
- **Trackable Links**: Built-in referral tracking via transaction memos
- **Instant Settlement**: Commissions paid immediately on-chain

### For Developers
- **x402 Protocol**: Cryptographic payment authorization
- **TypeScript SDK**: Full type safety and documentation
- **Solana Pay**: Mobile wallet QR code integration
- **RESTful API**: Complete backend API for integrations
- **Smart Contracts**: Anchor-based vault with lock periods

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Shaw 402 Platform                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Facilitator │    │  Hub Server  │    │ Payment Agent│
│  Port 3001   │◄──►│  Port 3000   │◄──►│  (Per Merch) │
│              │    │              │    │              │
│ • x402 Auth  │    │ • API Routes │    │ • Monitor TX │
│ • Settlement │    │ • Static Web │    │ • Auto Split │
│ • Nonce DB   │    │ • Database   │    │ • Confirm    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────▼────────┐
                    │ Solana Devnet  │
                    │                │
                    │ • USDC Token   │
                    │ • Vault Smart  │
                    │   Contract     │
                    └────────────────┘
```

### Payment Flow

```
Customer → Scan QR Code → Pay USDC → Agent Detects
                                          ↓
                              ┌───────────────────┐
                              │ Agent Wallet      │
                              │ (Receives Payment)│
                              └─────────┬─────────┘
                                        │
                        Creates x402 Authorization
                                        │
                              ┌─────────▼─────────┐
                              │   Facilitator     │
                              │ Verifies & Splits │
                              └─────────┬─────────┘
                                        │
                    Atomic 3-Way USDC Distribution
                                        │
        ┌───────────────────────────────┼───────────────────────┐
        │                               │                       │
   ┌────▼─────┐              ┌──────────▼────────┐    ┌────────▼─────┐
   │ Platform │              │    Affiliate      │    │   Merchant   │
   │   (5%)   │              │      (15%)        │    │     (80%)    │
   └──────────┘              └───────────────────┘    └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Solana CLI** 1.18+
- **Anchor** 0.30.1+
- **Rust** 1.75+ (for smart contracts)
- **Phantom Wallet** (for testing frontend)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/shaw_402.git
cd shaw_402

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Generate keypairs
solana-keygen new --outfile facilitator-keypair.json
solana-keygen new --outfile platform-keypair.json
solana-keygen new --outfile vault-authority.json

# Get base58 keys and update .env
node -e "const bs58=require('bs58'),fs=require('fs'); const key=JSON.parse(fs.readFileSync('facilitator-keypair.json')); console.log(bs58.encode(Buffer.from(key)));"
```

### Configuration

Edit `.env` with your keypairs and settings:

```bash
# Facilitator
FACILITATOR_PRIVATE_KEY=<base58_key_from_above>
FACILITATOR_PUBLIC_KEY=<solana-keygen pubkey facilitator-keypair.json>

# Platform
PLATFORM_WALLET=<platform_pubkey>
PLATFORM_PRIVATE_KEY=<platform_base58_key>

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Vault
VAULT_PROGRAM_ID=CNLu8rq8jrAeB4ykwTZJiAmBw5GJMZRURZZSnuZNXJ2h
VAULT_AUTHORITY=<vault_authority_pubkey>
```

### Build & Run

```bash
# Build TypeScript
npm run build

# Build Smart Contract
cd programs/vault && cargo build-sbf
cd ../..

# Start all services with PM2
npm start

# Or start individually
npm run start:facilitator  # Terminal 1
npm run start:server       # Terminal 2
npm run start:agent        # Terminal 3
```

### Access the Platform

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/health
- **Facilitator**: http://localhost:3001/health

## 🌐 Deployment

### Deploy Smart Contract

```bash
# Build the contract
cd programs/vault && cargo build-sbf

# Deploy to devnet
solana program deploy target/deploy/shaw_vault.so

# Update .env with new program ID
VAULT_PROGRAM_ID=<your_program_id>
```

### Production Deployment

```bash
# Build for production
npm run build

# Set environment to mainnet
SOLANA_NETWORK=mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Use mainnet USDC
USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Deploy with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 📁 Project Structure

```
shaw_402/
├── src/
│   ├── facilitator/          # x402 payment settlement service
│   │   └── index.ts
│   ├── server/               # Main API server
│   │   └── index.ts
│   ├── agent/                # Payment processor agents
│   │   ├── index.ts
│   │   └── payment-processor.ts
│   ├── lib/                  # Core libraries
│   │   ├── affiliate-database.ts
│   │   ├── solana-utils.ts
│   │   ├── x402-middleware.ts
│   │   ├── vault-manager.ts
│   │   └── zk-privacy.ts
│   └── routes/               # API endpoints
│       ├── merchant.ts
│       ├── affiliate.ts
│       ├── agent-api.ts
│       └── vault-api.ts
├── programs/vault/           # Solana smart contract
│   └── src/lib.rs
├── public/                   # Frontend
│   ├── index.html
│   └── dashboard.html
├── docs/                     # Documentation
├── simulations/              # Economic simulations
└── tests/                    # Test files
```

## 📚 API Documentation

### Merchant Registration

```bash
POST /merchant/register
Content-Type: application/json

{
  "businessName": "My Store",
  "merchantWallet": "4m1oKRy...",
  "txSignature": "5wojeLe..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchantId": "merchant_abc123",
    "agentWallet": "7xYzPqR...",
    "agentUSDCAccount": "9AbCdEf...",
    "affiliateSignupLink": "http://localhost:3000/affiliate/signup?merchant=merchant_abc123"
  }
}
```

### Affiliate Signup

```bash
POST /merchant/affiliate/register
Content-Type: application/json

{
  "merchantId": "merchant_abc123",
  "affiliateName": "John Doe",
  "affiliateWallet": "8TyUiOp..."
}
```

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-10T22:00:00.000Z",
    "facilitator": {
      "healthy": true,
      "facilitator": "6DUeeyF..."
    }
  }
}
```

## 📜 Smart Contract

### Vault Program

**Program ID**: `CNLu8rq8jrAeB4ykwTZJiAmBw5GJMZRURZZSnuZNXJ2h` (Devnet)

**Instructions:**
- `initialize` - Create vault with authority
- `deposit_sol` - Deposit SOL with lock period
- `deposit_token` - Deposit USDC with lock period
- `withdraw` - Withdraw after unlock time
- `register_agent` - Authorize payment agent
- `record_order` - Track merchant sales
- `record_platform_profit` - Record platform earnings
- `calculate_rewards` - Compute dynamic APY

**Lock Periods:**
- 6 months → max 5% APY
- 1 year → max 6.5% APY
- 3 years → max 9% APY
- 5 years → max 11.5% APY

**Dynamic Yield Formula:**
```
APY = Base (3%) + Volume Bonus (0-3.5%) + Profit Share (0-5%)
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FACILITATOR_PORT` | Facilitator service port | 3001 |
| `SERVER_PORT` | Hub server port | 3000 |
| `SOLANA_NETWORK` | Network (devnet/mainnet) | devnet |
| `PLATFORM_WALLET` | Platform fee destination | Required |
| `REGISTRATION_FEE` | Merchant security deposit (lamports) | 1000000000 (1 SOL, refundable) |
| `VAULT_PROGRAM_ID` | Deployed vault contract | Required |

### Commission Rates

Default rates (configurable per merchant):
- **Platform**: 5%
- **Affiliate**: 15%
- **Merchant**: 80%

### Merchant Cancellation Policy

**Refundable Security Deposit:**
- The 1 SOL registration deposit is fully refundable
- Merchants can cancel service at any time
- Upon cancellation:
  - Your 1 SOL deposit is returned to your wallet
  - All merchant data is removed from our database
  - Agent wallet is deactivated
  - Affiliate links are deactivated
- No cancellation fees or penalties
- Processing time: Instant on-chain refund

## 🧪 Testing

```bash
# Run all tests
npm test

# Individual tests
npm run test:402        # x402 protocol
npm run test:replay     # Replay attack protection
npm run test:payment    # USDC settlements
npm run test:solana-pay # QR code payments

# Smart contract tests
anchor test
```

### Manual Testing Flow

1. **Start services**: `npm start`
2. **Open frontend**: http://localhost:3000
3. **Connect Phantom** wallet
4. **Register merchant** (costs 1 SOL devnet)
5. **Get affiliate link**
6. **Test payment** via Solana Pay QR code

## ✅ Production Checklist

Before deploying to mainnet:

- [ ] Generate production keypairs securely
- [ ] Fund facilitator wallet with SOL
- [ ] Deploy vault contract to mainnet
- [ ] Update all .env variables
- [ ] Change USDC mint to mainnet address
- [ ] Set `SIMULATE_TRANSACTIONS=false`
- [ ] Configure PostgreSQL (migrate from SQLite)
- [ ] Set up monitoring and alerts
- [ ] Enable SSL/HTTPS
- [ ] Configure reverse proxy (nginx)
- [ ] Security audit smart contracts
- [ ] Test vault deposit/withdraw flow
- [ ] Verify commission splits work correctly
- [ ] Load test with expected traffic

## 🔐 Security

### Critical Security Measures

1. **Never commit keypairs** to git
2. **Use environment variables** for all secrets
3. **Validate all inputs** on backend
4. **Verify transactions** on-chain before crediting
5. **Rate limit** API endpoints
6. **Enable CORS** restrictions in production
7. **Audit smart contracts** before mainnet deployment

### Known Security Considerations

- **Vault Contract**: Needs authorization check on `record_platform_profit`
- **Replay Attacks**: Mitigated via nonce database
- **Transaction Verification**: All payments verified on-chain

## 📈 Monitoring

### PM2 Commands

```bash
pm2 logs              # View all logs
pm2 monit            # Real-time monitoring
pm2 restart all      # Restart services
pm2 status           # Check status
```

### Health Endpoints

Monitor these URLs:
- Facilitator: http://localhost:3001/health
- Hub Server: http://localhost:3000/health

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **Live Demo**: http://localhost:3000 (when running)
- **Smart Contract**: [Solana Explorer](https://explorer.solana.com/address/CNLu8rq8jrAeB4ykwTZJiAmBw5GJMZRURZZSnuZNXJ2h?cluster=devnet)
- **Documentation**: [docs/](docs/)
- **Testing Report**: [TESTING_REPORT.md](TESTING_REPORT.md)

## 💬 Support

For questions and support:
- Open an issue on GitHub
- Check the [documentation](docs/)
- Review the [TESTING_REPORT.md](TESTING_REPORT.md)

## 🙏 Acknowledgments

- Built with [Anchor Framework](https://www.anchor-lang.com/)
- Powered by [Solana](https://solana.com/)
- Uses [Solana Pay](https://solanapay.com/) protocol
- Integrates [Phantom Wallet](https://phantom.app/)

---

**Built with ❤️ on Solana**

*Shaw 402 - The future of affiliate commerce is decentralized.*
