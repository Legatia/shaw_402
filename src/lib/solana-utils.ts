/**
 * Solana utilities using Gill SDK
 * Handles Solana operations, signatures, and transactions
 */

import { createSolanaRpc, createSolanaRpcSubscriptions, address } from 'gill';
import type { Address } from 'gill';
import { SignatureVerificationError } from '../errors/index.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';

export interface SolanaUtilsConfig {
  rpcEndpoint: string;
  rpcSubscriptionsEndpoint?: string;
}

export interface StructuredData {
  domain: {
    name: string;
    version: string;
    chainId: string;
    verifyingContract: string;
  };
  types: {
    [key: string]: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: Record<string, unknown>;
}

export interface X402SOLPaymentTransactionParams {
  fromPublicKey: string;
  toPublicKey: string;
  amount: bigint;
  facilitatorAddress: Address;
  nonce: string;
  resourceId: string;
}

export class SolanaUtils {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private rpcSubscriptions?: ReturnType<typeof createSolanaRpcSubscriptions>;
  private rpcUrl: string;
  private connection: Connection;

  constructor(config: SolanaUtilsConfig) {
    this.rpcUrl = config.rpcEndpoint;
    this.rpc = createSolanaRpc(config.rpcEndpoint);
    this.connection = new Connection(config.rpcEndpoint, 'confirmed');
    if (config.rpcSubscriptionsEndpoint) {
      this.rpcSubscriptions = createSolanaRpcSubscriptions(config.rpcSubscriptionsEndpoint);
    }
  }

  /**
   * Get SOL balance for a public key
   */
  async getSOLBalance(publicKey: string): Promise<bigint> {
    try {
      const addr = address(publicKey);
      const balance = await this.rpc.getBalance(addr).send();
      return balance.value;
    } catch (error) {
      console.error('Error getting SOL balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if a public key is valid
   */
  isValidPublicKey(addr: string): boolean {
    try {
      address(addr);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify a signature against a message and public key
   */
  verifySignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(publicKey);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify a structured data signature (EIP-712 equivalent for Solana)
   */
  verifyStructuredDataSignature(structuredData: StructuredData, signature: string, publicKey: string): boolean {
    try {
      // Convert structured data to string for verification
      const messageString = JSON.stringify(structuredData);
      return this.verifySignature(messageString, signature, publicKey);
    } catch (error) {
      console.error('Structured data signature verification error:', error);
      return false;
    }
  }

  /**
   * Sign a message with a keypair (for testing purposes)
   */
  signMessage(message: string, privateKeyBase58: string): string {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const privateKeyBytes = bs58.decode(privateKeyBase58);

      const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
      return bs58.encode(signature);
    } catch (error) {
      console.error('Message signing error:', error);
      throw new SignatureVerificationError(
        `Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign structured data (EIP-712 equivalent) for x402 authorization
   */
  signStructuredData(structuredData: StructuredData, privateKeyBase58: string): string {
    try {
      const messageString = JSON.stringify(structuredData);
      return this.signMessage(messageString, privateKeyBase58);
    } catch (error) {
      console.error('Structured data signing error:', error);
      throw new SignatureVerificationError(
        `Failed to sign structured data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert lamports to SOL
   */
  lamportsToSOL(lamports: bigint): number {
    return Number(lamports) / 1_000_000_000;
  }

  /**
   * Convert SOL to lamports
   */
  solToLamports(sol: number): bigint {
    return BigInt(Math.floor(sol * 1_000_000_000));
  }

  /**
   * Get recent blockhash
   */
  async getRecentBlockhash(): Promise<string> {
    const response = await this.rpc.getLatestBlockhash().send();
    return response.value.blockhash;
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string): Promise<any> {
    try {
      const tx = await this.rpc.getTransaction(signature as any, {
        encoding: 'json',
        maxSupportedTransactionVersion: 0,
      }).send();
      return tx;
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  }

  /**
   * Get RPC instance for direct access
   */
  getRpc() {
    return this.rpc;
  }

  /**
   * Get RPC subscriptions instance for direct access
   */
  getRpcSubscriptions() {
    return this.rpcSubscriptions;
  }

  /**
   * Get Connection instance for direct access
   */
  getConnection() {
    return this.connection;
  }

  // ============================================================================
  // SPL TOKEN UTILITIES (USDC Support)
  // ============================================================================

  /**
   * Get or create associated token account for a wallet
   */
  async getOrCreateAssociatedTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    try {
      // Get associated token account address
      const ata = await getAssociatedTokenAddress(mint, owner);

      // Check if account exists
      try {
        await getAccount(this.connection, ata);
        console.log(`  ✓ Associated token account exists: ${ata.toString()}`);
        return ata;
      } catch (error) {
        // Account doesn't exist, create it
        console.log(`  Creating associated token account for ${owner.toString()}`);

        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint)
        );

        await sendAndConfirmTransaction(this.connection, transaction, [payer]);
        console.log(`  ✓ Created associated token account: ${ata.toString()}`);

        return ata;
      }
    } catch (error) {
      console.error('Error getting/creating associated token account:', error);
      throw new Error(
        `Failed to get/create token account: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    try {
      const accountInfo = await getAccount(this.connection, tokenAccount);
      return accountInfo.amount;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Get USDC balance for a wallet
   */
  async getUSDCBalance(owner: PublicKey, usdcMint: PublicKey): Promise<bigint> {
    try {
      const ata = await getAssociatedTokenAddress(usdcMint, owner);
      return await this.getTokenBalance(ata);
    } catch (error) {
      console.error('Error getting USDC balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Transfer SOL from one wallet to another
   */
  async transferSOL(from: Keypair, to: PublicKey, lamports: number): Promise<string> {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from.publicKey,
          toPubkey: to,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [from]);
      console.log(`  ✓ Transferred ${lamports / 1_000_000_000} SOL to ${to.toString()}`);
      console.log(`    Signature: ${signature}`);

      return signature;
    } catch (error) {
      console.error('Error transferring SOL:', error);
      throw new Error(`Failed to transfer SOL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transfer SPL tokens
   */
  async transferTokens(
    from: Keypair,
    fromTokenAccount: PublicKey,
    toTokenAccount: PublicKey,
    amount: bigint
  ): Promise<string> {
    try {
      const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount, toTokenAccount, from.publicKey, amount)
      );

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [from]);
      console.log(`  ✓ Transferred ${amount} tokens`);
      console.log(`    Signature: ${signature}`);

      return signature;
    } catch (error) {
      console.error('Error transferring tokens:', error);
      throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Multi-party USDC split (for affiliate commissions)
   * Creates atomic transaction with multiple SPL token transfers
   */
  async splitUSDCPayment(
    agentKeypair: Keypair,
    usdcMint: PublicKey,
    recipients: Array<{ owner: PublicKey; amount: bigint }>
  ): Promise<string> {
    try {
      console.log('🔀 USDC Payment Split - Atomic Settlement');
      console.log(`  Agent: ${agentKeypair.publicKey.toString()}`);

      // Get agent's USDC account
      const agentUSDCAccount = await getAssociatedTokenAddress(usdcMint, agentKeypair.publicKey);

      // Build transaction with multiple transfers
      const transaction = new Transaction();

      for (const recipient of recipients) {
        const recipientUSDCAccount = await getAssociatedTokenAddress(usdcMint, recipient.owner);

        transaction.add(
          createTransferInstruction(agentUSDCAccount, recipientUSDCAccount, agentKeypair.publicKey, recipient.amount)
        );

        console.log(`  → ${recipient.owner.toString()}: ${Number(recipient.amount) / 1_000_000} USDC`);
      }

      // Send atomic transaction
      const signature = await sendAndConfirmTransaction(this.connection, transaction, [agentKeypair]);

      console.log('  ✓ USDC split completed!');
      console.log(`    Signature: ${signature}`);
      console.log(`    Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return signature;
    } catch (error) {
      console.error('Error splitting USDC payment:', error);
      throw new Error(`Failed to split USDC payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert USDC amount to human-readable format (6 decimals)
   */
  usdcToHuman(amount: bigint): number {
    return Number(amount) / 1_000_000;
  }

  /**
   * Convert human-readable USDC to raw amount (6 decimals)
   */
  humanToUSDC(amount: number): bigint {
    return BigInt(Math.floor(amount * 1_000_000));
  }

  /**
   * Submit a sponsored transaction (TRUE x402 instant finality)
   * Client signs the transaction, facilitator adds signature as fee payer.
   * This achieves instant on-chain settlement with NO debt tracking.
   * @param facilitatorPrivateKey - Facilitator private key in base58 format
   * @param serializedTransaction - Base64-encoded transaction signed by client
   * @returns Transaction signature
   */
  async submitSponsoredTransaction(facilitatorPrivateKey: string, serializedTransaction: string): Promise<string> {
    try {
      console.log('TRUE x402 ATOMIC SETTLEMENT: Sponsored Transaction');
      console.log('  Client has signed transaction (their SOL will move)');
      console.log('  Facilitator will add signature as fee payer (pays gas)');
      console.log();

      // Import @solana/web3.js for transaction handling
      const { Connection, Transaction, Keypair } = await import('@solana/web3.js');

      const connection = new Connection(this.rpcUrl, 'confirmed');

      // Create Keypair from private key
      const secretKey = bs58.decode(facilitatorPrivateKey);
      const facilitatorKeypair = Keypair.fromSecretKey(secretKey);

      console.log('  Facilitator (fee payer):', facilitatorKeypair.publicKey.toString());

      // Deserialize the transaction
      const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      console.log('  Transaction details:');
      console.log('     - Instructions:', transaction.instructions.length);
      console.log('     - Client signature:', transaction.signatures[0] ? 'Present' : 'Missing');
      console.log();
      console.log('  How TRUE x402 works:');
      console.log('     - Client signs: Authorizes their SOL to move');
      console.log('     - Facilitator signs: Pays gas fee (sponsored transaction)');
      console.log('     - Single atomic transaction on-chain');
      console.log("     - Client's funds -> Merchant (instant settlement)");
      console.log();

      console.log('  Facilitator signing as fee payer and sending to Solana devnet...');

      // Add facilitator's signature (fee payer) to the already client-signed transaction
      transaction.partialSign(facilitatorKeypair);

      console.log('  Both signatures present (client + facilitator)');
      console.log('  Sending to Solana network...');

      // Send the transaction (all signatures are already in place)
      const rawTransaction = transaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('  ATOMIC SETTLEMENT COMPLETE!');
      console.log('     Signature:', signature);
      console.log('     Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      console.log();
      console.log("  Client's SOL moved to merchant, facilitator paid gas!");

      return signature;
    } catch (error) {
      console.error('  Sponsored transaction error:', error);
      throw new Error(
        `Failed to submit sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify a wallet signature for merchant cancellation or other operations
   * @param walletAddress - Public key of the wallet that signed
   * @param message - Original message that was signed
   * @param signature - Base58 encoded signature
   * @returns true if signature is valid
   */
  async verifyWalletSignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);

      // Verify using nacl
      const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

      return verified;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}
