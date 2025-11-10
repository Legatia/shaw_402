/**
 * Server Configuration - Gill template pattern
 * Uses Zod for type-safe configuration validation
 */
import 'dotenv/config';
import { z } from 'zod';
declare const ServerConfigSchema: z.ZodObject<{
    port: z.ZodCoercedNumber<unknown>;
    facilitatorUrl: z.ZodString;
    merchantSolanaAddress: z.ZodOptional<z.ZodString>;
    facilitatorPublicKey: z.ZodOptional<z.ZodString>;
    solanaRpcUrl: z.ZodOptional<z.ZodString>;
    solanaWsUrl: z.ZodOptional<z.ZodString>;
    solanaNetwork: z.ZodOptional<z.ZodEnum<{
        devnet: "devnet";
        testnet: "testnet";
        "mainnet-beta": "mainnet-beta";
        localnet: "localnet";
    }>>;
}, z.core.$strip>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export declare function getServerConfig(): ServerConfig;
export {};
//# sourceMappingURL=get-server-config.d.ts.map