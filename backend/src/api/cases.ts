import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';
import { checkRateLimit } from '../services/rateLimit.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function registerCasesRoutes(app: HyperExpress.Server): void {
    // GET /api/cases?limit=20&offset=0&address=optional
    app.get('/api/cases', (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const rawLimit = req.query_parameters['limit'];
        const rawOffset = req.query_parameters['offset'];
        const address = req.query_parameters['address'];

        const limit = Math.min(
            rawLimit ? (parseInt(rawLimit, 10) || DEFAULT_LIMIT) : DEFAULT_LIMIT,
            MAX_LIMIT,
        );
        const offset = rawOffset ? (parseInt(rawOffset, 10) || 0) : 0;

        if (limit < 1 || offset < 0) {
            res.status(400).json({ success: false, error: 'Invalid pagination parameters' });
            return;
        }

        const cases = store.getCases(limit, offset, address);
        res.json({ success: true, data: cases });
    });

    // GET /api/cases/:txHash
    app.get('/api/cases/:txHash', (req, res) => {
        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }

        const txHash = req.path_parameters['txHash'];
        if (!txHash) {
            res.status(400).json({ success: false, error: 'Missing txHash parameter' });
            return;
        }

        const caseResult = store.getCase(txHash);
        if (caseResult === undefined) {
            res.status(404).json({ success: false, error: 'Case not found' });
            return;
        }

        res.json({ success: true, data: caseResult });
    });
}
