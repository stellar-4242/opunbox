import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getLPPoolContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { parseTokenAmount, formatTokenAmount } from '../utils/format';
import { LOCK_TIERS } from '../types/contracts';
import type { LockTier } from '../types/contracts';

interface PoolStats {
    totalDeposited: bigint;
    availableBalance: bigint;
    myDeposit: bigint;
    isAboveMinimum: boolean;
}

export function LPPage(): React.ReactElement {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);

    const [depositAmount, setDepositAmount] = useState('');
    const [selectedTier, setSelectedTier] = useState<LockTier>(0);
    const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState<'deposit' | 'withdraw' | null>(null);

    const loadStats = useCallback(async (): Promise<void> => {
        setStatsLoading(true);
        try {
            const contract = getLPPoolContract(senderAddress);
            const [totalRes, availRes, minRes] = await Promise.all([
                contract.getTotalDeposited(),
                contract.getAvailableBalance(),
                contract.isAboveMinimum(),
            ]);

            let myDeposit = 0n;
            if (senderAddress) {
                const depRes = await contract.getDepositInfo(senderAddress);
                myDeposit = depRes.properties.amount;
            }

            setPoolStats({
                totalDeposited: totalRes.properties.total,
                availableBalance: availRes.properties.available,
                myDeposit,
                isAboveMinimum: minRes.properties.above,
            });
        } catch {
            // silently fail
        } finally {
            setStatsLoading(false);
        }
    }, [senderAddress]);

    useEffect((): void => {
        void loadStats();
    }, [loadStats]);

    const handleDeposit = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        let amount: bigint;
        try {
            amount = parseTokenAmount(depositAmount);
            if (amount <= 0n) return;
        } catch {
            return;
        }

        reset();
        setSimulating(true);
        setActionType('deposit');

        try {
            const contract = getLPPoolContract(senderAddress);
            const callResult = await contract.deposit(amount, selectedTier);

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                setDepositAmount('');
                void loadStats();
            }
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Deposit failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, depositAmount, selectedTier, send, reset, loadStats]);

    const handleWithdraw = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        reset();
        setSimulating(true);
        setActionType('withdraw');

        try {
            const contract = getLPPoolContract(senderAddress);
            const callResult = await contract.withdraw();

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                void loadStats();
            }
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Withdraw failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadStats]);

    const isLoading = simulating || txState.loading;
    const reserveRatio = poolStats && poolStats.totalDeposited > 0n
        ? Number((poolStats.availableBalance * 100n) / poolStats.totalDeposited)
        : null;

    return (
        <main className="page">
            <div className="page__header">
                <h1 className="page__title">LP Pool</h1>
                <p className="page__subtitle">Provide liquidity and earn $MOTO revenue and $CASA emissions</p>
            </div>

            <div className="stats-grid">
                {statsLoading ? (
                    <>
                        <div className="stat-card"><SkeletonBlock lines={2} /></div>
                        <div className="stat-card"><SkeletonBlock lines={2} /></div>
                        <div className="stat-card"><SkeletonBlock lines={2} /></div>
                    </>
                ) : poolStats && (
                    <>
                        <div className="stat-card">
                            <span className="stat-card__label">Total Pool Size</span>
                            <span className="stat-card__value tabular">{formatTokenAmount(poolStats.totalDeposited)} $MOTO</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-card__label">Available Balance</span>
                            <span className="stat-card__value tabular">{formatTokenAmount(poolStats.availableBalance)} $MOTO</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-card__label">Reserve Ratio</span>
                            <span className={`stat-card__value tabular ${reserveRatio !== null && reserveRatio < 20 ? 'stat-card__value--warn' : ''}`}>
                                {reserveRatio !== null ? `${reserveRatio.toFixed(1)}%` : '--'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {senderAddress && poolStats && poolStats.myDeposit > 0n && (
                <div className="card card--position">
                    <h2 className="card__title">My Position</h2>
                    <div className="position-info">
                        <div className="position-row">
                            <span className="position-row__label">Deposited</span>
                            <span className="position-row__value tabular">{formatTokenAmount(poolStats.myDeposit)} $MOTO</span>
                        </div>
                    </div>
                    <button
                        className="btn btn--secondary btn--full"
                        onClick={(): void => { void handleWithdraw(); }}
                        disabled={isLoading}
                        type="button"
                    >
                        {isLoading && actionType === 'withdraw' ? 'Withdrawing...' : 'Withdraw'}
                    </button>
                    {txState.txHash && actionType === null && (
                        <ExplorerLinks txHash={txState.txHash} label="Withdrawal" />
                    )}
                </div>
            )}

            <div className="card">
                <h2 className="card__title">Deposit</h2>

                <div className="form-group">
                    <label htmlFor="depositAmount" className="form-label">Amount ($MOTO)</label>
                    <input
                        id="depositAmount"
                        type="text"
                        className="form-input"
                        value={depositAmount}
                        onChange={(e): void => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Lock Tier</label>
                    <div className="tier-grid">
                        {LOCK_TIERS.map(tier => (
                            <button
                                key={tier.tier}
                                type="button"
                                className={`tier-card ${selectedTier === tier.tier ? 'tier-card--selected' : ''}`}
                                onClick={(): void => setSelectedTier(tier.tier)}
                                disabled={isLoading}
                            >
                                <span className="tier-card__duration">{tier.label}</span>
                                <span className="tier-card__multiplier">{tier.multiplier}</span>
                                <span className="tier-card__hint">revenue share</span>
                            </button>
                        ))}
                    </div>
                </div>

                {txState.error && (
                    <ErrorBanner message={txState.error} onDismiss={reset} />
                )}

                <button
                    className="btn btn--primary btn--full"
                    onClick={(): void => { void handleDeposit(); }}
                    disabled={isLoading || !isConnected || !depositAmount}
                    type="button"
                >
                    {isLoading && actionType === 'deposit' ? 'Depositing...' : 'Deposit'}
                </button>

                {txState.txHash && actionType === null && (
                    <ExplorerLinks txHash={txState.txHash} label="Deposit" />
                )}

                {!isConnected && (
                    <p className="form-hint form-hint--center">Connect your wallet to deposit</p>
                )}
            </div>

            <div className="info-card">
                <h3 className="info-card__title">Revenue Split</h3>
                <div className="split-viz">
                    <div className="split-bar">
                        <div className="split-bar__segment split-bar__segment--lp" style={{ width: '60%' }}>
                            <span>60% LP</span>
                        </div>
                        <div className="split-bar__segment split-bar__segment--staking" style={{ width: '30%' }}>
                            <span>30% Stakers</span>
                        </div>
                        <div className="split-bar__segment split-bar__segment--treasury" style={{ width: '10%' }}>
                            <span>10%</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
