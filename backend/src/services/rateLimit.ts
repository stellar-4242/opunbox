// Token-bucket rate limiter — in-process, no Redis dep for MVP

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const MAX_BUCKETS = 10_000;
const buckets: Map<string, Bucket> = new Map();

const RATE_LIMIT_RPM = parseInt(process.env['RATE_LIMIT_RPM'] ?? '60', 10);
const REFILL_INTERVAL_MS = 60_000;

export function checkRateLimit(ip: string): boolean {
    const now = Date.now();

    // Prune if over limit
    if (buckets.size >= MAX_BUCKETS) {
        pruneOldBuckets(now);
    }

    let bucket = buckets.get(ip);
    if (!bucket) {
        bucket = { tokens: RATE_LIMIT_RPM, lastRefill: now };
        buckets.set(ip, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= REFILL_INTERVAL_MS) {
        bucket.tokens = RATE_LIMIT_RPM;
        bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
        return false;
    }

    bucket.tokens -= 1;
    return true;
}

function pruneOldBuckets(now: number): void {
    for (const [ip, bucket] of buckets.entries()) {
        if (now - bucket.lastRefill > REFILL_INTERVAL_MS * 2) {
            buckets.delete(ip);
        }
    }
}

// Prune stale buckets every 10 minutes
setInterval(() => {
    pruneOldBuckets(Date.now());
}, 600_000);
