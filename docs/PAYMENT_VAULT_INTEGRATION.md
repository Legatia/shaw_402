# Payment Flow Integration with Vault

This guide shows how to integrate the vault system with the Shaw 402 payment processor agents.

## Overview

After a successful payment split, the payment processor agent must:
1. **Record the order** in the vault (updates merchant volume metrics)
2. **Record platform profit** (allocates 50% profit share to merchant for yield boost)

This ensures merchants earn dynamic APY based on their actual performance.

## Prerequisites

### 1. Merchant Must Register Agent

Before the agent can record orders, the merchant must authorize it:

```typescript
import { VaultProgramClient } from './vault-program-client';
import { PublicKey } from '@solana/web3.js';

// Merchant authorizes their payment processor agent
const vaultClient = new VaultProgramClient(connection);
const vaultAuthority = new PublicKey(process.env.VAULT_AUTHORITY!);
const agentPubkey = new PublicKey(process.env.AGENT_PUBLIC_KEY!);

await vaultClient.registerAgent(
  merchantKeypair,  // Merchant signs
  vaultAuthority,
  agentPubkey
);

console.log(`Agent ${agentPubkey} authorized for merchant ${merchantKeypair.publicKey}`);
```

**This only needs to be done once** when the merchant onboards.

---

## Payment Processor Agent Integration

### Modified Payment Flow

```
1. Customer pays → Agent wallet
2. Agent detects payment
3. Agent calls Hub API to get split instructions
4. Agent executes split transaction ✅
5. [NEW] Agent calls vault.record_order() ✅
6. [NEW] Agent calls vault.record_platform_profit() ✅
7. Agent reports success to Hub API
```

### Implementation Example

```typescript
// File: src/lib/payment-processor-agent.ts

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { VaultProgramClient } from './vault-program-client';
import BN from 'bn.js';

export class PaymentProcessorAgent {
  private connection: Connection;
  private agentKeypair: Keypair;
  private vaultClient: VaultProgramClient;
  private vaultAuthority: PublicKey;

  constructor(connection: Connection, agentKeypair: Keypair, vaultAuthority: PublicKey) {
    this.connection = connection;
    this.agentKeypair = agentKeypair;
    this.vaultAuthority = vaultAuthority;
    this.vaultClient = new VaultProgramClient(connection);
  }

  async processPayment(paymentData: {
    merchantPubkey: PublicKey;
    affiliatePubkey: PublicKey;
    totalAmountUSD: number;
    platformFeeUSD: number;
    affiliateCommissionUSD: number;
    buyerWallet: PublicKey;
  }): Promise<string> {

    // 1. Execute the split transaction
    const splitSignature = await this.executeSplit(paymentData);
    console.log(`Split executed: ${splitSignature}`);

    // 2. Record order in vault (updates volume metrics)
    try {
      await this.recordOrderInVault(
        paymentData.merchantPubkey,
        paymentData.totalAmountUSD,
        paymentData.buyerWallet
      );
      console.log('Order recorded in vault');
    } catch (error) {
      console.error('Failed to record order in vault:', error);
      // Continue - don't fail the payment if vault recording fails
    }

    // 3. Record platform profit (allocates 50% to merchant)
    try {
      await this.recordPlatformProfit(
        paymentData.merchantPubkey,
        paymentData.platformFeeUSD
      );
      console.log('Platform profit recorded in vault');
    } catch (error) {
      console.error('Failed to record platform profit:', error);
      // Continue - don't fail the payment
    }

    // 4. Report to Hub API
    await this.reportToHub(splitSignature, paymentData);

    return splitSignature;
  }

  private async recordOrderInVault(
    merchantPubkey: PublicKey,
    orderAmountUSD: number,
    buyerWallet: PublicKey
  ): Promise<void> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(this.vaultAuthority);
    const [merchantDepositPda] = VaultProgramClient.findMerchantDepositAddress(
      vaultPda,
      merchantPubkey
    );
    const [authorizedAgentPda] = VaultProgramClient.findAuthorizedAgentAddress(
      vaultPda,
      merchantPubkey,
      this.agentKeypair.publicKey
    );

    // Convert USD to micro-units (6 decimals)
    const orderAmountMicroUSD = new BN(orderAmountUSD * 1_000000);

    const tx = await this.vaultClient.program.methods
      .recordOrder(orderAmountMicroUSD, buyerWallet)
      .accounts({
        vault: vaultPda,
        merchantDeposit: merchantDepositPda,
        authorizedAgent: authorizedAgentPda,
        agent: this.agentKeypair.publicKey,
        merchant: merchantPubkey,
      })
      .signers([this.agentKeypair])
      .rpc();

    console.log(`Vault record_order tx: ${tx}`);
  }

  private async recordPlatformProfit(
    merchantPubkey: PublicKey,
    platformFeeUSD: number
  ): Promise<void> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(this.vaultAuthority);
    const [merchantDepositPda] = VaultProgramClient.findMerchantDepositAddress(
      vaultPda,
      merchantPubkey
    );

    // Convert platform fee to micro-units (6 decimals)
    const platformProfitMicroUSD = new BN(platformFeeUSD * 1_000000);

    const tx = await this.vaultClient.program.methods
      .recordPlatformProfit(platformProfitMicroUSD)
      .accounts({
        vault: vaultPda,
        merchantDeposit: merchantDepositPda,
        platform: this.agentKeypair.publicKey,
        merchant: merchantPubkey,
      })
      .signers([this.agentKeypair])
      .rpc();

    console.log(`Vault record_platform_profit tx: ${tx}`);
  }

  private async executeSplit(paymentData: any): Promise<string> {
    // Your existing split logic here
    // ...
    return "split_tx_signature";
  }

  private async reportToHub(signature: string, paymentData: any): Promise<void> {
    // Your existing hub reporting logic here
    // ...
  }
}
```

---

## VaultProgramClient Additions

Add these helper methods to `src/lib/vault-program-client.ts`:

```typescript
export class VaultProgramClient {
  // ... existing methods

  /**
   * Find the authorized agent PDA
   */
  static findAuthorizedAgentAddress(
    vault: PublicKey,
    merchant: PublicKey,
    agent: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('agent_auth'),
        vault.toBuffer(),
        merchant.toBuffer(),
        agent.toBuffer(),
      ],
      VAULT_PROGRAM_ID
    );
  }

  /**
   * Register an agent for a merchant
   */
  async registerAgent(
    merchant: Keypair,
    vaultAuthority: PublicKey,
    agentPubkey: PublicKey
  ): Promise<string> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [authorizedAgentPda] = VaultProgramClient.findAuthorizedAgentAddress(
      vaultPda,
      merchant.publicKey,
      agentPubkey
    );

    const tx = await this.program.methods
      .registerAgent()
      .accounts({
        vault: vaultPda,
        authorizedAgent: authorizedAgentPda,
        agent: agentPubkey,
        merchant: merchant.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    return tx;
  }

  /**
   * Revoke an agent authorization
   */
  async revokeAgent(
    merchant: Keypair,
    vaultAuthority: PublicKey,
    agentPubkey: PublicKey
  ): Promise<string> {
    const [vaultPda] = VaultProgramClient.findVaultAddress(vaultAuthority);
    const [authorizedAgentPda] = VaultProgramClient.findAuthorizedAgentAddress(
      vaultPda,
      merchant.publicKey,
      agentPubkey
    );

    const tx = await this.program.methods
      .revokeAgent()
      .accounts({
        vault: vaultPda,
        authorizedAgent: authorizedAgentPda,
        agent: agentPubkey,
        merchant: merchant.publicKey,
      })
      .signers([merchant])
      .rpc();

    return tx;
  }
}
```

---

## Hub API Integration

The Hub API should help coordinate agent registration during merchant onboarding:

```typescript
// File: src/routes/merchant-api.ts

router.post('/api/merchants/register', async (req, res) => {
  const { businessName, merchantWallet, agentWallet, lockPeriod } = req.body;

  try {
    // 1. Store merchant in database
    const merchantId = await db.createMerchant({
      businessName,
      merchantWallet,
      agentWallet,
    });

    // 2. Create vault deposit instruction (merchant must sign)
    const vaultClient = new VaultProgramClient(connection);
    const depositIx = await vaultClient.createDepositInstruction(
      new PublicKey(merchantWallet),
      new BN(1_000_000_000), // 1 SOL minimum
      lockPeriod
    );

    // 3. Create agent authorization instruction (merchant must sign)
    const registerAgentIx = await vaultClient.createRegisterAgentInstruction(
      new PublicKey(merchantWallet),
      vaultAuthority,
      new PublicKey(agentWallet)
    );

    // 4. Return instructions for merchant to sign and submit
    res.json({
      merchantId,
      instructions: {
        deposit: depositIx.serialize().toString('base64'),
        registerAgent: registerAgentIx.serialize().toString('base64'),
      },
      message: 'Sign and submit these transactions to complete registration',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Error Handling

### Common Errors

**`UnauthorizedAgent`**: Agent is not registered for this merchant
- **Solution**: Merchant must call `registerAgent()` first

**`DepositNotActive`**: Merchant has no active vault deposit
- **Solution**: Merchant must deposit into vault first

**`OrderTooSmall`**: Order amount is below $10 minimum
- **Solution**: Only record orders ≥ $10

### Graceful Degradation

The payment system should continue to work even if vault calls fail:

```typescript
try {
  await this.recordOrderInVault(...);
  await this.recordPlatformProfit(...);
} catch (error) {
  console.error('Vault recording failed:', error);
  // Log error for manual reconciliation
  await logVaultError(error, paymentData);
  // Continue with payment processing
}
```

This ensures merchants still get paid even if the vault system has issues.

---

## Testing Checklist

- [ ] Merchant can register agent successfully
- [ ] Agent can record orders after authorization
- [ ] Unauthorized agents are rejected
- [ ] Platform profit is correctly split (50% to merchant)
- [ ] Volume metrics update correctly
- [ ] Monthly volume resets work
- [ ] Payment flow continues if vault calls fail

---

## Environment Variables

Add to `.env`:

```env
# Vault Configuration
VAULT_AUTHORITY=<vault_authority_pubkey>
VAULT_PROGRAM_ID=<deployed_vault_program_id>
```

---

## Summary

### Merchant Onboarding Flow:
1. Merchant deposits into vault (chooses lock period)
2. Merchant registers their payment agent
3. Agent can now record orders automatically

### Per-Transaction Flow:
1. Agent executes payment split
2. Agent calls `record_order()` (updates volume)
3. Agent calls `record_platform_profit()` (allocates profit share)
4. Merchant's APY updates automatically based on performance

### Benefits:
- ✅ **Automated**: No manual tracking needed
- ✅ **Real-time**: APY updates after each transaction
- ✅ **Secure**: Only authorized agents can record
- ✅ **Resilient**: Payments work even if vault fails

**Next Steps**: Deploy vault program and integrate into production payment flow.
