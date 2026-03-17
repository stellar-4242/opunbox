import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { getLPPoolContract, getCaseEngineContract } from '../services/contracts';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { formatTokenAmount } from '../utils/format';
export function StatsPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const loadStats = useCallback(async () => {
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
        }
        catch {
            // silently fail
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadStats();
    }, [loadStats]);
    const reserveRatio = stats && stats.poolTotal > 0n
        ? Number((stats.poolAvailable * 100n) / stats.poolTotal)
        : null;
    return (_jsxs("main", { className: "page", children: [_jsxs("div", { className: "page__header", children: [_jsx("h1", { className: "page__title", children: "Protocol Stats" }), _jsx("p", { className: "page__subtitle", children: "On-chain metrics for the MOTO Casino protocol" })] }), loading ? (_jsxs("div", { className: "stats-grid", children: [_jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) })] })) : stats ? (_jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Total LP Pool" }), _jsxs("span", { className: "stat-card__value tabular", children: [formatTokenAmount(stats.poolTotal), " $MOTO"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Available Balance" }), _jsxs("span", { className: "stat-card__value tabular", children: [formatTokenAmount(stats.poolAvailable), " $MOTO"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Reserve Ratio" }), _jsx("span", { className: `stat-card__value tabular ${reserveRatio !== null && reserveRatio < 20 ? 'stat-card__value--warn' : ''}`, children: reserveRatio !== null ? `${reserveRatio.toFixed(1)}%` : '--' })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Pool Status" }), _jsx("span", { className: `stat-card__value ${stats.isAboveMinimum ? 'stat-card__value--ok' : 'stat-card__value--warn'}`, children: stats.isAboveMinimum ? 'Active' : 'Below Minimum' })] })] })) : (_jsx("p", { className: "form-hint form-hint--center", children: "Unable to load stats" })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Revenue Distribution" }), _jsxs("div", { className: "split-viz", children: [_jsxs("div", { className: "split-bar", children: [_jsx("div", { className: "split-bar__segment split-bar__segment--lp", style: { width: '60%' }, children: _jsx("span", { children: "60% LP Providers" }) }), _jsx("div", { className: "split-bar__segment split-bar__segment--staking", style: { width: '30%' }, children: _jsx("span", { children: "30% Stakers" }) }), _jsx("div", { className: "split-bar__segment split-bar__segment--treasury", style: { width: '10%' }, children: _jsx("span", { children: "10% Treasury" }) })] }), _jsxs("div", { className: "split-legend", children: [_jsxs("div", { className: "split-legend__item", children: [_jsx("span", { className: "split-legend__dot split-legend__dot--lp" }), _jsx("span", { children: "60% LP Providers (pro-rata by deposit and lock tier)" })] }), _jsxs("div", { className: "split-legend__item", children: [_jsx("span", { className: "split-legend__dot split-legend__dot--staking" }), _jsx("span", { children: "30% $CASA Stakers (weighted by stake and multiplier)" })] }), _jsxs("div", { className: "split-legend__item", children: [_jsx("span", { className: "split-legend__dot split-legend__dot--treasury" }), _jsx("span", { children: "10% Treasury" })] })] })] })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Protocol Rules" }), _jsxs("ul", { className: "info-list", children: [_jsx("li", { children: "Max bet capped at 1% of total LP pool" }), _jsx("li", { children: "Max payout capped at 5% of total LP pool" }), _jsx("li", { children: "20% reserve ratio always maintained" }), _jsx("li", { children: "Cases revert if pool is below minimum threshold" }), _jsx("li", { children: "RNG: hash(blockhash + userSeed + nonce) per transaction" }), _jsx("li", { children: "$CASA emissions halve every 90 days" }), _jsx("li", { children: "Early LP bonus: 3x $CASA for first 30 days" })] })] })] }));
}
