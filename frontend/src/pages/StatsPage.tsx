import React, { useState, useEffect, useCallback } from 'react';
import { getLPPoolContract, getCaseEngineContract } from '../services/contracts';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { formatTokenAmount } from '../utils/format';

interface DashboardStats {
    poolTotal: bigint;
    poolAvailable: bigint;
    caseEngineTotal: bigint;
    isAboveMinimum: boolean;
}

function getHealthClass(ratio: number | null): { dotClass: string; label: string } {
    if (ratio === null) return { dotClass: '', label: '--' };
    if (ratio >= 40) return { dotClass: 'stat-card__health-dot--green', label: 'Healthy' };
    if (ratio >= 20) return { dotClass: 'stat-card__health-dot--yellow', label: 'Moderate' };
    return { dotClass: 'stat-card__health-dot--red', label: 'Low Reserve' };
}

function getReserveBarClass(ratio: number): string {
    if (ratio >= 40) return 'reserve-bar__fill--green';
    if (ratio >= 20) return 'reserve-bar__fill--yellow';
    return 'reserve-bar__fill--red';
}

export function StatsPage(): React.ReactElement {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(false);

    const loadStats = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const lpContract = getLPPoolContract();
            const caseContract = getCaseEngineContract();

            const [totalRes, availRes, minRes, poolInfoRes] = await Promise.all([
                lpContract.getTotalDeposited(),
                lpContract.getAvailableBalance(),
                lpContract.isAboveMinimum(),
                caseContract.getPoolInfo(),
            ]);

            setStats({
                poolTotal: totalRes.properties.total,
                poolAvailable: availRes.properties.available,
                caseEngineTotal: poolInfoRes.properties.totalDeposited,
                isAboveMinimum: minRes.properties.above,
            });
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect((): void => {
        void loadStats();
    }, [loadStats]);

    const reserveRatio = stats && stats.poolTotal > 0n
        ? Number((stats.poolAvailable * 100n) / stats.poolTotal)
        : null;

    const health = getHealthClass(reserveRatio);

    return (
        <main className="page">
            <div className="page__header">
                <h1 className="page__title">Protocol Stats</h1>
                <p className="page__subtitle">On-chain metrics for the MOTO Casino protocol</p>
            </div>

            {loading ? (
                <div className="stats-grid">
                    <div className="stat-card"><SkeletonBlock lines={2} /></div>
                    <div className="stat-card"><SkeletonBlock lines={2} /></div>
                    <div className="stat-card"><SkeletonBlock lines={2} /></div>
                    <div className="stat-card"><SkeletonBlock lines={2} /></div>
                </div>
            ) : stats ? (
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-card__label">Total LP Pool</span>
                        <span className="stat-card__value tabular">{formatTokenAmount(stats.poolTotal)} $MOTO</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__label">Available Balance</span>
                        <span className="stat-card__value tabular">{formatTokenAmount(stats.poolAvailable)} $MOTO</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__label">Reserve Ratio</span>
                        <span className={`stat-card__value tabular ${reserveRatio !== null && reserveRatio < 20 ? 'stat-card__value--warn' : ''}`}>
                            {reserveRatio !== null ? `${reserveRatio.toFixed(1)}%` : '--'}
                        </span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__label">Pool Health</span>
                        <span className={`stat-card__value stat-card__health ${stats.isAboveMinimum ? 'stat-card__value--ok' : 'stat-card__value--warn'}`}>
                            {health.dotClass && (
                                <span className={`stat-card__health-dot ${health.dotClass}`} />
                            )}
                            {health.label}
                        </span>
                    </div>
                </div>
            ) : (
                <p className="form-hint form-hint--center">Unable to load stats</p>
            )}

            {/* Reserve Ratio Bar */}
            {stats && reserveRatio !== null && (
                <div className="card">
                    <h2 className="card__title">Reserve Ratio</h2>
                    <div className="reserve-bar-wrap">
                        <div className="reserve-bar-labels">
                            <span>Available: {reserveRatio.toFixed(1)}%</span>
                            <span>Reserved / Locked: {(100 - reserveRatio).toFixed(1)}%</span>
                        </div>
                        <div className="reserve-bar">
                            <div
                                className={`reserve-bar__fill ${getReserveBarClass(reserveRatio)}`}
                                style={{ width: `${Math.min(reserveRatio, 100)}%` }}
                            />
                        </div>
                        <span className="form-hint">
                            Green: healthy (&gt;40%) — Yellow: moderate (20–40%) — Red: critical (&lt;20%)
                        </span>
                    </div>
                </div>
            )}

            <div className="card">
                <h2 className="card__title">Revenue Distribution</h2>
                <div className="split-viz">
                    <div className="split-bar">
                        <div className="split-bar__segment split-bar__segment--lp" style={{ width: '60%' }}>
                            <span>60% LP Providers</span>
                        </div>
                        <div className="split-bar__segment split-bar__segment--staking" style={{ width: '30%' }}>
                            <span>30% Stakers</span>
                        </div>
                        <div className="split-bar__segment split-bar__segment--treasury" style={{ width: '10%' }}>
                            <span>10% Treasury</span>
                        </div>
                    </div>
                    <div className="split-legend">
                        <div className="split-legend__item">
                            <span className="split-legend__dot split-legend__dot--lp" />
                            <span>60% LP Providers — pro-rata by deposit and lock tier</span>
                        </div>
                        <div className="split-legend__item">
                            <span className="split-legend__dot split-legend__dot--staking" />
                            <span>30% $CASA Stakers — weighted by stake and multiplier</span>
                        </div>
                        <div className="split-legend__item">
                            <span className="split-legend__dot split-legend__dot--treasury" />
                            <span>10% Treasury</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <h2 className="card__title">Protocol Rules</h2>
                <ul className="info-list">
                    <li>Max bet capped at 1% of total LP pool</li>
                    <li>Max payout capped at 5% of available LP balance</li>
                    <li>20% reserve ratio always maintained</li>
                    <li>Cases revert if pool is below minimum threshold</li>
                    <li>RNG: hash(blockhash + userSeed + nonce) per transaction</li>
                    <li>$CASA emissions halve every 90 days</li>
                    <li>Early LP bonus: 3x $CASA for first 30 days</li>
                </ul>
            </div>
        </main>
    );
}
