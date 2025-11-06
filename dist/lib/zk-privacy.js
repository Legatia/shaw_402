/**
 * ZK Privacy Utilities
 * Provides commitment schemes and encryption for private payment splits
 */
import { buildPoseidon } from 'circomlibjs';
import { box, randomBytes } from 'tweetnacl';
import bs58 from 'bs58';
// Cache Poseidon hash instance
let poseidonInstance = null;
/**
 * Initialize Poseidon hash (call once at startup)
 */
export async function initializePoseidon() {
    if (!poseidonInstance) {
        poseidonInstance = await buildPoseidon();
    }
}
/**
 * Poseidon hash function (ZK-friendly)
 */
export function poseidonHash(inputs) {
    if (!poseidonInstance) {
        throw new Error('Poseidon not initialized. Call initializePoseidon() first.');
    }
    const hash = poseidonInstance(inputs);
    return poseidonInstance.F.toString(hash);
}
/**
 * Generate cryptographically secure random nonce
 */
export function generateNonce() {
    const bytes = randomBytes(32);
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
}
/**
 * Convert string to BigInt for hashing
 */
export function stringToBigInt(str) {
    const hex = Buffer.from(str, 'utf8').toString('hex');
    return BigInt('0x' + hex);
}
/**
 * Convert BigInt back to string
 */
export function bigIntToString(num) {
    const hex = num.toString(16);
    // Pad hex to even length
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return Buffer.from(paddedHex, 'hex').toString('utf8');
}
/**
 * Create commitment to affiliate ID
 * Commitment = Poseidon(affiliateId, nonce)
 */
export function createAffiliateCommitment(affiliateId, nonce) {
    const affiliateIdBigInt = stringToBigInt(affiliateId);
    return poseidonHash([affiliateIdBigInt, nonce]);
}
/**
 * Create commitment to payment split amounts
 * Commitment = Poseidon(platformFee, affiliateCommission, merchantAmount, nonce)
 */
export function createSplitCommitment(platformFee, affiliateCommission, merchantAmount, nonce) {
    return poseidonHash([platformFee, affiliateCommission, merchantAmount, nonce]);
}
/**
 * Verify affiliate commitment
 */
export function verifyAffiliateCommitment(affiliateId, nonce, commitment) {
    const computed = createAffiliateCommitment(affiliateId, nonce);
    return computed === commitment;
}
/**
 * Verify split commitment
 */
export function verifySplitCommitment(platformFee, affiliateCommission, merchantAmount, nonce, commitment) {
    const computed = createSplitCommitment(platformFee, affiliateCommission, merchantAmount, nonce);
    return computed === commitment;
}
/**
 * Encryption helper using NaCl box
 */
export class PrivacyEncryption {
    keypair;
    constructor(secretKey) {
        if (secretKey) {
            // Use provided secret key
            this.keypair = box.keyPair.fromSecretKey(secretKey);
        }
        else {
            // Generate new keypair
            this.keypair = box.keyPair();
        }
    }
    /**
     * Get public key for sharing
     */
    getPublicKey() {
        return bs58.encode(this.keypair.publicKey);
    }
    /**
     * Get secret key for storage (KEEP SECURE!)
     */
    getSecretKey() {
        return bs58.encode(this.keypair.secretKey);
    }
    /**
     * Encrypt data for a recipient
     */
    encrypt(data, recipientPublicKey) {
        const message = JSON.stringify(data);
        const messageBytes = Buffer.from(message, 'utf8');
        const nonce = randomBytes(box.nonceLength);
        const recipientPubKeyBytes = bs58.decode(recipientPublicKey);
        const encrypted = box(messageBytes, nonce, recipientPubKeyBytes, this.keypair.secretKey);
        if (!encrypted) {
            throw new Error('Encryption failed');
        }
        return {
            encrypted: Buffer.from(encrypted).toString('base64'),
            nonce: Buffer.from(nonce).toString('base64'),
            publicKey: this.getPublicKey(),
        };
    }
    /**
     * Decrypt data from a sender
     */
    decrypt(encryptedData) {
        const encryptedBytes = Buffer.from(encryptedData.encrypted, 'base64');
        const nonceBytes = Buffer.from(encryptedData.nonce, 'base64');
        const senderPubKeyBytes = bs58.decode(encryptedData.publicKey);
        const decrypted = box.open(encryptedBytes, nonceBytes, senderPubKeyBytes, this.keypair.secretKey);
        if (!decrypted) {
            throw new Error('Decryption failed - invalid message or key');
        }
        const message = Buffer.from(decrypted).toString('utf8');
        return JSON.parse(message);
    }
    /**
     * Encrypt split data for server
     */
    encryptSplitData(splitData, serverPublicKey) {
        return this.encrypt(splitData, serverPublicKey);
    }
    /**
     * Decrypt split data from agent
     */
    decryptSplitData(encryptedData) {
        return this.decrypt(encryptedData);
    }
}
/**
 * Create encryption instance from environment or generate new
 */
export function createServerEncryption() {
    const secretKeyBase58 = process.env.SERVER_ENCRYPTION_SECRET_KEY;
    if (secretKeyBase58) {
        const secretKey = bs58.decode(secretKeyBase58);
        return new PrivacyEncryption(secretKey);
    }
    // Generate new keypair
    const encryption = new PrivacyEncryption();
    console.log('⚠️  No SERVER_ENCRYPTION_SECRET_KEY found in environment');
    console.log('📝 Generated new encryption keypair:');
    console.log(`   Public Key: ${encryption.getPublicKey()}`);
    console.log(`   Secret Key: ${encryption.getSecretKey()}`);
    console.log('');
    console.log('💡 Add this to your .env file:');
    console.log(`   SERVER_ENCRYPTION_SECRET_KEY=${encryption.getSecretKey()}`);
    console.log('');
    return encryption;
}
/**
 * Create encryption instance for agent
 */
export function createAgentEncryption(agentPrivateKey) {
    // Derive encryption key from agent's Solana private key
    // In production, use a separate encryption key
    const keypair = bs58.decode(agentPrivateKey);
    const encryptionKey = keypair.slice(0, 32); // Use first 32 bytes
    return new PrivacyEncryption(encryptionKey);
}
export function calculateSplitWithCommitments(totalAmount, platformRate, affiliateRate, affiliateId, existingNonce) {
    // Calculate amounts
    const platformFee = (totalAmount * BigInt(Math.floor(platformRate * 1000))) / 1000n;
    const affiliateCommission = affiliateId
        ? (totalAmount * BigInt(Math.floor(affiliateRate * 1000))) / 1000n
        : 0n;
    const merchantAmount = totalAmount - platformFee - affiliateCommission;
    // Generate nonce
    const nonce = existingNonce || generateNonce();
    // Create commitments
    const affiliateCommitment = affiliateId
        ? createAffiliateCommitment(affiliateId, nonce)
        : '0'; // No affiliate
    const splitCommitment = createSplitCommitment(platformFee, affiliateCommission, merchantAmount, nonce);
    return {
        platformFee,
        affiliateCommission,
        merchantAmount,
        nonce,
        affiliateCommitment,
        splitCommitment,
    };
}
/**
 * Verify split calculation matches commitments
 */
export function verifySplitCalculation(calculation, affiliateId) {
    // Verify affiliate commitment
    const affiliateValid = affiliateId
        ? verifyAffiliateCommitment(affiliateId, calculation.nonce, calculation.affiliateCommitment)
        : calculation.affiliateCommitment === '0';
    // Verify split commitment
    const splitValid = verifySplitCommitment(calculation.platformFee, calculation.affiliateCommission, calculation.merchantAmount, calculation.nonce, calculation.splitCommitment);
    // Verify amounts sum correctly
    const sum = calculation.platformFee + calculation.affiliateCommission + calculation.merchantAmount;
    const amountValid = sum === calculation.platformFee + calculation.affiliateCommission + calculation.merchantAmount;
    return { affiliateValid, splitValid, amountValid };
}
/**
 * Generate authentication token for agent
 */
export function generateAgentToken(merchantId, agentWallet, secret) {
    const payload = `${merchantId}:${agentWallet}:${Date.now()}`;
    const hash = poseidonHash([stringToBigInt(payload), stringToBigInt(secret)]);
    return Buffer.from(hash).toString('base64url');
}
/**
 * Verify agent authentication token
 */
export function verifyAgentToken(token, merchantId, agentWallet, secret, _maxAgeMs = 3600000 // 1 hour (reserved for future use)
) {
    try {
        // In production, implement proper JWT or similar
        // This is a simplified version for demonstration
        const hash = Buffer.from(token, 'base64url').toString();
        // Verify token structure
        const payload = `${merchantId}:${agentWallet}:${Date.now()}`;
        const expectedHash = poseidonHash([stringToBigInt(payload), stringToBigInt(secret)]);
        // Simple validation (in production, use proper JWT with expiry)
        return hash === expectedHash;
    }
    catch (error) {
        return false;
    }
}
/**
 * Export utilities for easy access
 */
export const ZKPrivacy = {
    initializePoseidon,
    generateNonce,
    createAffiliateCommitment,
    createSplitCommitment,
    verifyAffiliateCommitment,
    verifySplitCommitment,
    calculateSplitWithCommitments,
    verifySplitCalculation,
    PrivacyEncryption,
    createServerEncryption,
    createAgentEncryption,
    generateAgentToken,
    verifyAgentToken,
};
export default ZKPrivacy;
//# sourceMappingURL=zk-privacy.js.map