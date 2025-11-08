# Shaw 402 Vault Program

An on-chain Solana smart contract for managing merchant deposits with staking rewards.

## Overview

The Shaw Vault program is a Solana smart contract that handles:
- **Merchant Deposits**: Merchants deposit SOL or SPL tokens as collateral
- **Staking Rewards**: Deposits can be staked to earn rewards (7% APY)
- **Reward Distribution**: 80% of staking rewards go to merchants, 20% to platform
- **Withdrawals**: Merchants can withdraw deposits + accrued rewards

## Program Structure

```
programs/vault/
├── Cargo.toml          # Rust dependencies
├── Xargo.toml          # Cross-compilation config
└── src/
    └── lib.rs          # Main program code
```

## Account Structure

### Vault (PDA: `["vault", authority]`)
Global vault state holding configuration:
- `authority`: Admin who can update vault parameters
- `min_deposit_sol`: Minimum SOL deposit (default: 1 SOL)
- `min_deposit_token`: Minimum token deposit (default: 100 USDC)
- `reward_share_rate`: Merchant share of rewards (default: 8000 = 80%)
- `staking_enabled`: Whether staking is active
- `total_deposits`: Total amount deposited
- `total_merchants`: Number of active merchants

### MerchantDeposit (PDA: `["deposit", vault, merchant]`)
Per-merchant deposit record:
- `merchant`: Merchant's public key
- `deposit_token`: Sol or SplToken
- `total_deposited`: Amount deposited
- `accrued_rewards`: Rewards earned
- `is_active`: Whether deposit is active
- `deposited_at`: Timestamp of deposit

### Vault SOL Account (PDA: `["vault_sol", vault]`)
Holds SOL deposits from all merchants.

## Instructions

### 1. Initialize
```rust
pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()>
```
Creates the vault with default parameters. Only needs to be called once.

**Accounts:**
- `vault` (PDA, init): The vault state account
- `authority` (signer): Admin who can update vault
- `system_program`: Solana system program

### 2. Deposit SOL
```rust
pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()>
```
Merchant deposits SOL into the vault.

**Accounts:**
- `vault` (PDA): The vault state
- `merchant_deposit` (PDA, init_if_needed): Merchant's deposit record
- `vault_sol_account` (PDA): Vault's SOL holding account
- `merchant` (signer): The merchant making the deposit
- `system_program`: Solana system program

**Parameters:**
- `amount`: Amount of SOL in lamports

### 3. Deposit Token
```rust
pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()>
```
Merchant deposits SPL tokens (e.g., USDC) into the vault.

**Accounts:**
- `vault` (PDA): The vault state
- `merchant_deposit` (PDA, init_if_needed): Merchant's deposit record
- `merchant_token_account`: Merchant's token account
- `vault_token_account`: Vault's token account
- `merchant` (signer): The merchant making the deposit
- `token_program`: SPL Token program
- `system_program`: Solana system program

**Parameters:**
- `amount`: Amount of tokens (in token's native decimals)

### 4. Withdraw
```rust
pub fn withdraw(ctx: Context<Withdraw>) -> Result<()>
```
Merchant withdraws their deposit plus accrued rewards.

**Calculation:**
```
days_elapsed = (current_time - deposited_at) / 86400
annual_reward = total_deposited * 0.07 (7% APY)
daily_reward = annual_reward / 365
total_rewards = daily_reward * days_elapsed
merchant_rewards = total_rewards * 0.80 (80% share)
total_withdrawal = total_deposited + merchant_rewards
```

**Accounts:**
- `vault` (PDA): The vault state
- `merchant_deposit` (PDA): Merchant's deposit record
- `vault_sol_account` (PDA): Vault's SOL account (if SOL deposit)
- `merchant_token_account`: Merchant's token account (if token deposit)
- `vault_token_account`: Vault's token account (if token deposit)
- `merchant` (signer): The merchant withdrawing
- `token_program`: SPL Token program (if token deposit)
- `system_program`: Solana system program

### 5. Update Vault Config
```rust
pub fn update_vault_config(
    ctx: Context<UpdateVaultConfig>,
    min_deposit_sol: Option<u64>,
    min_deposit_token: Option<u64>,
    reward_share_rate: Option<u16>,
    staking_enabled: Option<bool>,
) -> Result<()>
```
Admin-only function to update vault parameters.

### 6. Calculate Rewards
```rust
pub fn calculate_rewards(ctx: Context<CalculateRewards>) -> Result<u64>
```
View function to calculate current rewards for a merchant.

## Building the Program

### Prerequisites
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor (optional, but recommended)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### Build
```bash
# Navigate to programs directory
cd programs/vault

# Build the program
cargo build-bpf

# Or with Anchor
anchor build
```

### Deploy
```bash
# Deploy to devnet
solana program deploy target/deploy/shaw_vault.so --program-id target/deploy/shaw_vault-keypair.json

# Or with Anchor
anchor deploy --provider.cluster devnet
```

### Get Program ID
```bash
solana address -k target/deploy/shaw_vault-keypair.json
```

Update the program ID in:
- `programs/vault/src/lib.rs` (line 9: `declare_id!`)
- `Anchor.toml` (programs.devnet.shaw_vault)
- `src/lib/vault-program-client.ts` (VAULT_PROGRAM_ID)

## Testing

### Unit Tests
```bash
cargo test-bpf
```

### Integration Tests
```bash
anchor test
```

## TypeScript Client

See `src/lib/vault-program-client.ts` for the TypeScript SDK to interact with the program.

### Example Usage

```typescript
import { VaultProgramClient } from './src/lib/vault-program-client';
import { Connection, Keypair } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const connection = new Connection('https://api.devnet.solana.com');
const client = new VaultProgramClient(connection);

// Initialize vault
const authority = Keypair.generate();
await client.initialize(authority);

// Merchant deposits 1 SOL
const merchant = Keypair.generate();
const amount = new BN(1_000_000_000); // 1 SOL
await client.depositSol(merchant, authority.publicKey, amount);

// Check rewards after 30 days
const rewards = await client.calculateRewards(merchant.publicKey, authority.publicKey);
console.log(`Accrued rewards: ${rewards.toString()} lamports`);

// Withdraw deposit + rewards
await client.withdraw(merchant, authority.publicKey);
```

## Security Considerations

1. **PDA Seeds**: All PDAs use deterministic seeds for security
2. **Signer Checks**: All instructions verify correct signers
3. **Math Safety**: All arithmetic uses checked operations
4. **Reward Calculation**: Done on-chain to prevent manipulation
5. **Authority**: Only vault authority can update parameters

## Future Enhancements

- Integration with native Solana staking (stake accounts)
- Marinade Finance liquid staking (mSOL)
- Jito MEV-boosted staking
- Multi-sig authority
- Slashing for merchant violations
- Time-locked withdrawals
- Reward compounding

## License

MIT
