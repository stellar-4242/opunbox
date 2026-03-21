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
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getEmissionRate function call.
 */
export type GetEmissionRate = CallResult<
    {
        rate: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isMinter function call.
 */
export type IsMinter = CallResult<
    {
        authorized: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the computeEmissionWithBoost function call.
 */
export type ComputeEmissionWithBoost = CallResult<
    {
        rate: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ICASAToken
// ------------------------------------------------------------------
export interface ICASAToken extends IOP_NETContract {
    initialize(): Promise<Initialize>;
    mint(to: Address, amount: bigint): Promise<Mint>;
    getEmissionRate(): Promise<GetEmissionRate>;
    isMinter(addr: Address): Promise<IsMinter>;
    computeEmissionWithBoost(): Promise<ComputeEmissionWithBoost>;
}
