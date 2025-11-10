/**
 * Vault Dashboard API Routes
 * Endpoints for on-chain vault data with lock periods and dynamic APY
 */

import { Router, type Request, type Response } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, setProvider } from '@coral-xyz/anchor';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';

const router = Router();

// Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Vault program ID (replace with deployed program ID)
const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || '11111111111111111111111111111111'
);

// Vault authority (replace with actual vault authority)
const VAULT_AUTHORITY = new PublicKey(
  process.env.VAULT_AUTHORITY || '11111111111111111111111111111111'
);

/**
 * Helper: Find vault PDA
 */
function findVaultAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), VAULT_AUTHORITY.toBuffer()],
    VAULT_PROGRAM_ID
  );
}

/**
 * Helper: Find merchant deposit PDA
 */
function findMerchantDepositAddress(
  vaultAddress: PublicKey,
  merchantPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('merchant_deposit'), vaultAddress.toBuffer(), merchantPubkey.toBuffer()],
    VAULT_PROGRAM_ID
  );
}

/**
 * Helper: Deserialize merchant deposit account
 */
function deserializeMerchantDeposit(accountData: Buffer): any {
  // This is a simplified deserializer
  // In production, use Anchor's IDL-based deserialization

  try {
    let offset = 8; // Skip discriminator

    // Read fields according to MerchantDeposit struct layout
    const merchant = new PublicKey(accountData.slice(offset, offset + 32));
    offset += 32;

    const vault = new PublicKey(accountData.slice(offset, offset + 32));
    offset += 32;

    const depositedAmount = accountData.readBigUInt64LE(offset);
    offset += 8;

    const depositedValueUSD = accountData.readBigUInt64LE(offset);
    offset += 8;

    const accruedRewards = accountData.readBigUInt64LE(offset);
    offset += 8;

    const depositTimestamp = accountData.readBigInt64LE(offset);
    offset += 8;

    const currentYieldBps = accountData.readUInt16LE(offset);
    offset += 2;

    const isActive = accountData.readUInt8(offset) === 1;
    offset += 1;

    const bump = accountData.readUInt8(offset);
    offset += 1;

    const lockPeriod = accountData.readUInt8(offset);
    offset += 1;

    // Padding
    offset += 3;

    const unlockTime = accountData.readBigInt64LE(offset);
    offset += 8;

    const totalOrdersProcessed = accountData.readBigUInt64LE(offset);
    offset += 8;

    const totalVolumeProcessed = accountData.readBigUInt64LE(offset);
    offset += 8;

    const currentMonthVolume = accountData.readBigUInt64LE(offset);
    offset += 8;

    const lastVolumeReset = accountData.readBigInt64LE(offset);
    offset += 8;

    const monthlyUniqueCustomers = accountData.readUInt32LE(offset);
    offset += 4;

    const platformProfitEarned = accountData.readBigUInt64LE(offset);
    offset += 8;

    const profitShareAllocated = accountData.readBigUInt64LE(offset);
    offset += 8;

    return {
      merchant: merchant.toString(),
      vault: vault.toString(),
      depositedAmount: depositedAmount.toString(),
      depositedValueUSD: depositedValueUSD.toString(),
      accruedRewards: accruedRewards.toString(),
      depositTimestamp: Number(depositTimestamp),
      currentYieldBps,
      isActive,
      bump,
      lockPeriod,
      unlockTime: Number(unlockTime),
      totalOrdersProcessed: totalOrdersProcessed.toString(),
      totalVolumeProcessed: totalVolumeProcessed.toString(),
      currentMonthVolume: currentMonthVolume.toString(),
      lastVolumeReset: Number(lastVolumeReset),
      monthlyUniqueCustomers,
      platformProfitEarned: platformProfitEarned.toString(),
      profitShareAllocated: profitShareAllocated.toString(),
    };
  } catch (error) {
    console.error('Error deserializing merchant deposit:', error);
    throw new Error('Failed to deserialize merchant deposit account');
  }
}

/**
 * Helper: Calculate APY breakdown
 */
function calculateAPYBreakdown(
  merchantDeposit: any,
  totalDepositedValue: bigint
): {
  total: number;
  base: number;
  profitShare: number;
  volume: number;
} {
  const BASE_YIELD_BPS = 300; // 3.00%
  const TARGET_MONTHLY_VOLUME = BigInt(1_000_000_000000); // $1M in micro units

  // Lock period max APY
  const lockPeriodMaxAPY = [500, 650, 900, 1150]; // 5%, 6.5%, 9%, 11.5%
  const lockMaxApy = lockPeriodMaxAPY[merchantDeposit.lockPeriod] || 650;

  let yieldBps = BASE_YIELD_BPS;

  // Calculate profit share bonus
  let profitShareBonusBps = 0;
  if (totalDepositedValue > 0n) {
    const bonusRatio =
      (BigInt(merchantDeposit.profitShareAllocated) * BigInt(10000)) / totalDepositedValue;
    profitShareBonusBps = Math.min(Number(bonusRatio), 65535);
  }

  yieldBps += profitShareBonusBps;

  // Calculate available space for volume bonus
  const availableForVolume = Math.max(lockMaxApy - yieldBps, 0);

  // Calculate volume bonus
  let volumeBonusBps = 0;
  if (availableForVolume > 0) {
    const currentVolume = BigInt(merchantDeposit.currentMonthVolume);
    if (currentVolume >= TARGET_MONTHLY_VOLUME) {
      volumeBonusBps = availableForVolume;
    } else {
      const volumeRatio = (currentVolume * BigInt(availableForVolume)) / TARGET_MONTHLY_VOLUME;
      volumeBonusBps = Math.min(Number(volumeRatio), availableForVolume);
    }
  }

  yieldBps += volumeBonusBps;

  // Cap at lock period maximum
  yieldBps = Math.min(yieldBps, lockMaxApy);

  return {
    total: yieldBps / 100,
    base: BASE_YIELD_BPS / 100,
    profitShare: profitShareBonusBps / 100,
    volume: volumeBonusBps / 100,
  };
}

/**
 * GET /api/vault/merchant/:merchantPubkey
 * Get merchant's on-chain vault data
 */
router.get('/merchant/:merchantPubkey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchantPubkey } = req.params;

    // Validate merchant public key
    let merchantPublicKey: PublicKey;
    try {
      merchantPublicKey = new PublicKey(merchantPubkey);
    } catch (error) {
      res.status(400).json(errorResponse('Invalid merchant public key', 'INVALID_PUBKEY', 400));
      return;
    }

    // Find merchant deposit PDA
    const [vaultPda] = findVaultAddress();
    const [merchantDepositPda] = findMerchantDepositAddress(vaultPda, merchantPublicKey);

    // Fetch merchant deposit account from blockchain
    const accountInfo = await connection.getAccountInfo(merchantDepositPda);

    if (!accountInfo) {
      res.status(404).json(errorResponse('No vault deposit found for this merchant', 'NOT_FOUND', 404));
      return;
    }

    // Deserialize account data
    const merchantDeposit = deserializeMerchantDeposit(accountInfo.data);

    if (!merchantDeposit.isActive) {
      res.status(404).json(errorResponse('Merchant deposit is not active', 'INACTIVE', 404));
      return;
    }

    // Calculate APY breakdown
    const totalDepositedValue = BigInt(merchantDeposit.depositedValueUSD);
    const apyBreakdown = calculateAPYBreakdown(merchantDeposit, totalDepositedValue);

    // Get merchant info from database (optional, for business name)
    let businessName = null;
    try {
      // If you have affiliate database integration:
      // const merchant = await affiliateDb.getMerchant(merchantPubkey);
      // businessName = merchant?.businessName;
    } catch (error) {
      // Ignore if not available
    }

    // Return complete dashboard data
    res.json(
      successResponse({
        merchant: merchantDeposit.merchant,
        vault: merchantDeposit.vault,
        depositedAmount: merchantDeposit.depositedAmount,
        depositedValueUSD: merchantDeposit.depositedValueUSD,
        accruedRewards: merchantDeposit.accruedRewards,
        depositTimestamp: merchantDeposit.depositTimestamp,
        currentYieldBps: merchantDeposit.currentYieldBps,
        isActive: merchantDeposit.isActive,
        lockPeriod: merchantDeposit.lockPeriod,
        unlockTime: merchantDeposit.unlockTime,
        totalOrdersProcessed: merchantDeposit.totalOrdersProcessed,
        totalVolumeProcessed: merchantDeposit.totalVolumeProcessed,
        currentMonthVolume: merchantDeposit.currentMonthVolume,
        lastVolumeReset: merchantDeposit.lastVolumeReset,
        monthlyUniqueCustomers: merchantDeposit.monthlyUniqueCustomers,
        platformProfitEarned: merchantDeposit.platformProfitEarned,
        profitShareAllocated: merchantDeposit.profitShareAllocated,
        apyBreakdown,
        businessName,
        vaultPda: vaultPda.toString(),
        merchantDepositPda: merchantDepositPda.toString(),
      })
    );
  } catch (error) {
    console.error('Error fetching merchant vault data:', error);
    res.status(500).json(
      errorResponse(
        error instanceof Error ? error.message : 'Failed to fetch merchant vault data',
        'FETCH_ERROR',
        500
      )
    );
  }
});

/**
 * POST /api/vault/deposit
 * Create deposit transaction (returns serialized transaction for wallet to sign)
 */
router.post('/deposit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchant, amount, lockPeriod } = req.body;

    if (!merchant || !amount || lockPeriod === undefined) {
      res.status(400).json(
        errorResponse(
          'Missing required fields: merchant, amount, lockPeriod',
          'MISSING_FIELDS',
          400
        )
      );
      return;
    }

    // Validate inputs
    let merchantPubkey: PublicKey;
    try {
      merchantPubkey = new PublicKey(merchant);
    } catch (error) {
      res.status(400).json(errorResponse('Invalid merchant public key', 'INVALID_PUBKEY', 400));
      return;
    }

    if (amount < 1_000_000_000) {
      // Minimum 1 SOL
      res.status(400).json(errorResponse('Minimum deposit is 1 SOL', 'AMOUNT_TOO_LOW', 400));
      return;
    }

    if (![0, 1, 2, 3].includes(lockPeriod)) {
      res.status(400).json(errorResponse('Invalid lock period', 'INVALID_LOCK_PERIOD', 400));
      return;
    }

    // TODO: Create deposit transaction using Anchor
    // For now, return placeholder
    res.status(501).json(
      errorResponse(
        'Deposit transaction creation not yet implemented. Please use the Anchor client directly.',
        'NOT_IMPLEMENTED',
        501
      )
    );
  } catch (error) {
    console.error('Error creating deposit transaction:', error);
    res.status(500).json(
      errorResponse(
        error instanceof Error ? error.message : 'Failed to create deposit transaction',
        'DEPOSIT_ERROR',
        500
      )
    );
  }
});

/**
 * POST /api/vault/withdraw
 * Create withdrawal transaction (returns serialized transaction for wallet to sign)
 */
router.post('/withdraw', async (req: Request, res: Response): Promise<void> => {
  try {
    const { merchant } = req.body;

    if (!merchant) {
      res.status(400).json(
        errorResponse('Missing required field: merchant', 'MISSING_FIELDS', 400)
      );
      return;
    }

    // Validate merchant public key
    let merchantPubkey: PublicKey;
    try {
      merchantPubkey = new PublicKey(merchant);
    } catch (error) {
      res.status(400).json(errorResponse('Invalid merchant public key', 'INVALID_PUBKEY', 400));
      return;
    }

    // Check if deposit is unlocked
    const [vaultPda] = findVaultAddress();
    const [merchantDepositPda] = findMerchantDepositAddress(vaultPda, merchantPubkey);

    const accountInfo = await connection.getAccountInfo(merchantDepositPda);
    if (!accountInfo) {
      res.status(404).json(errorResponse('No vault deposit found', 'NOT_FOUND', 404));
      return;
    }

    const merchantDeposit = deserializeMerchantDeposit(accountInfo.data);
    const now = Math.floor(Date.now() / 1000);

    if (now < merchantDeposit.unlockTime) {
      const daysRemaining = Math.ceil((merchantDeposit.unlockTime - now) / 86400);
      res.status(400).json(
        errorResponse(
          `Deposit still locked. ${daysRemaining} days remaining until unlock.`,
          'DEPOSIT_LOCKED',
          400
        )
      );
      return;
    }

    // TODO: Create withdrawal transaction using Anchor
    // For now, return placeholder
    res.status(501).json(
      errorResponse(
        'Withdrawal transaction creation not yet implemented. Please use the Anchor client directly.',
        'NOT_IMPLEMENTED',
        501
      )
    );
  } catch (error) {
    console.error('Error creating withdrawal transaction:', error);
    res.status(500).json(
      errorResponse(
        error instanceof Error ? error.message : 'Failed to create withdrawal transaction',
        'WITHDRAW_ERROR',
        500
      )
    );
  }
});

export default router;
