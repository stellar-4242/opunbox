import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';
import { checkRateLimit } from '../services/rateLimit.js';
import { refreshStakingPosition } from '../indexer/events.js';
import type { StakingPosition } from '../types/index.js';

const POSITION_CACHE_TTL_MS = parseInt(process.env['POSITION_CACHE_TTL_MS'] ?? '10000', 10);
const MAX_CACHE_ENTRIES = 5_000;
const positionLastFetched: Map<string, number> = new Map();

function recordFetch(address: string): void {
    if (positionLastFetched.size >= MAX_CACHE_ENTRIES) {
        const oldest = positionLastFetched.keys().next().value;
        if (oldest !== undefined) positionLastFetched.delete(oldest);
    }
    positionLastFetched.set(address, Date.now());
}

export function registerStakingRoutes(app: HyperExpress.Server): void {
    // GET /api/staking/:address
    app.get('/api/staking/:address', async (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const address = req.path_parameters['address'];
        if (!address || !/^[a-fA-F0-9]{1,128}$/.test(address)) {
            res.status(400).json({ success: false, error: 'Invalid address parameter' });
            return;
        }

        const now = Date.now();
        const lastFetch = positionLastFetched.get(address) ?? 0;
        const stale = now - lastFetch > POSITION_CACHE_TTL_MS;

        if (stale) {
            recordFetch(address);
            try {
                await refreshStakingPosition(address);
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`[api/staking] refresh failed: ${error.message}`);
                }
            }
        }

        const position = store.getStakingPosition(address);
        if (position === undefined) {
            const zeroPosition: StakingPosition = {
                address,
                stakedCasa: '0',
                multiplier: '100',
                accumulatedRewards: '0',
                stakeStartBlock: 0,
            };
            res.json({ success: true, data: zeroPosition });
            return;
        }

        res.json({ success: true, data: position });
    });
}
