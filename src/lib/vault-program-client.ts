/**
 * Vault Program Client
 * TypeScript SDK for interacting with the on-chain Shaw Vault program
 */

import { PublicKey, Connection, Keypair, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN, web3 } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// Vault Program ID (will be updated after deployment)
export const VAULT_PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

export enum DepositType {
  Sol = 0,
  SplToken = 1,
}

export interface VaultConfig {
  authority: PublicKey;
  bump: number;
  totalDeposits: BN;
  totalMerchants: number;
  minDepositSol: BN;
  minDepositToken: BN;
  rewardShareRate: number;
  stakingEnabled: boolean;
}

export interface MerchantDeposit {
  merchant: PublicKey;
  vault: PublicKey;
  depositToken: DepositType;
  totalDeposited: BN;
  accruedRewards: BN;
  isActive: boolean;
  depositedAt: BN;
  bump: number;
}

export class VaultProgramClient {
  private connection: Connection;
  private program: Program | null = null;

  constructor(connection: Connection, programId: PublicKey = VAULT_PROGRAM_ID) {
    this.connection = connection;
    // In production, load the IDL and create the Program instance
    // this.program = new Program(idl, programId, provider);
  }

  /**
   * Derive vault PDA
   */
  static findVaultAddress(authority: PublicKey, programId: PublicKey = VAULT_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from('vault'), authority.toBuffer()], programId);
  }

  /**
   * Derive vault SOL account PDA
   */
  static findVaultSolAddress(vault: PublicKey, programId: PublicKey = VAULT_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from('vault_sol'), vault.toBuffer()], programId);
  }

  /**
   * Derive merchant deposit PDA
   */
  static findMerchantDepositAddress(
    vault: PublicKey,
    merchant: PublicKey,
    programId: PublicKey = VAULT_PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from('deposit'), vault.toBuffer(), merchant.toBuffer()], programId);
  }

  /**
   * Initialize the vault
   */
  async initialize(authority: Keypair): Promise<string> {
    const [vaultPda, bump] = VaultProgramClient.findVaultAddress(authority.publicKey);

    console.log('Initializing vault...');
    console.log(`  Authority: ${authority.publicKey.toString()}`);
    console.log(`  Vault PDA: ${vaultPda.toString()}`);
    console.log(`  Bump: ${bump}`);

    // Create instruction data
    // In production, use the Anchor program's methods
    // For now, this is a placeholder showing the structure
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: VAULT_PROGRAM_ID,
      data: Buffer.from([0, bump]), // Instruction discriminator + bump
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [authority]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ Vault initialized: ${signature}`);
    return signature;
  }

  /**
   * Deposit SOL to the vault
   */
  async depositSol(merchant: Keypair, vaultAuthority: PublicKey, amount: BN): Promise<string> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [depositPda, depositBump] = VaultProgramClient.findMerchantDepositAddress(vaultPda, merchant.publicKey);
    const [vaultSolPda] = VaultProgramClient.findVaultSolAddress(vaultPda);

    console.log('Depositing SOL to vault...');
    console.log(`  Merchant: ${merchant.publicKey.toString()}`);
    console.log(`  Amount: ${amount.toString()} lamports`);
    console.log(`  Vault: ${vaultPda.toString()}`);
    console.log(`  Deposit PDA: ${depositPda.toString()}`);

    // Create instruction (placeholder structure)
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: false },
        { pubkey: depositPda, isSigner: false, isWritable: true },
        { pubkey: vaultSolPda, isSigner: false, isWritable: true },
        { pubkey: merchant.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: VAULT_PROGRAM_ID,
      data: Buffer.concat([
        Buffer.from([1]), // Instruction discriminator for deposit_sol
        amount.toArrayLike(Buffer, 'le', 8),
      ]),
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [merchant]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ SOL deposited: ${signature}`);
    return signature;
  }

  /**
   * Deposit SPL tokens to the vault
   */
  async depositToken(
    merchant: Keypair,
    vaultAuthority: PublicKey,
    tokenMint: PublicKey,
    amount: BN
  ): Promise<string> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [depositPda] = VaultProgramClient.findMerchantDepositAddress(vaultPda, merchant.publicKey);

    const merchantTokenAccount = await getAssociatedTokenAddress(tokenMint, merchant.publicKey);
    const vaultTokenAccount = await getAssociatedTokenAddress(tokenMint, vaultPda, true);

    console.log('Depositing tokens to vault...');
    console.log(`  Merchant: ${merchant.publicKey.toString()}`);
    console.log(`  Amount: ${amount.toString()}`);
    console.log(`  Token Mint: ${tokenMint.toString()}`);

    // Create instruction (placeholder structure)
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: false },
        { pubkey: depositPda, isSigner: false, isWritable: true },
        { pubkey: merchantTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: merchant.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: VAULT_PROGRAM_ID,
      data: Buffer.concat([
        Buffer.from([2]), // Instruction discriminator for deposit_token
        amount.toArrayLike(Buffer, 'le', 8),
      ]),
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [merchant]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ Tokens deposited: ${signature}`);
    return signature;
  }

  /**
   * Withdraw deposit and rewards
   */
  async withdraw(merchant: Keypair, vaultAuthority: PublicKey, tokenMint?: PublicKey): Promise<string> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [depositPda] = VaultProgramClient.findMerchantDepositAddress(vaultPda, merchant.publicKey);
    const [vaultSolPda] = VaultProgramClient.findVaultSolAddress(vaultPda);

    console.log('Withdrawing from vault...');
    console.log(`  Merchant: ${merchant.publicKey.toString()}`);
    console.log(`  Vault: ${vaultPda.toString()}`);

    const keys = [
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: depositPda, isSigner: false, isWritable: true },
      { pubkey: vaultSolPda, isSigner: false, isWritable: true },
      { pubkey: merchant.publicKey, isSigner: true, isWritable: true },
    ];

    // Add token accounts if withdrawing tokens
    if (tokenMint) {
      const merchantTokenAccount = await getAssociatedTokenAddress(tokenMint, merchant.publicKey);
      const vaultTokenAccount = await getAssociatedTokenAddress(tokenMint, vaultPda, true);
      keys.push(
        { pubkey: merchantTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      );
    }

    keys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });

    const instruction = new TransactionInstruction({
      keys,
      programId: VAULT_PROGRAM_ID,
      data: Buffer.from([3]), // Instruction discriminator for withdraw
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [merchant]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ Withdrawal completed: ${signature}`);
    return signature;
  }

  /**
   * Get vault account data
   */
  async getVault(authority: PublicKey): Promise<VaultConfig | null> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(authority);
    const accountInfo = await this.connection.getAccountInfo(vaultPda);

    if (!accountInfo) {
      return null;
    }

    // Parse account data (simplified - in production use Anchor's deserialize)
    // This is a placeholder showing the structure
    console.log(`Vault account found at ${vaultPda.toString()}`);
    console.log(`  Data length: ${accountInfo.data.length}`);

    return {
      authority,
      bump: 0,
      totalDeposits: new BN(0),
      totalMerchants: 0,
      minDepositSol: new BN(0),
      minDepositToken: new BN(0),
      rewardShareRate: 0,
      stakingEnabled: false,
    };
  }

  /**
   * Get merchant deposit data
   */
  async getMerchantDeposit(vault: PublicKey, merchant: PublicKey): Promise<MerchantDeposit | null> {
    const [depositPda] = VaultProgramClient.findMerchantDepositAddress(vault, merchant);
    const accountInfo = await this.connection.getAccountInfo(depositPda);

    if (!accountInfo) {
      return null;
    }

    console.log(`Merchant deposit found at ${depositPda.toString()}`);
    console.log(`  Data length: ${accountInfo.data.length}`);

    return {
      merchant,
      vault,
      depositToken: DepositType.Sol,
      totalDeposited: new BN(0),
      accruedRewards: new BN(0),
      isActive: false,
      depositedAt: new BN(0),
      bump: 0,
    };
  }

  /**
   * Calculate current rewards for a merchant
   */
  async calculateRewards(merchant: PublicKey, vaultAuthority: PublicKey): Promise<BN> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [depositPda] = VaultProgramClient.findMerchantDepositAddress(vaultPda, merchant);

    // In production, call the on-chain calculate_rewards instruction
    // For now, calculate off-chain as demonstration
    const deposit = await this.getMerchantDeposit(vaultPda, merchant);

    if (!deposit || !deposit.isActive) {
      return new BN(0);
    }

    const now = Math.floor(Date.now() / 1000);
    const timeElapsed = now - deposit.depositedAt.toNumber();
    const daysElapsed = Math.floor(timeElapsed / 86400);

    // 7% APY
    const annualReward = deposit.totalDeposited.muln(7).divn(100);
    const dailyReward = annualReward.divn(365);
    const totalRewards = dailyReward.muln(daysElapsed);

    // 80% to merchant
    const merchantRewards = totalRewards.muln(8000).divn(10000);

    return merchantRewards;
  }
}
