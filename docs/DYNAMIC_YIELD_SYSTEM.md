# Dynamic Yield System

The Shaw 402 Vault implements a performance-based dynamic yield system that rewards high-performing merchants with higher APY on their deposits.

## Overview

Unlike traditional fixed-rate staking, the vault offers **dynamic APY** that adjusts based on:
- **Transaction volume**: How much business the merchant processes
- **Loyalty**: How long they've been deposited

This incentivizes merchants to:
1. Process more transactions through Shaw 402
2. Maintain long-term deposits
3. Build sustainable, high-volume businesses

## Yield Formula

### Components

The total APY is composed of three parts:

```
Total APY = Base Yield + Volume Bonus + Loyalty Bonus
```

**Maximum APY: 12%**

#### 1. Base Yield: 3%

All merchants start with a baseline **3% APY** from day one. This is guaranteed regardless of performance.

#### 2. Volume Bonus: 0-6%

Merchants earn additional yield based on their **monthly transaction volume**:

- **$0/month**: 0% bonus
- **$1M/month**: 6% bonus (maximum)
- **Linear interpolation** between $0 and $1M

**Formula:**
```
Volume Bonus = min(6%, (Monthly Volume USD / $1,000,000) * 6%)
```

**Examples:**
- $100k/month → 0.6% bonus
- $250k/month → 1.5% bonus
- $500k/month → 3.0% bonus
- $1M+/month → 6.0% bonus (max)

#### 3. Loyalty Bonus: 0-3%

Merchants earn additional yield based on **time deposited**:

- **Day 1**: 0% bonus
- **365 days**: 3% bonus (maximum)
- **Linear interpolation** between 0 and 365 days

**Formula:**
```
Loyalty Bonus = min(3%, (Days Deposited / 365) * 3%)
```

**Examples:**
- 30 days → 0.25% bonus
- 90 days → 0.74% bonus
- 180 days → 1.48% bonus
- 365+ days → 3.0% bonus (max)

### Total Yield Examples

| Monthly Volume | Days Deposited | Base | Volume Bonus | Loyalty Bonus | **Total APY** |
|----------------|----------------|------|--------------|---------------|---------------|
| $0             | 0              | 3%   | 0%           | 0%            | **3.0%**      |
| $50k           | 30             | 3%   | 0.3%         | 0.25%         | **3.55%**     |
| $100k          | 90             | 3%   | 0.6%         | 0.74%         | **4.34%**     |
| $250k          | 180            | 3%   | 1.5%         | 1.48%         | **5.98%**     |
| $500k          | 365            | 3%   | 3.0%         | 3.0%          | **9.0%**      |
| $1M+           | 365+           | 3%   | 6.0%         | 3.0%          | **12.0%**     |

## Merchant Tier System

Merchants are categorized into tiers based on their combined volume and loyalty. Tiers provide a quick way to understand merchant standing.

### Tier Requirements

| Tier       | Monthly Volume | Days Deposited | Typical APY Range |
|------------|----------------|----------------|-------------------|
| 🥉 Bronze  | < $10k         | < 90           | 3.0% - 4.5%       |
| 🥈 Silver  | ≥ $10k         | ≥ 90           | 4.5% - 6.5%       |
| 🥇 Gold    | ≥ $50k         | ≥ 180          | 6.5% - 9.0%       |
| 💎 Platinum| ≥ $200k        | ≥ 365          | 9.0% - 12.0%      |

**Note:** Both volume AND time requirements must be met to advance tiers.

### Tier Progression Example

Let's follow a merchant's journey from Bronze to Platinum:

**Month 1-3 (Bronze)**
- Monthly volume: $5k
- Days: 0-90
- APY: ~3.3%

**Month 4-6 (Silver)**
- Monthly volume: $15k
- Days: 90-180
- APY: ~4.8%

**Month 7-12 (Gold)**
- Monthly volume: $60k
- Days: 180-365
- APY: ~7.5%

**Month 13+ (Platinum)**
- Monthly volume: $250k
- Days: 365+
- APY: ~10.5%

## How It Works: Technical Details

### On-Chain Tracking

Every merchant deposit account (`MerchantDeposit`) tracks:

```rust
pub struct MerchantDeposit {
    // ... basic fields

    // Performance metrics (updated by record_order)
    pub total_orders_processed: u64,
    pub total_volume_usd: u64,
    pub current_month_volume: u64,
    pub last_volume_reset: i64,
    pub monthly_unique_customers: u32,
    pub current_yield_bps: u16,  // Current APY in basis points
}
```

### Order Recording

After each successful payment split, the payment processor agent calls:

```rust
pub fn record_order(
    ctx: Context<RecordOrder>,
    order_amount_usd: u64,
    buyer_wallet: Pubkey,
) -> Result<()>
```

This instruction:
1. **Validates** minimum order size ($10)
2. **Updates** total orders and volume
3. **Resets** monthly metrics if a new month started
4. **Recalculates** the merchant's current yield
5. **Stores** the new APY in `current_yield_bps`

### Monthly Volume Reset

The system automatically resets monthly volume metrics every ~30 days:

```rust
let month_elapsed = (current_time - last_volume_reset) / 2592000; // 30 days
if month_elapsed >= 1 {
    current_month_volume = 0;
    monthly_unique_customers = 0;
    last_volume_reset = current_time;
}
```

This ensures merchants must maintain consistent performance to keep high yields.

### Reward Calculation

When merchants withdraw, rewards are calculated using their **current dynamic yield**:

```rust
// Annual reward based on current APY
annual_reward = total_deposited * (current_yield_bps / 10000)

// Daily reward
daily_reward = annual_reward / 365

// Total rewards for time deposited
total_rewards = daily_reward * days_elapsed

// Merchant receives 80% (platform keeps 20%)
merchant_rewards = total_rewards * 0.80
```

## Anti-Gaming Measures

To prevent merchants from gaming the system, several safeguards are in place:

### 1. Minimum Order Size

Orders must be at least **$10** to count toward volume:

```rust
require!(order_amount_usd >= 10_000000, VaultError::OrderTooSmall);
```

This prevents merchants from creating thousands of tiny fake orders.

### 2. Monthly Reset

Volume resets every 30 days, so merchants can't coast on past performance. They must maintain consistent business activity.

### 3. Unique Customer Tracking

The system tracks `monthly_unique_customers` to detect suspicious patterns (though simplified in v1).

### 4. On-Chain Verification

All order recording is done on-chain by authorized payment processor agents, making it tamper-proof.

### 5. Combined Requirements

Tier advancement requires **both** high volume **and** long deposit duration. A merchant can't just deposit for one month and immediately hit Platinum.

## Example Scenarios

### Scenario 1: New Merchant Growth

**Alice** runs a small online store selling handmade jewelry.

**Initial Deposit:**
- Deposits: 5 SOL (~$1000)
- Month 1 volume: $3k
- APY: 3.18%
- Monthly rewards: ~$2.65

**After 6 Months:**
- Deposits: 5 SOL
- Month 6 volume: $12k (growing business)
- APY: 4.44%
- Monthly rewards: ~$3.70

**After 1 Year:**
- Deposits: 10 SOL (~$2000, added more)
- Month 12 volume: $30k
- APY: 6.80%
- Monthly rewards: ~$11.33

**After 2 Years:**
- Deposits: 20 SOL (~$4000)
- Monthly volume: $80k (established business)
- APY: 9.80%
- Monthly rewards: ~$32.67

### Scenario 2: High-Volume Merchant

**Bob** operates a popular electronics store.

**Initial Deposit:**
- Deposits: 100 SOL (~$20,000)
- Month 1 volume: $200k
- APY: 4.20%
- Monthly rewards: ~$70

**After 6 Months:**
- Deposits: 100 SOL
- Month 6 volume: $400k
- APY: 7.48%
- Monthly rewards: ~$124.67

**After 1 Year:**
- Deposits: 200 SOL (~$40,000, reinvested rewards)
- Month 12 volume: $800k
- APY: 12.0% (maxed out!)
- Monthly rewards: ~$400

**After 2 Years:**
- Deposits: 500 SOL (~$100,000)
- Monthly volume: $1.5M
- APY: 12.0% (maxed)
- Monthly rewards: ~$1,000

### Scenario 3: Dormant Merchant

**Carol** deposits but processes few orders.

**Initial Deposit:**
- Deposits: 10 SOL
- Month 1 volume: $500
- APY: 3.03%

**After 6 Months:**
- Deposits: 10 SOL
- Month 6 volume: $500 (no growth)
- APY: 4.53% (only loyalty bonus growing)

**After 1 Year:**
- Deposits: 10 SOL
- Month 12 volume: $500
- APY: 6.03% (still just base + loyalty)

Carol still earns rewards for loyalty, but not as much as active merchants.

## Maximizing Your Yield

### For New Merchants

1. **Start early**: The loyalty bonus grows daily
2. **Process volume quickly**: Even small consistent volume adds up
3. **Aim for $10k/month**: This unlocks Silver tier and meaningful bonuses
4. **Reinvest rewards**: Compound your gains

### For Growing Merchants

1. **Target $50k/month**: Gold tier unlocks at 6+ months
2. **Build customer base**: More unique customers = sustainable volume
3. **Average $30+ per order**: Stay well above the $10 minimum
4. **Maintain consistency**: Monthly resets reward sustained performance

### For Established Merchants

1. **Push toward $1M/month**: Maximizes volume bonus (6%)
2. **Stay deposited 365+ days**: Maximizes loyalty bonus (3%)
3. **Hit 12% APY**: The ultimate goal
4. **Increase deposit size**: More capital = more rewards at max APY

## Technical Integration

### For Frontend Developers

Display merchant tier and current APY:

```typescript
import { VaultProgramClient } from './vault-program-client';

const client = new VaultProgramClient(connection);

// Get merchant deposit data
const deposit = await client.getMerchantDeposit(vaultPda, merchantPubkey);

// Display current APY
const currentAPY = deposit.current_yield_bps / 100; // Convert BPS to percentage
console.log(`Current APY: ${currentAPY}%`);

// Get tier
const tier = await client.getMerchantTier(merchantPubkey, vaultAuthority);
const tierNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];
console.log(`Tier: ${tierNames[tier]}`);
```

### For Backend Developers

Record orders after successful splits:

```typescript
// After processing payment split successfully
await vaultProgram.methods
  .recordOrder(
    new BN(orderAmountUSD * 1_000000), // Convert to micro-units
    buyerWallet
  )
  .accounts({
    vault: vaultPda,
    merchantDeposit: merchantDepositPda,
    agent: agentKeypair.publicKey,
    merchant: merchantPubkey,
  })
  .signers([agentKeypair])
  .rpc();
```

## Future Enhancements

Potential improvements to the yield system:

1. **Bloom Filters**: More accurate unique customer tracking
2. **Tier Benefits**: Additional perks beyond APY (lower fees, priority support)
3. **Boost Events**: Temporary yield multipliers during promotions
4. **Referral Bonuses**: Extra yield for bringing in new merchants
5. **Staking Delegation**: Let merchants choose staking protocols (Marinade, Jito)
6. **NFT Badges**: On-chain collectible tier badges
7. **DAO Governance**: Platinum merchants vote on platform parameters

## FAQ

### Q: Does my yield change immediately when I process an order?

**A:** Yes! The `record_order` instruction recalculates your APY after each order. You'll see your yield increase in real-time as you process more volume.

### Q: What happens if my monthly volume drops next month?

**A:** Your volume bonus will decrease, but your loyalty bonus continues to grow. The system resets monthly volume every ~30 days, so you need consistent performance.

### Q: Can I withdraw and re-deposit to keep my tier?

**A:** No. When you withdraw, your deposit becomes inactive. If you re-deposit later, you start over as a new deposit with day 0 loyalty bonus.

### Q: Is the 80/20 split applied before or after the dynamic yield calculation?

**A:** After. The dynamic yield (3-12%) is calculated first, then 80% goes to the merchant and 20% to the platform.

### Q: What if I deposit more SOL later?

**A:** Additional deposits increase your `total_deposited`, which increases your absolute rewards. However, your APY percentage stays the same based on your volume and loyalty.

### Q: Can I reach 12% APY in my first month?

**A:** No. Even with $1M+ volume in month 1, you'd only have 6% (volume) + 3% (base) = 9% APY. You need 365 days for the full 3% loyalty bonus.

### Q: What counts as "monthly volume"?

**A:** All orders processed through Shaw 402 that are ≥$10, recorded by the `record_order` instruction. Only successful splits count.

### Q: Is my yield affected by the price of SOL/USDC?

**A:** No. Yield is calculated on the deposited amount (e.g., 10 SOL), not USD value. However, volume tracking is in USD for consistency across SOL and USDC deposits.

## Summary

The Dynamic Yield System creates a win-win:

- **Merchants**: Higher rewards for better performance
- **Platform**: Incentivizes transaction volume and long-term commitment
- **Ecosystem**: Attracts and retains high-quality merchants

**Key Takeaways:**
- Start with 3% APY guaranteed
- Earn up to 12% APY maximum
- Volume and loyalty both matter
- Rewards are calculated on-chain
- System is designed to be fair and anti-gaming

Ready to maximize your yield? [Deploy your vault deposit →](../programs/README.md)
