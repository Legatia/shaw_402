# Shaw 402 Documentation

This directory contains comprehensive documentation for the Shaw 402 Affiliate Commerce Platform.

## Documentation Index

### Architecture & Design

- **[UNIFIED_ARCHITECTURE_PROPOSAL.md](UNIFIED_ARCHITECTURE_PROPOSAL.md)** - Complete system architecture overview
  - Unified payment flow design
  - Component interaction diagrams
  - Database schemas
  - Integration patterns

- **[AFFILIATE_PLATFORM.md](AFFILIATE_PLATFORM.md)** - Affiliate commerce platform design
  - Merchant onboarding flow
  - Affiliate registration and tracking
  - Commission calculation logic
  - Data models and relationships

- **[AGENT_SYSTEM.md](AGENT_SYSTEM.md)** - Payment processor agent architecture
  - Autonomous agent design
  - Blockchain monitoring
  - Payment detection and processing
  - Hub API integration

### Features & Integration

- **[SOLANA_PAY_INTEGRATION.md](SOLANA_PAY_INTEGRATION.md)** - Solana Pay implementation
  - QR code generation
  - Transaction request specifications
  - Wallet integration guide
  - Testing procedures

- **[USDC_SETTLEMENT.md](USDC_SETTLEMENT.md)** - USDC payment splitting mechanics
  - Atomic multi-party splits
  - SPL token operations
  - Fee calculations
  - Error handling

- **[ZK_PRIVACY_ARCHITECTURE.md](ZK_PRIVACY_ARCHITECTURE.md)** - Zero-knowledge privacy primitives
  - Poseidon hash commitments
  - NaCl box encryption
  - ZK circuit integration (future)
  - Privacy-preserving affiliate IDs

### Workflow Analysis

- **[CURRENT_WORKFLOW_ANALYSIS.md](CURRENT_WORKFLOW_ANALYSIS.md)** - System workflow analysis
  - Use case simulations
  - Component interaction analysis
  - Gap identification
  - Architecture evolution

### Setup & Configuration

- **[SETUP.md](SETUP.md)** - Detailed setup instructions
  - Environment configuration
  - Database initialization
  - Service deployment
  - Testing procedures

## Quick Navigation

### For Developers

Start with:
1. [UNIFIED_ARCHITECTURE_PROPOSAL.md](UNIFIED_ARCHITECTURE_PROPOSAL.md) - Understand the overall system
2. [SETUP.md](SETUP.md) - Get the system running
3. [AFFILIATE_PLATFORM.md](AFFILIATE_PLATFORM.md) - Understand the business logic

### For Integrators

Focus on:
1. [SOLANA_PAY_INTEGRATION.md](SOLANA_PAY_INTEGRATION.md) - Customer payment integration
2. [AGENT_SYSTEM.md](AGENT_SYSTEM.md) - Agent setup and configuration
3. [USDC_SETTLEMENT.md](USDC_SETTLEMENT.md) - Payment split mechanics

### For Security Researchers

Review:
1. [ZK_PRIVACY_ARCHITECTURE.md](ZK_PRIVACY_ARCHITECTURE.md) - Privacy primitives
2. [UNIFIED_ARCHITECTURE_PROPOSAL.md](UNIFIED_ARCHITECTURE_PROPOSAL.md) - System security model
3. Main [README.md](../README.md) - Security considerations

## Contributing to Documentation

When adding new documentation:

1. Follow the existing structure and formatting
2. Include code examples where applicable
3. Add diagrams for complex concepts
4. Update this index with new files
5. Cross-reference related documents

## Documentation Standards

- Use Markdown formatting
- Include table of contents for long documents
- Provide code examples in TypeScript
- Add ASCII diagrams for architecture
- Keep sections focused and concise
- Link to external resources where helpful
