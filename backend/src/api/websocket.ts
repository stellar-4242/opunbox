import type HyperExpress from '@btc-vision/hyper-express';
import { store } from '../services/store.js';

const MAX_WS_CONNECTIONS = 500;
let activeConnections = 0;

export function registerWebSocketRoute(app: HyperExpress.Server): void {
    app.ws('/ws', { idle_timeout: 120, max_payload_length: 16 * 1024 }, (ws) => {
        // Enforce connection limit
        if (activeConnections >= MAX_WS_CONNECTIONS) {
            ws.send(JSON.stringify({ type: 'ERROR', error: 'Too many connections', timestamp: Date.now() }));
            ws.close();
            return;
        }

        activeConnections++;

        // Subscribe to store broadcast events
        const unsubscribe = store.subscribe((event) => {
            try {
                ws.send(JSON.stringify(event));
            } catch {
                // WS may have closed between subscribe and send
            }
        });

        // Send current pool stats immediately on connect
        const stats = store.getPoolStats();
        if (stats !== null) {
            ws.send(JSON.stringify({ type: 'POOL_UPDATE', data: stats, timestamp: Date.now() }));
        }

        // Send last 5 cases on connect
        const recentCases = store.getCases(5, 0);
        for (const c of recentCases) {
            ws.send(JSON.stringify({ type: 'NEW_CASE', data: c, timestamp: Date.now() }));
        }

        ws.on('close', () => {
            activeConnections--;
            unsubscribe();
        });
    });
}
