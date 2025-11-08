//! Shaw 402 Vault Program
//!
//! A Solana smart contract for managing merchant deposits with staking rewards.
//! Merchants deposit SOL or SPL tokens as collateral, which can be staked to earn rewards.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder, will be updated after build

#[program]
pub mod shaw_vault {
    use super::*;

    /// Initialize the vault
    /// Creates the global vault state account
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = bump;
        vault.total_deposits = 0;
        vault.total_merchants = 0;
        vault.min_deposit_sol = 1_000_000_000; // 1 SOL
        vault.min_deposit_token = 100_000_000; // 100 USDC (6 decimals)
        vault.reward_share_rate = 8000; // 80.00% (basis points)
        vault.staking_enabled = true;

        msg!("Vault initialized with authority: {}", vault.authority);
        Ok(())
    }

    /// Deposit SOL into the vault
    /// Merchants deposit SOL as collateral which can be staked
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let merchant_deposit = &mut ctx.accounts.merchant_deposit;

        // Validate minimum deposit
        require!(amount >= vault.min_deposit_sol, VaultError::InsufficientDeposit);

        // Transfer SOL from merchant to vault
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.merchant.key(),
            &ctx.accounts.vault_sol_account.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.merchant.to_account_info(),
                ctx.accounts.vault_sol_account.to_account_info(),
            ],
        )?;

        // Initialize or update merchant deposit record
        if merchant_deposit.is_active {
            merchant_deposit.total_deposited = merchant_deposit
                .total_deposited
                .checked_add(amount)
                .ok_or(VaultError::MathOverflow)?;
        } else {
            let current_time = Clock::get()?.unix_timestamp;
            merchant_deposit.merchant = ctx.accounts.merchant.key();
            merchant_deposit.vault = vault.key();
            merchant_deposit.deposit_token = DepositType::Sol;
            merchant_deposit.total_deposited = amount;
            merchant_deposit.accrued_rewards = 0;
            merchant_deposit.is_active = true;
            merchant_deposit.deposited_at = current_time;
            merchant_deposit.bump = ctx.bumps.merchant_deposit;

            // Initialize performance metrics
            merchant_deposit.total_orders_processed = 0;
            merchant_deposit.total_volume_usd = 0;
            merchant_deposit.current_month_volume = 0;
            merchant_deposit.last_volume_reset = current_time;
            merchant_deposit.monthly_unique_customers = 0;
            merchant_deposit.current_yield_bps = 300; // Start with base 3% APY
        }

        msg!("Deposited {} lamports from merchant {}", amount, ctx.accounts.merchant.key());
        Ok(())
    }

    /// Deposit SPL tokens (USDC) into the vault
    pub fn deposit_token(ctx: Context<DepositTokenAccounts>, amount: u64) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let merchant_deposit = &mut ctx.accounts.merchant_deposit;

        // Validate minimum deposit
        require!(amount >= vault.min_deposit_token, VaultError::InsufficientDeposit);

        // Transfer tokens from merchant to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.merchant_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.merchant.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Initialize or update merchant deposit record
        if merchant_deposit.is_active {
            merchant_deposit.total_deposited = merchant_deposit
                .total_deposited
                .checked_add(amount)
                .ok_or(VaultError::MathOverflow)?;
        } else {
            let current_time = Clock::get()?.unix_timestamp;
            merchant_deposit.merchant = ctx.accounts.merchant.key();
            merchant_deposit.vault = vault.key();
            merchant_deposit.deposit_token = DepositType::SplToken;
            merchant_deposit.total_deposited = amount;
            merchant_deposit.accrued_rewards = 0;
            merchant_deposit.is_active = true;
            merchant_deposit.deposited_at = current_time;
            merchant_deposit.bump = ctx.bumps.merchant_deposit;

            // Initialize performance metrics
            merchant_deposit.total_orders_processed = 0;
            merchant_deposit.total_volume_usd = 0;
            merchant_deposit.current_month_volume = 0;
            merchant_deposit.last_volume_reset = current_time;
            merchant_deposit.monthly_unique_customers = 0;
            merchant_deposit.current_yield_bps = 300; // Start with base 3% APY
        }

        msg!("Deposited {} tokens from merchant {}", amount, ctx.accounts.merchant.key());
        Ok(())
    }

    /// Withdraw deposit and accrued rewards
    /// Merchants can withdraw their full deposit plus rewards
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let merchant_deposit = &mut ctx.accounts.merchant_deposit;

        require!(merchant_deposit.is_active, VaultError::DepositNotActive);
        require!(merchant_deposit.merchant == ctx.accounts.merchant.key(), VaultError::Unauthorized);

        // Calculate current rewards using dynamic yield
        let current_time = Clock::get()?.unix_timestamp;
        let time_elapsed = current_time - merchant_deposit.deposited_at;
        let days_elapsed = time_elapsed / 86400;

        // Use merchant's current dynamic yield (updated by record_order)
        let yield_bps = merchant_deposit.current_yield_bps;

        // Calculate rewards based on dynamic APY
        let annual_reward = merchant_deposit.total_deposited
            .checked_mul(yield_bps as u64)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(10000)
            .ok_or(VaultError::MathOverflow)?;

        let daily_reward = annual_reward
            .checked_div(365)
            .ok_or(VaultError::MathOverflow)?;

        let total_rewards = daily_reward
            .checked_mul(days_elapsed as u64)
            .ok_or(VaultError::MathOverflow)?;

        // Apply merchant share (80%)
        let merchant_rewards = total_rewards
            .checked_mul(ctx.accounts.vault.reward_share_rate as u64)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(10000)
            .ok_or(VaultError::MathOverflow)?;

        let total_withdrawal = merchant_deposit.total_deposited
            .checked_add(merchant_rewards)
            .ok_or(VaultError::MathOverflow)?;

        // Transfer back to merchant based on deposit type
        match merchant_deposit.deposit_token {
            DepositType::Sol => {
                // Transfer SOL back
                **ctx.accounts.vault_sol_account.to_account_info().try_borrow_mut_lamports()? -= total_withdrawal;
                **ctx.accounts.merchant.to_account_info().try_borrow_mut_lamports()? += total_withdrawal;
            }
            DepositType::SplToken => {
                // Transfer tokens back
                let seeds = &[
                    b"vault",
                    ctx.accounts.vault.authority.as_ref(),
                    &[ctx.accounts.vault.bump],
                ];
                let signer = &[&seeds[..]];

                let vault_token_account = ctx.accounts.vault_token_account.as_ref()
                    .ok_or(VaultError::MissingTokenAccount)?;
                let merchant_token_account = ctx.accounts.merchant_token_account.as_ref()
                    .ok_or(VaultError::MissingTokenAccount)?;
                let token_program = ctx.accounts.token_program.as_ref()
                    .ok_or(VaultError::MissingTokenAccount)?;

                let cpi_accounts = Transfer {
                    from: vault_token_account.to_account_info(),
                    to: merchant_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                };
                let cpi_program = token_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
                token::transfer(cpi_ctx, total_withdrawal)?;
            }
        }

        // Mark deposit as withdrawn
        merchant_deposit.is_active = false;
        merchant_deposit.accrued_rewards = merchant_rewards;

        msg!("Withdrawn {} (deposit: {}, rewards: {}) to merchant {}",
            total_withdrawal,
            merchant_deposit.total_deposited,
            merchant_rewards,
            ctx.accounts.merchant.key()
        );

        Ok(())
    }

    /// Update vault parameters (admin only)
    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        min_deposit_sol: Option<u64>,
        min_deposit_token: Option<u64>,
        reward_share_rate: Option<u16>,
        staking_enabled: Option<bool>,
    ) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.vault.authority, VaultError::Unauthorized);

        let vault = &mut ctx.accounts.vault;

        if let Some(min_sol) = min_deposit_sol {
            vault.min_deposit_sol = min_sol;
        }
        if let Some(min_token) = min_deposit_token {
            vault.min_deposit_token = min_token;
        }
        if let Some(rate) = reward_share_rate {
            require!(rate <= 10000, VaultError::InvalidRate);
            vault.reward_share_rate = rate;
        }
        if let Some(enabled) = staking_enabled {
            vault.staking_enabled = enabled;
        }

        msg!("Vault config updated");
        Ok(())
    }

    /// Get current rewards for a merchant deposit with dynamic yield
    pub fn calculate_rewards(ctx: Context<CalculateRewards>) -> Result<u64> {
        let merchant_deposit = &ctx.accounts.merchant_deposit;

        require!(merchant_deposit.is_active, VaultError::DepositNotActive);

        let current_time = Clock::get()?.unix_timestamp;
        let time_elapsed = current_time - merchant_deposit.deposited_at;
        let days_elapsed = time_elapsed / 86400;

        // Calculate dynamic yield APY based on performance
        let yield_bps = calculate_dynamic_yield(
            merchant_deposit.current_month_volume,
            days_elapsed,
        );

        // Convert BPS to percentage (e.g., 1200 BPS = 12%)
        let annual_reward = merchant_deposit.total_deposited
            .checked_mul(yield_bps as u64)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(10000)
            .ok_or(VaultError::MathOverflow)?;

        let daily_reward = annual_reward
            .checked_div(365)
            .ok_or(VaultError::MathOverflow)?;

        let total_rewards = daily_reward
            .checked_mul(days_elapsed as u64)
            .ok_or(VaultError::MathOverflow)?;

        msg!("Current rewards: {} (yield: {}% APY, days: {})",
            total_rewards,
            yield_bps as f64 / 100.0,
            days_elapsed
        );
        Ok(total_rewards)
    }

    /// Record a processed order to update merchant metrics
    /// Called by payment processor agent after successful split
    pub fn record_order(
        ctx: Context<RecordOrder>,
        order_amount_usd: u64,
        _buyer_wallet: Pubkey,
    ) -> Result<()> {
        let merchant_deposit = &mut ctx.accounts.merchant_deposit;
        let current_time = Clock::get()?.unix_timestamp;

        // Reset monthly volume if new month started
        let month_elapsed = (current_time - merchant_deposit.last_volume_reset) / 2592000; // ~30 days
        if month_elapsed >= 1 {
            msg!("Resetting monthly volume (new month started)");
            merchant_deposit.current_month_volume = 0;
            merchant_deposit.monthly_unique_customers = 0;
            merchant_deposit.last_volume_reset = current_time;
        }

        // Validate minimum order amount (anti-gaming)
        require!(order_amount_usd >= 10_000000, VaultError::OrderTooSmall); // $10 minimum

        // Update metrics
        merchant_deposit.total_orders_processed = merchant_deposit
            .total_orders_processed
            .checked_add(1)
            .ok_or(VaultError::MathOverflow)?;

        merchant_deposit.total_volume_usd = merchant_deposit
            .total_volume_usd
            .checked_add(order_amount_usd)
            .ok_or(VaultError::MathOverflow)?;

        merchant_deposit.current_month_volume = merchant_deposit
            .current_month_volume
            .checked_add(order_amount_usd)
            .ok_or(VaultError::MathOverflow)?;

        // Track unique customer (simplified - in production, use a bloom filter or separate account)
        merchant_deposit.monthly_unique_customers = merchant_deposit
            .monthly_unique_customers
            .checked_add(1)
            .ok_or(VaultError::MathOverflow)?;

        // Recalculate current yield based on new metrics
        let days_since_deposit = (current_time - merchant_deposit.deposited_at) / 86400;
        merchant_deposit.current_yield_bps = calculate_dynamic_yield(
            merchant_deposit.current_month_volume,
            days_since_deposit,
        );

        msg!("Order recorded: ${} | Total volume: ${} | Current yield: {}% APY",
            order_amount_usd / 1_000000,
            merchant_deposit.current_month_volume / 1_000000,
            merchant_deposit.current_yield_bps as f64 / 100.0
        );

        Ok(())
    }

    /// Get merchant tier based on performance
    pub fn get_merchant_tier(ctx: Context<GetMerchantTier>) -> Result<u8> {
        let merchant_deposit = &ctx.accounts.merchant_deposit;

        let tier = calculate_merchant_tier(
            merchant_deposit.current_month_volume,
            merchant_deposit.deposited_at,
            Clock::get()?.unix_timestamp,
        );

        msg!("Merchant tier: {} (volume: ${}, yield: {}%)",
            tier_name(tier),
            merchant_deposit.current_month_volume / 1_000000,
            merchant_deposit.current_yield_bps as f64 / 100.0
        );

        Ok(tier)
    }
}

// ============================================================================
// Yield Calculation Functions
// ============================================================================

/// Calculate dynamic yield based on volume and loyalty
/// Returns yield in basis points (BPS), e.g., 1200 = 12%
fn calculate_dynamic_yield(monthly_volume_usd: u64, days_deposited: i64) -> u16 {
    const BASE_YIELD_BPS: u16 = 300;        // 3.00%
    const MAX_VOLUME_BONUS_BPS: u16 = 600;  // 6.00%
    const MAX_LOYALTY_BONUS_BPS: u16 = 300; // 3.00%
    const MAX_TOTAL_YIELD_BPS: u16 = 1200;  // 12.00%

    // Volume bonus: 0-6% based on monthly volume
    // $1M/month = 6% max
    let volume_bonus_bps = if monthly_volume_usd >= 1_000_000_000000 { // $1M in micro-units
        MAX_VOLUME_BONUS_BPS
    } else {
        // Linear interpolation: (volume / 1M) * 6%
        let volume_ratio = (monthly_volume_usd as u128)
            .checked_mul(MAX_VOLUME_BONUS_BPS as u128)
            .unwrap_or(0)
            .checked_div(1_000_000_000000)
            .unwrap_or(0);
        volume_ratio.min(MAX_VOLUME_BONUS_BPS as u128) as u16
    };

    // Loyalty bonus: 0-3% based on time deposited
    // 365 days = 3% max
    let loyalty_bonus_bps = if days_deposited >= 365 {
        MAX_LOYALTY_BONUS_BPS
    } else {
        // Linear interpolation: (days / 365) * 3%
        let loyalty_ratio = (days_deposited as u128)
            .checked_mul(MAX_LOYALTY_BONUS_BPS as u128)
            .unwrap_or(0)
            .checked_div(365)
            .unwrap_or(0);
        loyalty_ratio.min(MAX_LOYALTY_BONUS_BPS as u128) as u16
    };

    // Total yield (capped at 12%)
    let total_yield_bps = BASE_YIELD_BPS
        .saturating_add(volume_bonus_bps)
        .saturating_add(loyalty_bonus_bps)
        .min(MAX_TOTAL_YIELD_BPS);

    total_yield_bps
}

/// Calculate merchant tier (0=Bronze, 1=Silver, 2=Gold, 3=Platinum)
fn calculate_merchant_tier(monthly_volume_usd: u64, deposited_at: i64, current_time: i64) -> u8 {
    let days_deposited = (current_time - deposited_at) / 86400;

    // Tier thresholds
    const TIER_BRONZE: u8 = 0;
    const TIER_SILVER: u8 = 1;
    const TIER_GOLD: u8 = 2;
    const TIER_PLATINUM: u8 = 3;

    // Volume in micro-units (6 decimals): $10k = 10_000_000000
    const VOLUME_SILVER: u64 = 10_000_000000;    // $10k/month
    const VOLUME_GOLD: u64 = 50_000_000000;      // $50k/month
    const VOLUME_PLATINUM: u64 = 200_000_000000; // $200k/month

    const DAYS_SILVER: i64 = 90;
    const DAYS_GOLD: i64 = 180;
    const DAYS_PLATINUM: i64 = 365;

    // Determine tier based on both volume AND time
    if monthly_volume_usd >= VOLUME_PLATINUM && days_deposited >= DAYS_PLATINUM {
        TIER_PLATINUM
    } else if monthly_volume_usd >= VOLUME_GOLD && days_deposited >= DAYS_GOLD {
        TIER_GOLD
    } else if monthly_volume_usd >= VOLUME_SILVER && days_deposited >= DAYS_SILVER {
        TIER_SILVER
    } else {
        TIER_BRONZE
    }
}

/// Get tier name for display
fn tier_name(tier: u8) -> &'static str {
    match tier {
        0 => "Bronze",
        1 => "Silver",
        2 => "Gold",
        3 => "Platinum",
        _ => "Unknown",
    }
}

// ============================================================================
// Account Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::LEN,
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = merchant,
        space = 8 + MerchantDeposit::LEN,
        seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()],
        bump
    )]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    /// CHECK: Vault's SOL account (PDA)
    #[account(
        mut,
        seeds = [b"vault_sol", vault.key().as_ref()],
        bump
    )]
    pub vault_sol_account: AccountInfo<'info>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositTokenAccounts<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = merchant,
        space = 8 + MerchantDeposit::LEN,
        seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()],
        bump
    )]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    #[account(mut)]
    pub merchant_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()],
        bump = merchant_deposit.bump
    )]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    /// CHECK: Vault's SOL account (PDA)
    #[account(
        mut,
        seeds = [b"vault_sol", vault.key().as_ref()],
        bump
    )]
    pub vault_sol_account: AccountInfo<'info>,

    #[account(mut)]
    pub merchant_token_account: Option<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(mut, seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CalculateRewards<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()], bump = merchant_deposit.bump)]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    pub merchant: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordOrder<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()],
        bump = merchant_deposit.bump
    )]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    /// Agent that processed the order (must be merchant's agent)
    pub agent: Signer<'info>,

    /// Merchant wallet (for verification)
    /// CHECK: Verified via PDA seeds
    pub merchant: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct GetMerchantTier<'info> {
    #[account(seeds = [b"vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [b"deposit", vault.key().as_ref(), merchant.key().as_ref()], bump = merchant_deposit.bump)]
    pub merchant_deposit: Account<'info, MerchantDeposit>,

    pub merchant: Signer<'info>,
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct Vault {
    /// Authority that can update vault parameters
    pub authority: Pubkey,
    /// Bump seed for PDA
    pub bump: u8,
    /// Total deposits in vault
    pub total_deposits: u64,
    /// Number of merchants with active deposits
    pub total_merchants: u32,
    /// Minimum SOL deposit required
    pub min_deposit_sol: u64,
    /// Minimum token deposit required
    pub min_deposit_token: u64,
    /// Reward share rate for merchants (basis points, e.g. 8000 = 80%)
    pub reward_share_rate: u16,
    /// Whether staking is enabled
    pub staking_enabled: bool,
}

impl Vault {
    pub const LEN: usize = 32 + 1 + 8 + 4 + 8 + 8 + 2 + 1;
}

#[account]
pub struct MerchantDeposit {
    /// Merchant public key
    pub merchant: Pubkey,
    /// Vault this deposit belongs to
    pub vault: Pubkey,
    /// Type of deposit (SOL or SPL Token)
    pub deposit_token: DepositType,
    /// Total amount deposited
    pub total_deposited: u64,
    /// Accrued rewards (updated on withdrawal)
    pub accrued_rewards: u64,
    /// Whether deposit is active
    pub is_active: bool,
    /// Timestamp of deposit
    pub deposited_at: i64,
    /// Bump seed for PDA
    pub bump: u8,

    // Performance metrics for dynamic yield
    /// Total orders processed (lifetime)
    pub total_orders_processed: u64,
    /// Total volume in USD (micro-units, 6 decimals)
    pub total_volume_usd: u64,
    /// Current month volume in USD
    pub current_month_volume: u64,
    /// Timestamp of last volume reset
    pub last_volume_reset: i64,
    /// Monthly unique customers (simplified tracking)
    pub monthly_unique_customers: u32,
    /// Current yield in basis points (e.g., 1200 = 12%)
    pub current_yield_bps: u16,
}

impl MerchantDeposit {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 8 + 1 + 8 + 1 + 8 + 8 + 8 + 8 + 4 + 2;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DepositType {
    Sol,
    SplToken,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum VaultError {
    #[msg("Deposit amount below minimum requirement")]
    InsufficientDeposit,
    #[msg("Deposit is not active")]
    DepositNotActive,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid rate (must be <= 10000 basis points)")]
    InvalidRate,
    #[msg("Order amount too small (minimum $10)")]
    OrderTooSmall,
    #[msg("Missing required token account")]
    MissingTokenAccount,
}
