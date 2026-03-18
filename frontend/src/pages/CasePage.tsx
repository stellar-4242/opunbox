import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getCaseEngineContract, getMotoTokenContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import {
    generateUserSeed,
    validateHexSeed,
    hexToBytes32,
    parseTokenAmount,
    formatTokenAmount,
} from '../utils/format';
import type { CaseResult } from '../types/contracts';

const MAX_HISTORY = 10;
const CASE_ENGINE_ADDRESS = import.meta.env.VITE_CASE_ENGINE_ADDRESS as string | undefined;

interface RarityTier {
    key: string;
    name: string;
    colorClass: string;
    multiplier: string;
    probability: string;
    threshold: number;
}

const RARITY_TIERS: RarityTier[] = [
    { key: 'gold',   name: 'Knife',      colorClass: 'rarity-card--gold',   multiplier: '30x',    probability: '0.26%',  threshold: 0.0026  },
    { key: 'red',    name: 'Covert',     colorClass: 'rarity-card--red',    multiplier: '25x',    probability: '0.64%',  threshold: 0.009   },
    { key: 'pink',   name: 'Classified', colorClass: 'rarity-card--pink',   multiplier: '6x',     probability: '3.20%',  threshold: 0.041   },
    { key: 'purple', name: 'Restricted', colorClass: 'rarity-card--purple', multiplier: '2x',     probability: '15.98%', threshold: 0.2008  },
    { key: 'blue',   name: 'Mil-Spec',   colorClass: 'rarity-card--blue',   multiplier: '0.25x',  probability: '79.92%', threshold: 1       },
];

function getTierFromPayout(payout: bigint, betAmount: bigint): RarityTier {
    if (betAmount === 0n) return RARITY_TIERS[4];
    const ratio = Number(payout) / Number(betAmount);
    if (ratio >= 25)  return RARITY_TIERS[0]; // gold
    if (ratio >= 20)  return RARITY_TIERS[1]; // red
    if (ratio >= 5)   return RARITY_TIERS[2]; // pink
    if (ratio >= 1.5) return RARITY_TIERS[3]; // purple
    return RARITY_TIERS[4];                   // blue (loss / sub-1x)
}

function getResultClass(won: boolean, payout: bigint, betAmount: bigint): string {
    if (!won) return 'result-reveal--loss';
    const tier = getTierFromPayout(payout, betAmount);
    return `result-reveal--${tier.key}`;
}

function getResultLabel(won: boolean, payout: bigint, betAmount: bigint): string {
    if (!won) return 'MISS';
    const tier = getTierFromPayout(payout, betAmount);
    return tier.name.toUpperCase();
}

function getTierLabel(won: boolean, payout: bigint, betAmount: bigint): string {
    if (!won) return 'Mil-Spec';
    const tier = getTierFromPayout(payout, betAmount);
    return tier.name;
}

export function CasePage(): React.ReactElement {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);

    const [betAmount, setBetAmount] = useState('');
    const [userSeed, setUserSeed] = useState(generateUserSeed());
    const [useCustomSeed, setUseCustomSeed] = useState(false);
    const [customSeed, setCustomSeed] = useState('');
    const [seedError, setSeedError] = useState('');
    const [simulating, setSimulating] = useState(false);
    const [txStep, setTxStep] = useState<'idle' | 'approving' | 'opening'>('idle');
    const [lastResult, setLastResult] = useState<{ won: boolean; payout: bigint; betAmount: bigint } | null>(null);
    const [history, setHistory] = useState<CaseResult[]>([]);
    const [poolTotal, setPoolTotal] = useState<bigint | null>(null);
    const [poolLoading, setPoolLoading] = useState(false);

    useEffect((): void => {
        setPoolLoading(true);
        void (async (): Promise<void> => {
            try {
                const contract = getCaseEngineContract();
                const res = await contract.getPoolInfo();
                setPoolTotal(res.properties.totalDeposited);
            } catch {
                // Contract not configured or network error
            } finally {
                setPoolLoading(false);
            }
        })();
    }, []);

    const regenerateSeed = useCallback((): void => {
        setUserSeed(generateUserSeed());
    }, []);

    const handleCustomSeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
        const val = e.target.value;
        setCustomSeed(val);
        if (val && !validateHexSeed(val)) {
            setSeedError('Seed must be 64 hex characters (32 bytes)');
        } else {
            setSeedError('');
        }
    }, []);

    const handleOpenCase = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        if (!CASE_ENGINE_ADDRESS) return;

        const activeSeed = useCustomSeed ? customSeed : userSeed;
        if (useCustomSeed && !validateHexSeed(activeSeed)) {
            setSeedError('Seed must be 64 hex characters');
            return;
        }

        let amount: bigint;
        try {
            amount = parseTokenAmount(betAmount);
            if (amount <= 0n) return;
        } catch {
            return;
        }

        let seedBytes: Uint8Array;
        try {
            seedBytes = hexToBytes32(activeSeed);
        } catch {
            setSeedError('Invalid seed format');
            return;
        }

        reset();
        setSimulating(true);
        setTxStep('approving');
        setLastResult(null);

        try {
            // Step 1: increaseAllowance on MOTO token for the CaseEngine
            const motoToken = getMotoTokenContract(senderAddress);
            const allowanceResult = await motoToken.increaseAllowance(CASE_ENGINE_ADDRESS, amount);

            if (allowanceResult.revert) {
                throw new Error(`Allowance failed: ${allowanceResult.revert}`);
            }

            setSimulating(false);
            const allowanceTxHash = await send(allowanceResult);
            if (!allowanceTxHash) {
                setTxStep('idle');
                return;
            }

            // Step 2: openCase
            setSimulating(true);
            setTxStep('opening');

            const contract = getCaseEngineContract(senderAddress);
            const callResult = await contract.openCase(amount, seedBytes);

            if (callResult.revert) {
                throw new Error(callResult.revert);
            }

            const won = callResult.properties.won;
            const payout = (callResult.properties.payout as bigint) ?? 0n;
            setSimulating(false);
            const txHash = await send(callResult);

            if (txHash) {
                setLastResult({ won, payout, betAmount: amount });
                const entry: CaseResult = {
                    won,
                    payout,
                    txHash,
                    amount,
                    timestamp: Date.now(),
                };
                setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));

                if (!useCustomSeed) {
                    setUserSeed(generateUserSeed());
                }
            }
        } catch (err: unknown) {
            setSimulating(false);
            const msg = err instanceof Error ? err.message : 'Failed to open case';
            console.error(msg);
        }
        setTxStep('idle');
    }, [isConnected, senderAddress, walletAddress, useCustomSeed, customSeed, userSeed, betAmount, send, reset]);

    const isLoading = simulating || txState.loading;

    function getButtonLabel(): string {
        if (txStep === 'approving') return 'Step 1: Approving tokens...';
        if (txStep === 'opening') return 'Step 2: Opening case...';
        if (isLoading) return 'Opening...';
        return 'Open Case';
    }

    return (
        <main className="page">
            <div className="page__header">
                <h1 className="page__title">Open a Case</h1>
                <p className="page__subtitle">Wager $MOTO for a chance to win from the community LP pool</p>
            </div>

            {/* Rarity Tier Grid */}
            <div className="rarity-grid">
                {RARITY_TIERS.map(tier => (
                    <div key={tier.key} className={`rarity-card ${tier.colorClass}`}>
                        <span className={`rarity-card__multiplier`}>{tier.multiplier}</span>
                        <span className={`rarity-card__name`}>{tier.name}</span>
                        <span className="rarity-card__prob">{tier.probability}</span>
                    </div>
                ))}
            </div>

            {/* Pool stat + fairness badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {poolLoading ? (
                    <div className="stat-card" style={{ flex: 1 }}>
                        <SkeletonBlock lines={2} />
                    </div>
                ) : poolTotal !== null ? (
                    <div className="stat-card" style={{ flex: 1 }}>
                        <span className="stat-card__label">Pool Total</span>
                        <span className="stat-card__value tabular">{formatTokenAmount(poolTotal)} $MOTO</span>
                    </div>
                ) : null}
                <span className="fairness-badge">95% RTP — Provably Fair</span>
            </div>

            <div className="card">
                <h2 className="card__title">Bet Configuration</h2>

                <div className="form-group">
                    <label htmlFor="betAmount" className="form-label">Bet Amount ($MOTO)</label>
                    <input
                        id="betAmount"
                        type="text"
                        className="form-input"
                        value={betAmount}
                        onChange={(e): void => setBetAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                    {poolTotal !== null && (
                        <span className="form-hint">
                            Max bet: {formatTokenAmount(poolTotal / 100n)} $MOTO (1% of pool)
                        </span>
                    )}
                </div>

                <div className="form-group">
                    <div className="seed-header">
                        <label className="form-label">User Seed</label>
                        <label className="toggle">
                            <input
                                type="checkbox"
                                checked={useCustomSeed}
                                onChange={(e): void => setUseCustomSeed(e.target.checked)}
                                disabled={isLoading}
                            />
                            <span>Custom seed</span>
                        </label>
                    </div>

                    {useCustomSeed ? (
                        <>
                            <input
                                type="text"
                                className={`form-input form-input--mono ${seedError ? 'form-input--error' : ''}`}
                                value={customSeed}
                                onChange={handleCustomSeedChange}
                                placeholder="64 hex characters (32 bytes)"
                                disabled={isLoading}
                                maxLength={64}
                            />
                            {seedError && <span className="form-error">{seedError}</span>}
                        </>
                    ) : (
                        <div className="seed-display">
                            <code className="seed-value">{userSeed}</code>
                            <button
                                className="btn btn--ghost btn--sm"
                                onClick={regenerateSeed}
                                type="button"
                                disabled={isLoading}
                            >
                                Regenerate
                            </button>
                        </div>
                    )}
                    <span className="form-hint">
                        Mixed with block hash for fair RNG. Save your seed to verify the result.
                    </span>
                </div>

                {txStep !== 'idle' && (
                    <div className="step-indicator">
                        <div className={`step-indicator__step ${txStep === 'approving' ? 'step-indicator__step--active' : 'step-indicator__step--done'}`}>
                            <span className="step-indicator__number">1</span>
                            <span className="step-indicator__label">Approve tokens</span>
                        </div>
                        <div className="step-indicator__divider" />
                        <div className={`step-indicator__step ${txStep === 'opening' ? 'step-indicator__step--active' : ''}`}>
                            <span className="step-indicator__number">2</span>
                            <span className="step-indicator__label">Open case</span>
                        </div>
                    </div>
                )}

                {txState.error && (
                    <ErrorBanner message={txState.error} onDismiss={reset} />
                )}

                <button
                    className={`btn btn--open-case${isLoading ? ' btn--open-case--loading' : ''}`}
                    onClick={(): void => { void handleOpenCase(); }}
                    disabled={isLoading || !isConnected || !betAmount}
                    type="button"
                >
                    {getButtonLabel()}
                </button>

                {!isConnected && (
                    <p className="form-hint form-hint--center">Connect your wallet to open cases</p>
                )}
            </div>

            {lastResult !== null && (
                <div className={`result-reveal ${getResultClass(lastResult.won, lastResult.payout, lastResult.betAmount)}`}>
                    <span className="result-reveal__tier-label">
                        {getTierLabel(lastResult.won, lastResult.payout, lastResult.betAmount)}
                    </span>
                    <div className="result-reveal__label">
                        {getResultLabel(lastResult.won, lastResult.payout, lastResult.betAmount)}
                    </div>
                    <div className="result-reveal__payout">
                        Payout: {formatTokenAmount(lastResult.payout)} $MOTO
                    </div>
                    {txState.txHash && (
                        <ExplorerLinks txHash={txState.txHash} label="Case Transaction" />
                    )}
                </div>
            )}

            {history.length > 0 && (
                <div className="card">
                    <h2 className="card__title">Recent Cases</h2>
                    <div className="history-list">
                        {history.map((entry, i) => (
                            <div key={i} className={`history-item ${entry.won ? 'history-item--win' : 'history-item--loss'}`}>
                                <span className="history-item__result">
                                    {entry.won ? 'WIN' : 'MISS'}
                                </span>
                                <span className="history-item__amount tabular">
                                    Bet: {formatTokenAmount(entry.amount)} | Payout: {formatTokenAmount(entry.payout)} $MOTO
                                </span>
                                <div className="history-item__links">
                                    <ExplorerLinks txHash={entry.txHash} label="" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}
