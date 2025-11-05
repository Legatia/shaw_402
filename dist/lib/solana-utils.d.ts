/**
 * Solana utilities using Gill SDK
 * Handles Solana operations, signatures, and transactions
 */
import type { Address } from 'gill';
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
        [key: string]: Array<{
            name: string;
            type: string;
        }>;
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
export declare class SolanaUtils {
    private rpc;
    private rpcSubscriptions?;
    private rpcUrl;
    constructor(config: SolanaUtilsConfig);
    /**
     * Get SOL balance for a public key
     */
    getSOLBalance(publicKey: string): Promise<bigint>;
    /**
     * Check if a public key is valid
     */
    isValidPublicKey(addr: string): boolean;
    /**
     * Verify a signature against a message and public key
     */
    verifySignature(message: string, signature: string, publicKey: string): boolean;
    /**
     * Verify a structured data signature (EIP-712 equivalent for Solana)
     */
    verifyStructuredDataSignature(structuredData: StructuredData, signature: string, publicKey: string): boolean;
    /**
     * Sign a message with a keypair (for testing purposes)
     */
    signMessage(message: string, privateKeyBase58: string): string;
    /**
     * Sign structured data (EIP-712 equivalent) for x402 authorization
     */
    signStructuredData(structuredData: StructuredData, privateKeyBase58: string): string;
    /**
     * Convert lamports to SOL
     */
    lamportsToSOL(lamports: bigint): number;
    /**
     * Convert SOL to lamports
     */
    solToLamports(sol: number): bigint;
    /**
     * Get recent blockhash
     */
    getRecentBlockhash(): Promise<string>;
    /**
     * Get transaction details
     */
    getTransaction(signature: string): Promise<any>;
    /**
     * Get RPC instance for direct access
     */
    getRpc(): import("gill").Rpc<(import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi) | (import("gill").RequestAirdropApi & import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi)> | import("gill").RpcDevnet<(import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi) | (import("gill").RequestAirdropApi & import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi)> | import("gill").RpcMainnet<(import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi) | (import("gill").RequestAirdropApi & import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi)> | import("gill").RpcTestnet<(import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi) | (import("gill").RequestAirdropApi & import("gill").GetAccountInfoApi & import("gill").GetBalanceApi & import("gill").GetBlockApi & import("gill").GetBlockCommitmentApi & import("gill").GetBlockHeightApi & import("gill").GetBlockProductionApi & import("gill").GetBlocksApi & import("gill").GetBlocksWithLimitApi & import("gill").GetBlockTimeApi & import("gill").GetClusterNodesApi & import("gill").GetEpochInfoApi & import("gill").GetEpochScheduleApi & import("gill").GetFeeForMessageApi & import("gill").GetFirstAvailableBlockApi & import("gill").GetGenesisHashApi & import("gill").GetHealthApi & import("gill").GetHighestSnapshotSlotApi & import("gill").GetIdentityApi & import("gill").GetInflationGovernorApi & import("gill").GetInflationRateApi & import("gill").GetInflationRewardApi & import("gill").GetLargestAccountsApi & import("gill").GetLatestBlockhashApi & import("gill").GetLeaderScheduleApi & import("gill").GetMaxRetransmitSlotApi & import("gill").GetMaxShredInsertSlotApi & import("gill").GetMinimumBalanceForRentExemptionApi & import("gill").GetMultipleAccountsApi & import("gill").GetProgramAccountsApi & import("gill").GetRecentPerformanceSamplesApi & import("gill").GetRecentPrioritizationFeesApi & import("gill").GetSignaturesForAddressApi & import("gill").GetSignatureStatusesApi & import("gill").GetSlotApi & import("gill").GetSlotLeaderApi & import("gill").GetSlotLeadersApi & import("gill").GetStakeMinimumDelegationApi & import("gill").GetSupplyApi & import("gill").GetTokenAccountBalanceApi & import("gill").GetTokenAccountsByDelegateApi & import("gill").GetTokenAccountsByOwnerApi & import("gill").GetTokenLargestAccountsApi & import("gill").GetTokenSupplyApi & import("gill").GetTransactionApi & import("gill").GetTransactionCountApi & import("gill").GetVersionApi & import("gill").GetVoteAccountsApi & import("gill").IsBlockhashValidApi & import("gill").MinimumLedgerSlotApi & import("gill").SendTransactionApi & import("gill").SimulateTransactionApi)>;
    /**
     * Get RPC subscriptions instance for direct access
     */
    getRpcSubscriptions(): import("gill").RpcSubscriptions<import("gill").SolanaRpcSubscriptionsApi> | import("gill").RpcSubscriptionsDevnet<import("gill").SolanaRpcSubscriptionsApi> | import("gill").RpcSubscriptionsMainnet<import("gill").SolanaRpcSubscriptionsApi> | import("gill").RpcSubscriptionsTestnet<import("gill").SolanaRpcSubscriptionsApi> | undefined;
    /**
     * Submit a sponsored transaction (TRUE x402 instant finality)
     * Client signs the transaction, facilitator adds signature as fee payer.
     * This achieves instant on-chain settlement with NO debt tracking.
     * @param facilitatorPrivateKey - Facilitator private key in base58 format
     * @param serializedTransaction - Base64-encoded transaction signed by client
     * @returns Transaction signature
     */
    submitSponsoredTransaction(facilitatorPrivateKey: string, serializedTransaction: string): Promise<string>;
}
//# sourceMappingURL=solana-utils.d.ts.map