import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the stake function call.
 */
export type Stake = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the unstake function call.
 */
export type Unstake = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the claimRewards function call.
 */
export type ClaimRewards = CallResult<
    {
        rewards: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the addRevenueShare function call.
 */
export type AddRevenueShare = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getStakeInfo function call.
 */
export type GetStakeInfo = CallResult<
    {
        staked: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPendingRewards function call.
 */
export type GetPendingRewards = CallResult<
    {
        pending: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ICASAStaking
// ------------------------------------------------------------------
export interface ICASAStaking extends IOP_NETContract {
    stake(amount: bigint): Promise<Stake>;
    unstake(): Promise<Unstake>;
    claimRewards(): Promise<ClaimRewards>;
    addRevenueShare(amount: bigint): Promise<AddRevenueShare>;
    getStakeInfo(addr: Address): Promise<GetStakeInfo>;
    getPendingRewards(addr: Address): Promise<GetPendingRewards>;
}
