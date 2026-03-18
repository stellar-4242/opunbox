import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getPointsContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { formatTokenAmount } from '../utils/format';

interface PointsInfo {
    myPoints: bigint;
    totalPoints: bigint;
}

export function PointsPage(): React.ReactElement {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);

    const [pointsInfo, setPointsInfo] = useState<PointsInfo | null>(null);
    const [infoLoading, setInfoLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState<'claim' | 'trigger' | null>(null);
    const [referralLink, setReferralLink] = useState('');
    const [copied, setCopied] = useState(false);

    const [referrerRegistered, setReferrerRegistered] = useState(false);

    useEffect((): void => {
        if (walletAddress) {
            const base = window.location.origin + window.location.pathname;
            setReferralLink(`${base}?ref=${walletAddress}`);
        }
    }, [walletAddress]);

    // Register referrer from URL param (?ref=ADDRESS) on first connect
    useEffect((): void => {
        if (!isConnected || !senderAddress || referrerRegistered) return;
        const params = new URLSearchParams(window.location.search);
        const refAddress = params.get('ref');
        if (!refAddress || refAddress === walletAddress) return;

        setReferrerRegistered(true);
        const contract = getPointsContract(senderAddress);
        void contract.setReferrer(refAddress).then((callResult) => {
            if (callResult.revert) return; // already set or invalid — silently skip
            void send(callResult).catch(() => { /* user rejected or tx failed */ });
        }).catch(() => { /* contract call failed */ });
    }, [isConnected, senderAddress, walletAddress, referrerRegistered, send]);

    const loadInfo = useCallback(async (): Promise<void> => {
        setInfoLoading(true);
        try {
            const contract = getPointsContract(senderAddress);
            const totalRes = await contract.totalPoints();
            let myPoints = 0n;
            if (senderAddress) {
                const myRes = await contract.getPoints(senderAddress);
                myPoints = myRes.properties.points;
            }

            setPointsInfo({
                myPoints,
                totalPoints: totalRes.properties.total,
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

    const handleClaimAirdrop = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        reset();
        setSimulating(true);
        setActionType('claim');

        try {
            const contract = getPointsContract(senderAddress);
            const callResult = await contract.claimAirdrop();

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

    const handleTriggerAirdrop = useCallback(async (): Promise<void> => {
        if (!isConnected || !senderAddress || !walletAddress) return;
        reset();
        setSimulating(true);
        setActionType('trigger');

        try {
            const contract = getPointsContract(senderAddress);
            const callResult = await contract.triggerAirdrop();

            if (callResult.revert) throw new Error(callResult.revert);

            setSimulating(false);
            await send(callResult);
        } catch (err: unknown) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Trigger failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset]);

    const handleCopyReferral = useCallback((): void => {
        void navigator.clipboard.writeText(referralLink).then((): void => {
            setCopied(true);
            setTimeout((): void => setCopied(false), 2000);
        });
    }, [referralLink]);

    const isLoading = simulating || txState.loading;
    const sharePercent = pointsInfo && pointsInfo.totalPoints > 0n
        ? Number((pointsInfo.myPoints * 10000n) / pointsInfo.totalPoints) / 100
        : 0;

    return (
        <main className="page">
            <div className="page__header">
                <h1 className="page__title">Points and Airdrop</h1>
                <p className="page__subtitle">Earn points by wagering and providing liquidity, then claim your $CASA airdrop</p>
            </div>

            <div className="stats-grid">
                {infoLoading ? (
                    <>
                        <div className="stat-card"><SkeletonBlock lines={2} /></div>
                        <div className="stat-card"><SkeletonBlock lines={2} /></div>
                    </>
                ) : pointsInfo ? (
                    <>
                        <div className="stat-card">
                            <span className="stat-card__label">My Points</span>
                            <span className="stat-card__value tabular">{formatTokenAmount(pointsInfo.myPoints, 0)}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-card__label">Total Points</span>
                            <span className="stat-card__value tabular">{formatTokenAmount(pointsInfo.totalPoints, 0)}</span>
                        </div>
                        {senderAddress && (
                            <div className="stat-card">
                                <span className="stat-card__label">My Share</span>
                                <span className="stat-card__value tabular">{sharePercent.toFixed(4)}%</span>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {isConnected && referralLink && (
                <div className="card">
                    <h2 className="card__title">Referral Link</h2>
                    <p className="form-hint">Share this link to earn a percentage of your referrals points</p>
                    <div className="referral-row">
                        <input
                            type="text"
                            className="form-input form-input--mono"
                            value={referralLink}
                            readOnly
                        />
                        <button
                            className="btn btn--secondary"
                            onClick={handleCopyReferral}
                            type="button"
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}

            <div className="card">
                <h2 className="card__title">Airdrop Claim</h2>
                <p className="form-hint">
                    When the airdrop is triggered, your allocation equals your share of the total points.
                    The airdrop is permissionless and anyone can trigger it once conditions are met.
                </p>

                {txState.error && (
                    <ErrorBanner message={txState.error} onDismiss={reset} />
                )}

                <div className="button-row">
                    <button
                        className="btn btn--primary"
                        onClick={(): void => { void handleClaimAirdrop(); }}
                        disabled={isLoading || !isConnected}
                        type="button"
                    >
                        {isLoading && actionType === 'claim' ? 'Claiming...' : 'Claim Airdrop'}
                    </button>
                    <button
                        className="btn btn--ghost"
                        onClick={(): void => { void handleTriggerAirdrop(); }}
                        disabled={isLoading || !isConnected}
                        type="button"
                    >
                        {isLoading && actionType === 'trigger' ? 'Triggering...' : 'Trigger Airdrop'}
                    </button>
                </div>

                {txState.txHash && actionType === null && (
                    <ExplorerLinks txHash={txState.txHash} label="Transaction" />
                )}

                {!isConnected && (
                    <p className="form-hint form-hint--center">Connect your wallet to claim</p>
                )}
            </div>

            <div className="info-card">
                <h3 className="info-card__title">How to Earn Points</h3>
                <ul className="info-list">
                    <li>Wager $MOTO by opening cases</li>
                    <li>Deposit into the LP pool (points per block locked)</li>
                    <li>Refer others to earn a share of their points</li>
                </ul>
            </div>
        </main>
    );
}
