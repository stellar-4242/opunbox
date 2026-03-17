import HyperExpress from '@btc-vision/hyper-express';
import { registerStatsRoutes } from './api/stats.js';
import { registerCasesRoutes } from './api/cases.js';
import { registerLpRoutes } from './api/lp.js';
import { registerStakingRoutes } from './api/staking.js';
import { registerPointsRoutes } from './api/points.js';
import { registerLeaderboardRoutes } from './api/leaderboard.js';
import { registerWebSocketRoute } from './api/websocket.js';
import { startIndexer } from './indexer/events.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const CORS_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';

const app = new HyperExpress.Server({
    max_body_length: 1024 * 1024 * 8,
    fast_abort: true,
    max_body_buffer: 1024 * 32,
    idle_timeout: 60,
    response_timeout: 120,
});

// ─── Global error handler (register FIRST) ────────────────────────────────────
app.set_error_handler((req, res, error) => {
    if (res.closed) return;
    console.error(
        `[server] Unhandled error on ${req.method} ${req.path}:`,
        error instanceof Error ? error.message : String(error),
    );
    res.atomic(() => {
        res.status(500);
        res.json({ success: false, error: 'Internal server error' });
    });
});

// ─── CORS middleware ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    next();
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── API routes ────────────────────────────────────────────────────────────────
registerStatsRoutes(app);
registerCasesRoutes(app);
registerLpRoutes(app);
registerStakingRoutes(app);
registerPointsRoutes(app);
registerLeaderboardRoutes(app);
registerWebSocketRoute(app);

// ─── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT)
    .then(() => {
        console.log(`[server] MOTO Casino API running on port ${PORT.toString()}`);
        startIndexer();
    })
    .catch((error: unknown) => {
        console.error(
            '[server] Failed to start:',
            error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
    });
