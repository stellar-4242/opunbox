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
    const [lastResult, setLastResult] = useState<{ won: boolean; payout: bigint } | null>(null);
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
                setLastResult({ won, payout });
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

            {poolLoading ? (
                <div className="stat-card">
                    <SkeletonBlock lines={2} />
                </div>
            ) : poolTotal !== null && (
                <div className="stat-card">
                    <span className="stat-card__label">Pool Total</span>
                    <span className="stat-card__value tabular">{formatTokenAmount(poolTotal)} $MOTO</span>
                </div>
            )}

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
                        <div className={`step-indicator__divider`} />
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
                    className="btn btn--primary btn--full"
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
                <div className={`result-reveal ${lastResult.won ? 'result-reveal--win' : 'result-reveal--loss'}`}>
                    <div className="result-reveal__label">
                        {lastResult.won ? 'WIN' : 'LOSS'}
                    </div>
                    <div className="result-reveal__payout">
                        Payout: {formatTokenAmount(lastResult.payout)} MOTO
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
                                    {entry.won ? 'WIN' : 'LOSS'}
                                </span>
                                <span className="history-item__amount tabular">
                                    Bet: {formatTokenAmount(entry.amount)} → Payout: {formatTokenAmount(entry.payout)} $MOTO
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
