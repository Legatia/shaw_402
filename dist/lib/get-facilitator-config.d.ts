/**
 * Facilitator Configuration - Gill template pattern
 * Uses Zod for type-safe configuration validation
 */
import 'dotenv/config';
import { z } from 'zod';
declare const FacilitatorConfigSchema: z.ZodObject<{
    port: z.ZodCoercedNumber<unknown>;
    facilitatorPrivateKey: z.ZodString;
    facilitatorPublicKey: z.ZodOptional<z.ZodString>;
    solanaRpcUrl: z.ZodString;
    solanaWsUrl: z.ZodOptional<z.ZodString>;
    databasePath: z.ZodString;
    usdcMintAddress: z.ZodString;
    usdcDecimals: z.ZodCoercedNumber<unknown>;
    maxPaymentAmount: z.ZodCoercedBigInt<unknown>;
    nonceExpiryHours: z.ZodCoercedNumber<unknown>;
    simulateTransactions: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<boolean, string>>, z.ZodBoolean>;
    solanaNetwork: z.ZodEnum<{
        devnet: "devnet";
        testnet: "testnet";
        "mainnet-beta": "mainnet-beta";
        localnet: "localnet";
    }>;
}, z.core.$strip>;
export type FacilitatorConfig = z.infer<typeof FacilitatorConfigSchema>;
export declare function getFacilitatorConfig(): FacilitatorConfig;
export {};
//# sourceMappingURL=get-facilitator-config.d.ts.map