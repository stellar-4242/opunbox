/**
 * Contract state indexer.
 *
 * OPNet does not expose EVM-style filter-logs RPC.
 * For MVP we poll contract view methods every POLL_INTERVAL_MS to keep state fresh.
 */
import { store } from '../services/store.js';
import {
    callGetTotalDeposited,
    callGetAvailableBalance,
    callGetDepositInfo,
    callGetStakeInfo,
    callGetPendingRewards,
    callGetPoints,
} from '../services/contracts.js';
import type { LpPosition, StakingPosition, PointsBalance } from '../types/index.js';

// ─── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(process.env['POLL_INTERVAL_MS'] ?? '15000', 10);

// ─── Pool stats polling ────────────────────────────────────────────────────────

async function pollPoolStats(): Promise<void> {
    try {
        const [totalDepositedResult, availableBalanceResult] = await Promise.all([
            callGetTotalDeposited(),
            callGetAvailableBalance(),
        ]);

        const totalPool: bigint = totalDepositedResult?.properties.total ?? 0n;
        const available: bigint = availableBalanceResult?.properties.available ?? 0n;

        const reserveRatio = totalPool > 0n ? Number((available * 10000n) / totalPool) / 100 : 0;
        const activeLpCount = store.countActiveLps();
        const activeStakerCount = store.countActiveStakers();
        const { totalCasaStaked, totalStakingRewards } = store.aggregateStaking();

        store.setPoolStats({
            totalPoolSize: totalPool.toString(),
            availableBalance: available.toString(),
            reserveRatio,
            totalWagered: '0',
            houseProfit: '0',
            totalCasaStaked: totalCasaStaked.toString(),
            totalStakingRewards: totalStakingRewards.toString(),
            activeLpCount,
            activeStakerCount,
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[indexer] pollPoolStats failed: ${error.message}`);
        }
    }
}

// ─── LP position refresh ───────────────────────────────────────────────────────

export async function refreshLpPosition(address: string): Promise<void> {
    try {
        const depositResult = await callGetDepositInfo(address);
        const depositAmount: bigint = depositResult?.properties.amount ?? 0n;
        const existing: LpPosition | undefined = store.getLpPosition(address);

        const position: LpPosition = {
            address,
            deposits: existing?.deposits ?? [],
            totalDeposited: depositAmount.toString(),
            accumulatedRevenue: existing?.accumulatedRevenue ?? '0',
            casaEarned: existing?.casaEarned ?? '0',
        };

        store.setLpPosition(address, position);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[indexer] refreshLpPosition failed for ${address}: ${error.message}`);
        }
    }
}

// ─── Staking position refresh ──────────────────────────────────────────────────

export async function refreshStakingPosition(address: string): Promise<void> {
    try {
        const [stakeResult, rewardsResult] = await Promise.all([
            callGetStakeInfo(address),
            callGetPendingRewards(address),
        ]);

        const stake: bigint = stakeResult?.properties.staked ?? 0n;
        const rewards: bigint = rewardsResult?.properties.pending ?? 0n;
        const existing: StakingPosition | undefined = store.getStakingPosition(address);

        const position: StakingPosition = {
            address,
            stakedCasa: stake.toString(),
            multiplier: existing?.multiplier ?? '100',
            accumulatedRewards: rewards.toString(),
            stakeStartBlock: existing?.stakeStartBlock ?? 0,
        };

        store.setStakingPosition(address, position);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[indexer] refreshStakingPosition failed for ${address}: ${error.message}`);
        }
    }
}

// ─── Points refresh ────────────────────────────────────────────────────────────

export async function refreshPoints(address: string): Promise<void> {
    try {
        const result = await callGetPoints(address);
        const points: bigint = result?.properties.points ?? 0n;
        const existing: PointsBalance | undefined = store.getPointsBalance(address);

        const balance: PointsBalance = {
            address,
            totalPoints: points.toString(),
            wagerPoints: existing?.wagerPoints ?? '0',
            lpPoints: existing?.lpPoints ?? '0',
            referralPoints: existing?.referralPoints ?? '0',
            referralCount: existing?.referralCount ?? 0,
        };

        store.setPointsBalance(address, balance);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[indexer] refreshPoints failed for ${address}: ${error.message}`);
        }
    }
}

// ─── Polling loop ──────────────────────────────────────────────────────────────

let pollingHandle: ReturnType<typeof setInterval> | null = null;

export function startIndexer(): void {
    if (pollingHandle !== null) return;

    console.log(`[indexer] Starting — poll interval ${POLL_INTERVAL_MS.toString()}ms`);
    void pollPoolStats();

    pollingHandle = setInterval(() => {
        void pollPoolStats();
    }, POLL_INTERVAL_MS);
}

export function stopIndexer(): void {
    if (pollingHandle !== null) {
        clearInterval(pollingHandle);
        pollingHandle = null;
    }
}
