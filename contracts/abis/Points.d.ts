import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the initialize function call.
 */
export type Initialize = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the addPoints function call.
 */
export type AddPoints = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPoints function call.
 */
export type GetPoints = CallResult<
    {
        points: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setReferrer function call.
 */
export type SetReferrer = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the claimAirdrop function call.
 */
export type ClaimAirdrop = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the triggerAirdrop function call.
 */
export type TriggerAirdrop = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the totalPoints function call.
 */
export type TotalPoints = CallResult<
    {
        total: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isAuthorized function call.
 */
export type IsAuthorized = CallResult<
    {
        authorized: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IPoints
// ------------------------------------------------------------------
export interface IPoints extends IOP_NETContract {
    initialize(): Promise<Initialize>;
    addPoints(recipient: Address, amount: bigint): Promise<AddPoints>;
    getPoints(addr: Address): Promise<GetPoints>;
    setReferrer(referrer: Address): Promise<SetReferrer>;
    claimAirdrop(): Promise<ClaimAirdrop>;
    triggerAirdrop(): Promise<TriggerAirdrop>;
    totalPoints(): Promise<TotalPoints>;
    isAuthorized(addr: Address): Promise<IsAuthorized>;
}
