/**
 * Solana utilities using Gill SDK
 * Handles Solana operations, signatures, and transactions
 */
import { createSolanaRpc, createSolanaRpcSubscriptions, address } from 'gill';
import { SignatureVerificationError } from '../errors/index.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
export class SolanaUtils {
    rpc;
    rpcSubscriptions;
    rpcUrl;
    constructor(config) {
        this.rpcUrl = config.rpcEndpoint;
        this.rpc = createSolanaRpc(config.rpcEndpoint);
        if (config.rpcSubscriptionsEndpoint) {
            this.rpcSubscriptions = createSolanaRpcSubscriptions(config.rpcSubscriptionsEndpoint);
        }
    }
    /**
     * Get SOL balance for a public key
     */
    async getSOLBalance(publicKey) {
        try {
            const addr = address(publicKey);
            const balance = await this.rpc.getBalance(addr).send();
            return balance.value;
        }
        catch (error) {
            console.error('Error getting SOL balance:', error);
            return BigInt(0);
        }
    }
    /**
     * Check if a public key is valid
     */
    isValidPublicKey(addr) {
        try {
            address(addr);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Verify a signature against a message and public key
     */
    verifySignature(message, signature, publicKey) {
        try {
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = bs58.decode(signature);
            const publicKeyBytes = bs58.decode(publicKey);
            return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
        }
        catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }
    /**
     * Verify a structured data signature (EIP-712 equivalent for Solana)
     */
    verifyStructuredDataSignature(structuredData, signature, publicKey) {
        try {
            // Convert structured data to string for verification
            const messageString = JSON.stringify(structuredData);
            return this.verifySignature(messageString, signature, publicKey);
        }
        catch (error) {
            console.error('Structured data signature verification error:', error);
            return false;
        }
    }
    /**
     * Sign a message with a keypair (for testing purposes)
     */
    signMessage(message, privateKeyBase58) {
        try {
            const messageBytes = new TextEncoder().encode(message);
            const privateKeyBytes = bs58.decode(privateKeyBase58);
            const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
            return bs58.encode(signature);
        }
        catch (error) {
            console.error('Message signing error:', error);
            throw new SignatureVerificationError(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Sign structured data (EIP-712 equivalent) for x402 authorization
     */
    signStructuredData(structuredData, privateKeyBase58) {
        try {
            const messageString = JSON.stringify(structuredData);
            return this.signMessage(messageString, privateKeyBase58);
        }
        catch (error) {
            console.error('Structured data signing error:', error);
            throw new SignatureVerificationError(`Failed to sign structured data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Convert lamports to SOL
     */
    lamportsToSOL(lamports) {
        return Number(lamports) / 1_000_000_000;
    }
    /**
     * Convert SOL to lamports
     */
    solToLamports(sol) {
        return BigInt(Math.floor(sol * 1_000_000_000));
    }
    /**
     * Get recent blockhash
     */
    async getRecentBlockhash() {
        const response = await this.rpc.getLatestBlockhash().send();
        return response.value.blockhash;
    }
    /**
     * Get transaction details
     */
    async getTransaction(signature) {
        try {
            const tx = await this.rpc.getTransaction(signature, {
                encoding: 'json',
                maxSupportedTransactionVersion: 0,
            }).send();
            return tx;
        }
        catch (error) {
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
     * Submit a sponsored transaction (TRUE x402 instant finality)
     * Client signs the transaction, facilitator adds signature as fee payer.
     * This achieves instant on-chain settlement with NO debt tracking.
     * @param facilitatorPrivateKey - Facilitator private key in base58 format
     * @param serializedTransaction - Base64-encoded transaction signed by client
     * @returns Transaction signature
     */
    async submitSponsoredTransaction(facilitatorPrivateKey, serializedTransaction) {
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
        }
        catch (error) {
            console.error('  Sponsored transaction error:', error);
            throw new Error(`Failed to submit sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
//# sourceMappingURL=solana-utils.js.map