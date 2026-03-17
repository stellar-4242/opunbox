import type {
    CaseResult,
    LpPosition,
    StakingPosition,
    PointsBalance,
    PoolStats,
    LeaderboardEntry,
    WsEvent,
    LargeWinEvent,
} from '../types/index.js';

// ─── LRU Map helper ────────────────────────────────────────────────────────────

const MAX_ADDRESS_ENTRIES = 5_000;

class LruMap<V> {
    private readonly map: Map<string, V> = new Map();
    private readonly max: number;

    public constructor(max: number) {
        this.max = max;
    }

    public get(key: string): V | undefined {
        const val = this.map.get(key);
        if (val !== undefined) {
            this.map.delete(key);
            this.map.set(key, val);
        }
        return val;
    }

    public set(key: string, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) {
                this.map.delete(oldest);
            }
        }
        this.map.set(key, value);
    }

    public has(key: string): boolean {
        return this.map.has(key);
    }

    public values(): IterableIterator<V> {
        return this.map.values();
    }

    public entries(): IterableIterator<[string, V]> {
        return this.map.entries();
    }

    public get size(): number {
        return this.map.size;
    }
}

// ─── Store ─────────────────────────────────────────────────────────────────────

class Store {
    private static storeInstance: Store | undefined;

    // Cases — hard cap at 10k entries; oldest evicted
    private readonly casesMap: LruMap<CaseResult> = new LruMap(10_000);
    private readonly casesByPlayerMap: LruMap<string[]> = new LruMap(MAX_ADDRESS_ENTRIES);
    private readonly lpPositionsMap: LruMap<LpPosition> = new LruMap(MAX_ADDRESS_ENTRIES);
    private readonly stakingPositionsMap: LruMap<StakingPosition> = new LruMap(MAX_ADDRESS_ENTRIES);
    private readonly pointsBalancesMap: LruMap<PointsBalance> = new LruMap(MAX_ADDRESS_ENTRIES);

    private leaderboardEntries: LeaderboardEntry[] = [];
    private poolStatsData: PoolStats | null = null;
    private lastIndexedBlockNum = 0;

    private readonly subscribers: Set<(event: WsEvent) => void> = new Set();

    private constructor() {
        // singleton
    }

    public static getInstance(): Store {
        if (Store.storeInstance === undefined) {
            Store.storeInstance = new Store();
        }
        return Store.storeInstance;
    }

    // ─── Block tracking ────────────────────────────────────────────────────────

    public get lastIndexedBlock(): number {
        return this.lastIndexedBlockNum;
    }

    public setLastIndexedBlock(block: number): void {
        this.lastIndexedBlockNum = block;
    }

    // ─── Case operations ───────────────────────────────────────────────────────

    public addCase(caseResult: CaseResult): void {
        this.casesMap.set(caseResult.txHash, caseResult);

        const playerCases = this.casesByPlayerMap.get(caseResult.player) ?? [];
        playerCases.push(caseResult.txHash);
        this.casesByPlayerMap.set(caseResult.player, playerCases);

        this.updateLeaderboard(caseResult);
        this.broadcast({ type: 'NEW_CASE', data: caseResult, timestamp: Date.now() });

        const LARGE_WIN_THRESHOLD = BigInt(process.env['LARGE_WIN_THRESHOLD'] ?? '10000000000');
        if (BigInt(caseResult.payout) >= LARGE_WIN_THRESHOLD) {
            const largeWin: LargeWinEvent = {
                player: caseResult.player,
                payout: caseResult.payout,
                multiplier: caseResult.multiplier,
                txHash: caseResult.txHash,
            };
            this.broadcast({ type: 'LARGE_WIN', data: largeWin, timestamp: Date.now() });
        }
    }

    public getCases(limit: number, offset: number, address?: string): CaseResult[] {
        let all: CaseResult[];
        if (address !== undefined) {
            const txHashes = this.casesByPlayerMap.get(address) ?? [];
            all = txHashes
                .map((h) => this.casesMap.get(h))
                .filter((c): c is CaseResult => c !== undefined);
        } else {
            all = Array.from(this.casesMap.values());
        }

        const sorted = all.slice().sort((a, b) => b.blockNumber - a.blockNumber);
        return sorted.slice(offset, offset + limit);
    }

    public getCase(txHash: string): CaseResult | undefined {
        return this.casesMap.get(txHash);
    }

    public getCaseCount(): number {
        return this.casesMap.size;
    }

    // ─── Pool stats ────────────────────────────────────────────────────────────

    public setPoolStats(stats: PoolStats): void {
        this.poolStatsData = stats;
        this.broadcast({ type: 'POOL_UPDATE', data: stats, timestamp: Date.now() });
    }

    public getPoolStats(): PoolStats | null {
        return this.poolStatsData;
    }

    // ─── LP positions ──────────────────────────────────────────────────────────

    public setLpPosition(address: string, position: LpPosition): void {
        this.lpPositionsMap.set(address, position);
    }

    public getLpPosition(address: string): LpPosition | undefined {
        return this.lpPositionsMap.get(address);
    }

    public getLpPositionValues(): IterableIterator<LpPosition> {
        return this.lpPositionsMap.values();
    }

    // ─── Staking positions ─────────────────────────────────────────────────────

    public setStakingPosition(address: string, position: StakingPosition): void {
        this.stakingPositionsMap.set(address, position);
    }

    public getStakingPosition(address: string): StakingPosition | undefined {
        return this.stakingPositionsMap.get(address);
    }

    public getStakingPositionValues(): IterableIterator<StakingPosition> {
        return this.stakingPositionsMap.values();
    }

    // ─── Points ────────────────────────────────────────────────────────────────

    public setPointsBalance(address: string, points: PointsBalance): void {
        this.pointsBalancesMap.set(address, points);
    }

    public getPointsBalance(address: string): PointsBalance | undefined {
        return this.pointsBalancesMap.get(address);
    }

    // ─── Leaderboard ───────────────────────────────────────────────────────────

    public getLeaderboard(limit: number): LeaderboardEntry[] {
        return this.leaderboardEntries.slice(0, limit);
    }

    public getCaseEntries(): IterableIterator<CaseResult> {
        return this.casesMap.values();
    }

    private updateLeaderboard(caseResult: CaseResult): void {
        const existing = this.leaderboardEntries.find((e) => e.address === caseResult.player);
        if (existing !== undefined) {
            existing.totalWagered = (BigInt(existing.totalWagered) + BigInt(caseResult.betAmount)).toString();
            existing.caseCount += 1;
        } else {
            this.leaderboardEntries.push({
                rank: 0,
                address: caseResult.player,
                totalWagered: caseResult.betAmount,
                caseCount: 1,
            });
        }

        this.leaderboardEntries.sort((a, b) =>
            Number(BigInt(b.totalWagered) - BigInt(a.totalWagered)),
        );
        this.leaderboardEntries.forEach((entry, idx) => {
            entry.rank = idx + 1;
        });
    }

    // ─── WebSocket broadcasting ────────────────────────────────────────────────

    public subscribe(fn: (event: WsEvent) => void): () => void {
        this.subscribers.add(fn);
        return (): void => {
            this.subscribers.delete(fn);
        };
    }

    public broadcast(event: WsEvent): void {
        for (const fn of this.subscribers) {
            try {
                fn(event);
            } catch {
                // subscriber errors must not crash the store
            }
        }
    }

    public subscriberCount(): number {
        return this.subscribers.size;
    }

    // ─── Aggregate helpers for stats ──────────────────────────────────────────

    public countActiveLps(): number {
        let count = 0;
        for (const pos of this.lpPositionsMap.values()) {
            if (BigInt(pos.totalDeposited) > 0n) count++;
        }
        return count;
    }

    public countActiveStakers(): number {
        let count = 0;
        for (const pos of this.stakingPositionsMap.values()) {
            if (BigInt(pos.stakedCasa) > 0n) count++;
        }
        return count;
    }

    public aggregateStaking(): { totalCasaStaked: bigint; totalStakingRewards: bigint } {
        let totalCasaStaked = 0n;
        let totalStakingRewards = 0n;
        for (const pos of this.stakingPositionsMap.values()) {
            totalCasaStaked += BigInt(pos.stakedCasa);
            totalStakingRewards += BigInt(pos.accumulatedRewards);
        }
        return { totalCasaStaked, totalStakingRewards };
    }
}

export const store = Store.getInstance();
