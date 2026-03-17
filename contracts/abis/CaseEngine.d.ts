import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the openCase function call.
 */
export type OpenCase = CallResult<
    {
        won: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPoolInfo function call.
 */
export type GetPoolInfo = CallResult<
    {
        totalDeposited: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ICaseEngine
// ------------------------------------------------------------------
export interface ICaseEngine extends IOP_NETContract {
    openCase(amount: bigint, userSeed: Uint8Array): Promise<OpenCase>;
    getPoolInfo(): Promise<GetPoolInfo>;
}
