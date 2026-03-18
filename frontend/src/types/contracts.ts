import type { ContractDecodedObjectResult } from 'opnet';
import type { CallResult } from 'opnet';

// Index-signature-compatible result types (required by ContractDecodedObjectResult)
export interface OpenCaseResult extends ContractDecodedObjectResult {
    won: boolean;
    payout: bigint;
}

export interface GetPoolInfoResult extends ContractDecodedObjectResult {
    totalDeposited: bigint;
}

export interface DepositResult extends ContractDecodedObjectResult {
    success: boolean;
}

export interface WithdrawResult extends ContractDecodedObjectResult {
    amount: bigint;
}

export interface GetTotalDepositedResult extends ContractDecodedObjectResult {
    total: bigint;
}

export interface GetAvailableBalanceResult extends ContractDecodedObjectResult {
    available: bigint;
}

export interface GetDepositInfoResult extends ContractDecodedObjectResult {
    amount: bigint;
}

export interface IsAboveMinimumResult extends ContractDecodedObjectResult {
    above: boolean;
}

export interface StakeResult extends ContractDecodedObjectResult {
    success: boolean;
}

export interface UnstakeResult extends ContractDecodedObjectResult {
    amount: bigint;
}

export interface ClaimRewardsResult extends ContractDecodedObjectResult {
    rewards: bigint;
}

export interface GetStakeInfoResult extends ContractDecodedObjectResult {
    staked: bigint;
}

export interface GetPendingRewardsResult extends ContractDecodedObjectResult {
    pending: bigint;
}

export interface GetPointsResult extends ContractDecodedObjectResult {
    points: bigint;
}

export interface TotalPointsResult extends ContractDecodedObjectResult {
    total: bigint;
}

export interface ClaimAirdropResult extends ContractDecodedObjectResult {
    amount: bigint;
}

// Typed CallResult aliases
export type TypedCallResult<T extends ContractDecodedObjectResult> = CallResult<T>;

// Contract interfaces
export interface AllowanceResult extends ContractDecodedObjectResult {
    success: boolean;
}

export interface IOP20TokenContract {
    increaseAllowance(spender: unknown, amount: bigint): Promise<TypedCallResult<AllowanceResult>>;
}

export interface ICaseEngineContract {
    openCase(amount: bigint, userSeed: Uint8Array): Promise<TypedCallResult<OpenCaseResult>>;
    getPoolInfo(): Promise<TypedCallResult<GetPoolInfoResult>>;
}

export interface ILPPoolContract {
    deposit(amount: bigint, lockTier: number): Promise<TypedCallResult<DepositResult>>;
    withdraw(): Promise<TypedCallResult<WithdrawResult>>;
    getTotalDeposited(): Promise<TypedCallResult<GetTotalDepositedResult>>;
    getAvailableBalance(): Promise<TypedCallResult<GetAvailableBalanceResult>>;
    getDepositInfo(addr: unknown): Promise<TypedCallResult<GetDepositInfoResult>>;
    isAboveMinimum(): Promise<TypedCallResult<IsAboveMinimumResult>>;
}

export interface ICASAStakingContract {
    stake(amount: bigint): Promise<TypedCallResult<StakeResult>>;
    unstake(): Promise<TypedCallResult<UnstakeResult>>;
    claimRewards(): Promise<TypedCallResult<ClaimRewardsResult>>;
    getStakeInfo(addr: unknown): Promise<TypedCallResult<GetStakeInfoResult>>;
    getPendingRewards(addr: unknown): Promise<TypedCallResult<GetPendingRewardsResult>>;
}

export interface IPointsContract {
    getPoints(addr: unknown): Promise<TypedCallResult<GetPointsResult>>;
    setReferrer(referrer: unknown): Promise<TypedCallResult<DepositResult>>;
    claimAirdrop(): Promise<TypedCallResult<ClaimAirdropResult>>;
    triggerAirdrop(): Promise<TypedCallResult<DepositResult>>;
    totalPoints(): Promise<TypedCallResult<TotalPointsResult>>;
}

export interface CaseResult {
    won: boolean;
    payout: bigint;
    txHash: string;
    amount: bigint;
    timestamp: number;
}

export type LockTier = 0 | 1 | 2;

export interface LockTierInfo {
    tier: LockTier;
    label: string;
    duration: string;
    multiplier: string;
    days: number;
}

export const LOCK_TIERS: LockTierInfo[] = [
    { tier: 0, label: '7 Days', duration: '7d', multiplier: '1.0x', days: 7 },
    { tier: 1, label: '30 Days', duration: '30d', multiplier: '1.5x', days: 30 },
    { tier: 2, label: '90 Days', duration: '90d', multiplier: '2.5x', days: 90 },
];
