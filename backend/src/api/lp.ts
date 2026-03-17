import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';
import { checkRateLimit } from '../services/rateLimit.js';
import { refreshLpPosition } from '../indexer/events.js';
import type { LpPosition } from '../types/index.js';

// Per-address TTL cache — LRU via Map insertion order
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

export function registerLpRoutes(app: HyperExpress.Server): void {
    // GET /api/lp/:address
    app.get('/api/lp/:address', async (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const address = req.path_parameters['address'];
        if (!address) {
            res.status(400).json({ success: false, error: 'Missing address parameter' });
            return;
        }

        const now = Date.now();
        const lastFetch = positionLastFetched.get(address) ?? 0;
        const stale = now - lastFetch > POSITION_CACHE_TTL_MS;

        if (stale) {
            recordFetch(address);
            try {
                await refreshLpPosition(address);
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`[api/lp] refresh failed: ${error.message}`);
                }
                // Fall through — serve cached data if available
            }
        }

        const position = store.getLpPosition(address);
        if (position === undefined) {
            const zeroPosition: LpPosition = {
                address,
                deposits: [],
                totalDeposited: '0',
                accumulatedRevenue: '0',
                casaEarned: '0',
            };
            res.json({ success: true, data: zeroPosition });
            return;
        }

        res.json({ success: true, data: position });
    });
}
