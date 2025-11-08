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
            merchant_deposit.merchant = ctx.accounts.merchant.key();
            merchant_deposit.vault = vault.key();
            merchant_deposit.deposit_token = DepositToken::Sol;
            merchant_deposit.total_deposited = amount;
            merchant_deposit.accrued_rewards = 0;
            merchant_deposit.is_active = true;
            merchant_deposit.deposited_at = Clock::get()?.unix_timestamp;
            merchant_deposit.bump = ctx.bumps.merchant_deposit;
        }

        msg!("Deposited {} lamports from merchant {}", amount, ctx.accounts.merchant.key());
        Ok(())
    }

    /// Deposit SPL tokens (USDC) into the vault
    pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
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
            merchant_deposit.merchant = ctx.accounts.merchant.key();
            merchant_deposit.vault = vault.key();
            merchant_deposit.deposit_token = DepositToken::SplToken;
            merchant_deposit.total_deposited = amount;
            merchant_deposit.accrued_rewards = 0;
            merchant_deposit.is_active = true;
            merchant_deposit.deposited_at = Clock::get()?.unix_timestamp;
            merchant_deposit.bump = ctx.bumps.merchant_deposit;
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

        // Calculate current rewards
        let current_time = Clock::get()?.unix_timestamp;
        let time_elapsed = current_time - merchant_deposit.deposited_at;
        let days_elapsed = time_elapsed / 86400;

        // Calculate rewards (7% APY)
        let annual_reward = merchant_deposit.total_deposited
            .checked_mul(7)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(100)
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
            DepositToken::Sol => {
                // Transfer SOL back
                **ctx.accounts.vault_sol_account.to_account_info().try_borrow_mut_lamports()? -= total_withdrawal;
                **ctx.accounts.merchant.to_account_info().try_borrow_mut_lamports()? += total_withdrawal;
            }
            DepositToken::SplToken => {
                // Transfer tokens back
                let seeds = &[
                    b"vault",
                    ctx.accounts.vault.authority.as_ref(),
                    &[ctx.accounts.vault.bump],
                ];
                let signer = &[&seeds[..]];

                let cpi_accounts = Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.merchant_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
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

    /// Get current rewards for a merchant deposit
    pub fn calculate_rewards(ctx: Context<CalculateRewards>) -> Result<u64> {
        let merchant_deposit = &ctx.accounts.merchant_deposit;

        require!(merchant_deposit.is_active, VaultError::DepositNotActive);

        let current_time = Clock::get()?.unix_timestamp;
        let time_elapsed = current_time - merchant_deposit.deposited_at;
        let days_elapsed = time_elapsed / 86400;

        // Calculate rewards (7% APY)
        let annual_reward = merchant_deposit.total_deposited
            .checked_mul(7)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(100)
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

        msg!("Current rewards: {} (days elapsed: {})", merchant_rewards, days_elapsed);
        Ok(merchant_rewards)
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
pub struct DepositToken<'info> {
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
    pub deposit_token: DepositToken,
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
}

impl MerchantDeposit {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 8 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DepositToken {
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
}
