import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';
import { checkRateLimit } from '../services/rateLimit.js';
import type { LeaderboardEntry } from '../types/index.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const VALID_PERIODS = new Set(['day', 'week', 'all']);

export function registerLeaderboardRoutes(app: HyperExpress.Server): void {
    // GET /api/leaderboard?period=day|week|all&limit=20
    app.get('/api/leaderboard', (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const rawLimit = req.query_parameters['limit'];
        const period = req.query_parameters['period'] ?? 'all';

        const limit = Math.min(
            rawLimit ? (parseInt(rawLimit, 10) || DEFAULT_LIMIT) : DEFAULT_LIMIT,
            MAX_LIMIT,
        );

        if (!VALID_PERIODS.has(period)) {
            res.status(400).json({ success: false, error: 'Invalid period — use day, week, or all' });
            return;
        }

        let entries: LeaderboardEntry[];

        if (period === 'all') {
            entries = store.getLeaderboard(limit);
        } else {
            // Filter by time period
            const cutoffMs = period === 'day'
                ? Date.now() - 86_400_000
                : Date.now() - 7 * 86_400_000;

            const volumeByAddress = new Map<string, bigint>();
            const countByAddress = new Map<string, number>();

            for (const c of store.getCaseEntries()) {
                if (c.timestamp >= cutoffMs) {
                    const existing = volumeByAddress.get(c.player) ?? 0n;
                    volumeByAddress.set(c.player, existing + BigInt(c.betAmount));
                    countByAddress.set(c.player, (countByAddress.get(c.player) ?? 0) + 1);
                }
            }

            entries = Array.from(volumeByAddress.entries())
                .sort(([, a], [, b]) => {
                    if (b > a) return 1;
                    if (b < a) return -1;
                    return 0;
                })
                .slice(0, limit)
                .map(([address, totalWagered], idx): LeaderboardEntry => ({
                    rank: idx + 1,
                    address,
                    totalWagered: totalWagered.toString(),
                    caseCount: countByAddress.get(address) ?? 0,
                }));
        }

        res.json({ success: true, data: entries });
    });
}
