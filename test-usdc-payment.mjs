/**
 * Test USDC Payment to Agent
 * Simulates a customer sending USDC to an agent wallet with affiliate memo
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey(process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Memo program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

async function main() {
  try {
    console.log('');
    console.log('='.repeat(80));
    console.log('TEST USDC PAYMENT TO AGENT');
    console.log('='.repeat(80));
    console.log('');

    // Get inputs from command line
    const args = process.argv.slice(2);

    if (args.length < 3) {
      console.log('Usage: npm run test:payment <payer_private_key> <agent_usdc_account> <amount> [affiliate_id]');
      console.log('');
      console.log('Example:');
      console.log('  npm run test:payment <base58_key> <agent_usdc_addr> 100 AFF_12345');
      console.log('');
      console.log('This will send USDC to the agent with an optional affiliate memo');
      process.exit(1);
    }

    const payerPrivateKey = args[0];
    const agentUSDCAccountStr = args[1];
    const amount = parseFloat(args[2]);
    const affiliateId = args[3] || null;

    // Create connection
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Load payer keypair
    const payerKeypair = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));
    console.log(`Payer: ${payerKeypair.publicKey.toString()}`);

    // Get payer's USDC account
    const payerUSDCAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      payerKeypair.publicKey
    );

    console.log(`Payer USDC Account: ${payerUSDCAccount.toString()}`);

    // Check balance
    try {
      const payerUSDCAccountInfo = await getAccount(connection, payerUSDCAccount);
      const balance = Number(payerUSDCAccountInfo.amount) / 1_000_000;
      console.log(`Payer USDC Balance: ${balance} USDC`);

      if (balance < amount) {
        console.error(`❌ Insufficient balance! Need ${amount} USDC but have ${balance} USDC`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Payer USDC account not found!');
      console.error('   Get devnet USDC from: https://spl-token-faucet.com/');
      process.exit(1);
    }

    // Target agent USDC account
    const agentUSDCAccount = new PublicKey(agentUSDCAccountStr);
    console.log(`Agent USDC Account: ${agentUSDCAccount.toString()}`);
    console.log(`Amount: ${amount} USDC`);

    if (affiliateId) {
      console.log(`Affiliate ID: ${affiliateId}`);
    } else {
      console.log(`Affiliate ID: None (direct payment)`);
    }
    console.log('');

    // Build transaction
    const transaction = new Transaction();

    // Add USDC transfer instruction
    const amountInSmallestUnits = Math.floor(amount * 1_000_000); // USDC has 6 decimals
    transaction.add(
      createTransferInstruction(
        payerUSDCAccount,
        agentUSDCAccount,
        payerKeypair.publicKey,
        amountInSmallestUnits,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Add memo instruction if affiliate ID provided
    if (affiliateId) {
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(affiliateId, 'utf-8'),
      });
      transaction.add(memoInstruction);
    }

    console.log('Sending transaction...');

    // Send transaction
    const signature = await connection.sendTransaction(transaction, [payerKeypair]);
    console.log(`Transaction sent: ${signature}`);
    console.log('Waiting for confirmation...');

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('');
    console.log('✅ PAYMENT SENT SUCCESSFULLY!');
    console.log('');
    console.log(`Transaction: ${signature}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');
    console.log('The Payment Processor Agent should detect this payment and split it automatically.');
    console.log('Check the agent logs to see the processing!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
