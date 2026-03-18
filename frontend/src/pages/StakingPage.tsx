import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getCASAStakingContract, getCasaTokenContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { parseTokenAmount, formatTokenAmount } from '../utils/format';

const CASA_STAKING_ADDRESS = import.meta.env.VITE_CASA_STAKING_ADDRESS as string | undefined;

interface StakeInfo {
    staked: bigint;
    pendingRewards: bigint;
}

const STAKING_TIERS = [
    { label: '7 days continuous', multiplier: '1.0x' },
    { label: '30 days continuous', multiplier: '1.3x' },
    { label: '90 days continuous', multiplier: '1.8x' },
];

export function StakingPage(): React.ReactElement {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);

    const [stakeAmount, setStakeAmount] = useState('');
    const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
    const [infoLoading, setInfoLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState<'stake' | 'claim' | 'unstake' | null>(null);
    const [txStep, setTxStep] = useState<'idle' | 'approving' | 'staking'>('idle');
    const [showUnstakeWarning, setShowUnstakeWarning] = useState(false);

    const loadInfo = useCallback(async (): Promise<void> => {
        if (!senderAddress) return;
        setInfoLoading(true);
        try {
            const contract = getCASAStakingContract(senderAddress);
            const [stakeRes, rewardsRes] = await Promise.all([
                contract.getStakeInfo(senderAddress),
                contract.getPendingRewards(senderAddress),
            ]);
            setStakeInfo({
                staked: stakeRes.properties.staked,
                pendingRewards: rewardsRes.properties.pending,
            });
        } catch {
            // silently fail
        } finally {
            setInfoLoading(false);
        }
    }, [senderAddress]);

    useEffect((): void => {
        void loadInfo();
    }, [loadInfo]);

    const handleStake = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        if (!CASA_STAKING_ADDRESS) return;

        let amount: bigint;
        try {
            amount = parseTokenAmount(stakeAmount);
            if (amount <= 0n) return;
        } catch {
            return;
        }

        reset();
        setSimulating(true);
        setActionType('stake');
        setTxStep('approving');

        try {
            // Step 1: increaseAllowance on CASA token for the CASAStaking contract
            const casaToken = getCasaTokenContract(senderAddress);
            const allowanceResult = await casaToken.increaseAllowance(CASA_STAKING_ADDRESS, amount);

            if (allowanceResult.revert) {
                throw new Error(`Allowance failed: ${allowanceResult.revert}`);
            }

            setSimulating(false);
            const allowanceTxHash = await send(allowanceResult);
            if (!allowanceTxHash) {
                setTxStep('idle');
                setActionType(null);
                return;
            }

            // Step 2: stake
            setSimulating(true);
            setTxStep('staking');

            const contract = getCASAStakingContract(senderAddress);
            const callResult = await contract.stake(amount);

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                setStakeAmount('');
                void loadInfo();
            }
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Stake failed');
        }
        setTxStep('idle');
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, stakeAmount, send, reset, loadInfo]);

    const handleClaimRewards = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        reset();
        setSimulating(true);
        setActionType('claim');

        try {
            const contract = getCASAStakingContract(senderAddress);
            const callResult = await contract.claimRewards();

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) void loadInfo();
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Claim failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadInfo]);

    const handleUnstake = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        setShowUnstakeWarning(false);
        reset();
        setSimulating(true);
        setActionType('unstake');

        try {
            const contract = getCASAStakingContract(senderAddress);
            const callResult = await contract.unstake();

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) void loadInfo();
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Unstake failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadInfo]);

    const isLoading = simulating || txState.loading;

    function getStakeButtonLabel(): string {
        if (txStep === 'approving') return 'Step 1: Approving tokens...';
        if (txStep === 'staking') return 'Step 2: Staking...';
        if (isLoading && actionType === 'stake') return 'Staking...';
        return 'Stake $CASA';
    }

    return (
        <main className="page">
            <div className="page__header">
                <h1 className="page__title">Stake $CASA</h1>
                <p className="page__subtitle">Stake $CASA to earn 30% of all house profits in $MOTO</p>
            </div>

            <div className="card">
                <h2 className="card__title">Staking Multipliers</h2>
                <div className="tier-grid">
                    {STAKING_TIERS.map(tier => (
                        <div key={tier.label} className="tier-card tier-card--info">
                            <span className="tier-card__duration">{tier.label}</span>
                            <span className="tier-card__multiplier">{tier.multiplier}</span>
                            <span className="tier-card__hint">$MOTO rewards weight</span>
                        </div>
                    ))}
                </div>
                <p className="form-hint">Unstaking resets your multiplier. You will have a 7-day warmup before earning rewards again.</p>
            </div>

            {senderAddress && (
                <div className="card card--position">
                    <h2 className="card__title">My Stake</h2>
                    {infoLoading ? (
                        <SkeletonBlock lines={3} />
                    ) : stakeInfo ? (
                        <div className="position-info">
                            <div className="position-row">
                                <span className="position-row__label">Staked $CASA</span>
                                <span className="position-row__value tabular">{formatTokenAmount(stakeInfo.staked)}</span>
                            </div>
                            <div className="position-row">
                                <span className="position-row__label">Pending $MOTO Rewards</span>
                                <span className="position-row__value tabular">{formatTokenAmount(stakeInfo.pendingRewards)}</span>
                            </div>
                        </div>
                    ) : null}

                    <div className="button-row">
                        <button
                            className="btn btn--secondary"
                            onClick={(): void => { void handleClaimRewards(); }}
                            disabled={isLoading || !stakeInfo || stakeInfo.pendingRewards === 0n}
                            type="button"
                        >
                            {isLoading && actionType === 'claim' ? 'Claiming...' : 'Claim Rewards'}
                        </button>
                        <button
                            className="btn btn--ghost btn--warn"
                            onClick={(): void => setShowUnstakeWarning(true)}
                            disabled={isLoading || !stakeInfo || stakeInfo.staked === 0n}
                            type="button"
                        >
                            Unstake
                        </button>
                    </div>

                    {txState.txHash && actionType === null && (
                        <ExplorerLinks txHash={txState.txHash} label="Transaction" />
                    )}
                </div>
            )}

            {showUnstakeWarning && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3 className="modal__title">Unstake Warning</h3>
                        <p className="modal__body">
                            Unstaking will reset your staking multiplier to 1.0x.
                            Any unclaimed $MOTO rewards will be delivered with your $CASA.
                        </p>
                        <div className="modal__actions">
                            <button
                                className="btn btn--ghost"
                                onClick={(): void => setShowUnstakeWarning(false)}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn--danger"
                                onClick={(): void => { void handleUnstake(); }}
                                type="button"
                            >
                                Confirm Unstake
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <h2 className="card__title">Stake $CASA</h2>

                <div className="form-group">
                    <label htmlFor="stakeAmount" className="form-label">Amount ($CASA)</label>
                    <input
                        id="stakeAmount"
                        type="text"
                        className="form-input"
                        value={stakeAmount}
                        onChange={(e): void => setStakeAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                </div>

                {txStep !== 'idle' && actionType === 'stake' && (
                    <div className="step-indicator">
                        <div className={`step-indicator__step ${txStep === 'approving' ? 'step-indicator__step--active' : 'step-indicator__step--done'}`}>
                            <span className="step-indicator__number">1</span>
                            <span className="step-indicator__label">Approve tokens</span>
                        </div>
                        <div className="step-indicator__divider" />
                        <div className={`step-indicator__step ${txStep === 'staking' ? 'step-indicator__step--active' : ''}`}>
                            <span className="step-indicator__number">2</span>
                            <span className="step-indicator__label">Stake</span>
                        </div>
                    </div>
                )}

                {txState.error && (
                    <ErrorBanner message={txState.error} onDismiss={reset} />
                )}

                <button
                    className="btn btn--primary btn--full"
                    onClick={(): void => { void handleStake(); }}
                    disabled={isLoading || !isConnected || !stakeAmount}
                    type="button"
                >
                    {getStakeButtonLabel()}
                </button>

                {!isConnected && (
                    <p className="form-hint form-hint--center">Connect your wallet to stake</p>
                )}
            </div>
        </main>
    );
}
