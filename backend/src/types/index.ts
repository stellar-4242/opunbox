// ─── Domain Types ──────────────────────────────────────────────────────────────

export interface CaseResult {
    txHash: string;
    player: string;
    betAmount: string;    // bigint serialized as string
    payout: string;       // bigint serialized as string
    won: boolean;
    multiplier: string;   // e.g. "2.5"
    blockNumber: number;
    timestamp: number;    // Unix ms
}

export interface LpPosition {
    address: string;
    deposits: LpDeposit[];
    totalDeposited: string;    // bigint as string
    accumulatedRevenue: string; // bigint as string
    casaEarned: string;        // bigint as string
}

export interface LpDeposit {
    amount: string;     // bigint as string
    lockTier: number;   // 0=7d, 1=30d, 2=90d
    depositBlock: number;
    unlockBlock: number;
}

export interface StakingPosition {
    address: string;
    stakedCasa: string;          // bigint as string
    multiplier: string;          // scaled 100 = 1.0x, 130 = 1.3x
    accumulatedRewards: string;  // bigint as string
    stakeStartBlock: number;
}

export interface PointsBalance {
    address: string;
    totalPoints: string;    // bigint as string
    wagerPoints: string;
    lpPoints: string;
    referralPoints: string;
    referralCount: number;
}

export interface PoolStats {
    totalPoolSize: string;
    availableBalance: string;
    reserveRatio: number;       // 0-100 percentage
    totalWagered: string;
    houseProfit: string;
    totalCasaStaked: string;
    totalStakingRewards: string;
    activeLpCount: number;
    activeStakerCount: number;
}

export interface LeaderboardEntry {
    rank: number;
    address: string;
    totalWagered: string;   // bigint as string
    caseCount: number;
}

export interface WsEvent {
    type: 'NEW_CASE' | 'POOL_UPDATE' | 'LARGE_WIN';
    data: CaseResult | PoolStats | LargeWinEvent;
    timestamp: number;
}

export interface LargeWinEvent {
    player: string;
    payout: string;
    multiplier: string;
    txHash: string;
}

export interface AppState {
    lastIndexedBlock: number;
    cases: Map<string, CaseResult>;
    casesByPlayer: Map<string, string[]>;
    lpPositions: Map<string, LpPosition>;
    stakingPositions: Map<string, StakingPosition>;
    pointsBalances: Map<string, PointsBalance>;
    leaderboard: LeaderboardEntry[];
    poolStats: PoolStats | null;
}
