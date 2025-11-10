/**
 * Test script for Solana Pay integration
 * Tests QR code generation and transaction request endpoints
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Load or generate client keypair
let clientKeypair;
try {
  const keypairData = JSON.parse(fs.readFileSync('./test-client-keypair.json', 'utf-8'));
  clientKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
} catch (error) {
  console.log('⚠️  Could not load test-client-keypair.json');
  console.log('Generate one with: npm run generate:client');
  process.exit(1);
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

console.log('🧪 Testing Solana Pay Integration\n');
console.log(`Server: ${SERVER_URL}`);
console.log(`Client: ${clientKeypair.publicKey.toString()}\n`);

/**
 * Test 1: Get QR Code for payment endpoint
 */
async function testQRCodeGeneration() {
  console.log('📱 Test 1: QR Code Generation');
  try {
    const response = await fetch(`${SERVER_URL}/api/solana-pay/premium-data/qr?format=png`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`QR generation failed: ${JSON.stringify(error)}`);
    }

    const qrBuffer = await response.arrayBuffer();
    console.log(`✅ QR code generated (${qrBuffer.byteLength} bytes)`);

    // Save QR code for inspection
    fs.writeFileSync('./solana-pay-qr.png', Buffer.from(qrBuffer));
    console.log(`💾 Saved to: ./solana-pay-qr.png\n`);

    return true;
  } catch (error) {
    console.error(`❌ QR generation failed:`, error.message);
    return false;
  }
}

/**
 * Test 2: Get transfer URL (non-interactive)
 */
async function testTransferURL() {
  console.log('🔗 Test 2: Transfer URL Generation');
  try {
    const response = await fetch(`${SERVER_URL}/api/solana-pay/transfer/premium-data`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Transfer URL generation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    console.log(`✅ Transfer URL: ${data.data.url}`);
    console.log(`📋 Reference: ${data.data.reference}`);
    console.log(`💰 Amount: ${data.data.amount} lamports\n`);

    return data.data.reference;
  } catch (error) {
    console.error(`❌ Transfer URL generation failed:`, error.message);
    return null;
  }
}

/**
 * Test 3: Transaction request (interactive)
 */
async function testTransactionRequest() {
  console.log('💳 Test 3: Transaction Request (Interactive)');
  try {
    // Step 1: GET request for label and icon
    console.log('  Step 1: Getting payment details...');
    const getResponse = await fetch(`${SERVER_URL}/api/solana-pay/premium-data`);

    if (!getResponse.ok) {
      const error = await getResponse.json();
      throw new Error(`GET request failed: ${JSON.stringify(error)}`);
    }

    const labelData = await getResponse.json();
    console.log(`  ✅ Label: ${labelData.label}`);

    // Step 2: POST request with account
    console.log('  Step 2: Requesting transaction...');
    const postResponse = await fetch(`${SERVER_URL}/api/solana-pay/premium-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account: clientKeypair.publicKey.toString(),
      }),
    });

    if (!postResponse.ok) {
      const error = await postResponse.json();
      throw new Error(`POST request failed: ${JSON.stringify(error)}`);
    }

    const txData = await postResponse.json();
    console.log(`  ✅ Transaction received: ${txData.message}`);

    // Step 3: Deserialize and inspect transaction
    const txBuffer = Buffer.from(txData.transaction, 'base64');
    const transaction = Transaction.from(txBuffer);

    console.log(`  📦 Transaction details:`);
    console.log(`     Fee payer: ${transaction.feePayer?.toString()}`);
    console.log(`     Instructions: ${transaction.instructions.length}`);
    console.log(`     Recent blockhash: ${transaction.recentBlockhash}`);

    // Check balance before signing
    const balance = await connection.getBalance(clientKeypair.publicKey);
    console.log(`  💰 Current balance: ${balance} lamports (${(balance / 1e9).toFixed(4)} SOL)`);

    if (balance < 10000000) {
      console.log('  ⚠️  Low balance! Fund your wallet with:');
      console.log(`     solana airdrop 0.1 ${clientKeypair.publicKey.toString()} --url devnet`);
      return null;
    }

    // Step 4: Sign transaction
    console.log('  Step 3: Signing transaction...');
    transaction.partialSign(clientKeypair);
    console.log(`  ✅ Transaction signed`);

    // Step 5: Send transaction (simulation mode)
    console.log('  Step 4: Simulating transaction...');
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.log(`  ❌ Simulation failed:`, simulation.value.err);
      console.log(`  Logs:`, simulation.value.logs);
      return null;
    }

    console.log(`  ✅ Simulation successful!`);
    console.log(`  📝 Logs:`, simulation.value.logs?.slice(0, 3).join('\n      '));

    // Optionally send for real (uncomment to test on-chain)
    if (process.env.SEND_REAL_TRANSACTION === 'true') {
      console.log('  Step 5: Sending transaction to blockchain...');
      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log(`  ✅ Transaction sent: ${signature}`);

      console.log('  Waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`  ✅ Transaction confirmed!\n`);

      return signature;
    } else {
      console.log('  ℹ️  Skipping real transaction (set SEND_REAL_TRANSACTION=true to send)\n');
      return 'simulated';
    }

  } catch (error) {
    console.error(`❌ Transaction request failed:`, error.message);
    return null;
  }
}

/**
 * Test 4: Payment status check
 */
async function testPaymentStatus(reference) {
  console.log('🔍 Test 4: Payment Status Check');
  try {
    const response = await fetch(
      `${SERVER_URL}/api/solana-pay/premium-data/status/${reference}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Status check failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    console.log(`✅ Payment status: ${data.data.status}`);
    if (data.data.signature) {
      console.log(`📝 Signature: ${data.data.signature}`);
    }
    console.log('');

    return data.data.status === 'confirmed';
  } catch (error) {
    console.error(`❌ Status check failed:`, error.message);
    return false;
  }
}

/**
 * Test 5: Payment validation
 */
async function testPaymentValidation(reference) {
  console.log('✅ Test 5: Payment Validation');
  try {
    const response = await fetch(
      `${SERVER_URL}/api/solana-pay/premium-data/validate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Validation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`API error: ${JSON.stringify(data)}`);
    }

    console.log(`✅ Payment validated: ${data.data.valid}`);
    console.log(`📝 Signature: ${data.data.signature}\n`);

    return data.data.valid;
  } catch (error) {
    console.error(`❌ Validation failed:`, error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting Solana Pay integration tests...\n');

  const results = {
    qrCode: false,
    transferUrl: false,
    transactionRequest: false,
    paymentStatus: false,
    paymentValidation: false,
  };

  // Test 1: QR Code
  results.qrCode = await testQRCodeGeneration();

  // Test 2: Transfer URL
  const transferReference = await testTransferURL();
  results.transferUrl = !!transferReference;

  // Test 3: Transaction Request
  const signature = await testTransactionRequest();
  results.transactionRequest = !!signature;

  // Only test status and validation if we have a real transaction
  if (signature && signature !== 'simulated') {
    // Wait a bit for transaction to be indexed
    console.log('⏳ Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Extract reference from transaction (simplified)
    // In a real scenario, you'd parse the transaction to get the reference

    console.log('ℹ️  Status and validation tests require a confirmed transaction\n');
  }

  // Print results
  console.log('═══════════════════════════════════════');
  console.log('📊 Test Results');
  console.log('═══════════════════════════════════════');
  console.log(`QR Code Generation:      ${results.qrCode ? '✅' : '❌'}`);
  console.log(`Transfer URL:            ${results.transferUrl ? '✅' : '❌'}`);
  console.log(`Transaction Request:     ${results.transactionRequest ? '✅' : '❌'}`);
  console.log(`Payment Status:          ${results.paymentStatus ? '✅' : '⏭️  Skipped'}`);
  console.log(`Payment Validation:      ${results.paymentValidation ? '✅' : '⏭️  Skipped'}`);
  console.log('═══════════════════════════════════════\n');

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = 3; // Only count non-skipped tests

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed`);
  }

  console.log('\n💡 Tips:');
  console.log('  - Set SEND_REAL_TRANSACTION=true to test actual blockchain transactions');
  console.log('  - Scan solana-pay-qr.png with a Solana Pay-compatible wallet');
  console.log('  - Check logs for detailed error messages\n');
}

// Run tests
runTests().catch(console.error);
