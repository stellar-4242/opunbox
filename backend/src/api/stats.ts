import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';
import { checkRateLimit } from '../services/rateLimit.js';

export function registerStatsRoutes(app: HyperExpress.Server): void {
    app.get('/api/stats', (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const stats = store.getPoolStats();
        if (stats === null) {
            res.status(503).json({ success: false, error: 'Stats not yet available — indexer starting' });
            return;
        }

        res.json({ success: true, data: stats });
    });
}
