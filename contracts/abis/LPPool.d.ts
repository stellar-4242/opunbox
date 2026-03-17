import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the deposit function call.
 */
export type Deposit = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the withdraw function call.
 */
export type Withdraw = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the pullPayout function call.
 */
export type PullPayout = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the addRevenue function call.
 */
export type AddRevenue = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getTotalDeposited function call.
 */
export type GetTotalDeposited = CallResult<
    {
        total: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getAvailableBalance function call.
 */
export type GetAvailableBalance = CallResult<
    {
        available: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getDepositInfo function call.
 */
export type GetDepositInfo = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isAboveMinimum function call.
 */
export type IsAboveMinimum = CallResult<
    {
        above: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ILPPool
// ------------------------------------------------------------------
export interface ILPPool extends IOP_NETContract {
    deposit(amount: bigint, lockTier: number): Promise<Deposit>;
    withdraw(): Promise<Withdraw>;
    pullPayout(recipient: Address, amount: bigint): Promise<PullPayout>;
    addRevenue(amount: bigint): Promise<AddRevenue>;
    getTotalDeposited(): Promise<GetTotalDeposited>;
    getAvailableBalance(): Promise<GetAvailableBalance>;
    getDepositInfo(addr: Address): Promise<GetDepositInfo>;
    isAboveMinimum(): Promise<IsAboveMinimum>;
}
