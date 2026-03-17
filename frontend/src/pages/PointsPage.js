import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getPointsContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { formatTokenAmount } from '../utils/format';
export function PointsPage() {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);
    const [pointsInfo, setPointsInfo] = useState(null);
    const [infoLoading, setInfoLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState(null);
    const [referralLink, setReferralLink] = useState('');
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (walletAddress) {
            const base = window.location.origin + window.location.pathname;
            setReferralLink(`${base}?ref=${walletAddress}`);
        }
    }, [walletAddress]);
    const loadInfo = useCallback(async () => {
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
        }
        catch {
            // silently fail
        }
        finally {
            setInfoLoading(false);
        }
    }, [senderAddress]);
    useEffect(() => {
        void loadInfo();
    }, [loadInfo]);
    const handleClaimAirdrop = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        reset();
        setSimulating(true);
        setActionType('claim');
        try {
            const contract = getPointsContract(senderAddress);
            const callResult = await contract.claimAirdrop();
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash)
                void loadInfo();
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Claim failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadInfo]);
    const handleTriggerAirdrop = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        reset();
        setSimulating(true);
        setActionType('trigger');
        try {
            const contract = getPointsContract(senderAddress);
            const callResult = await contract.triggerAirdrop();
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            await send(callResult);
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Trigger failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset]);
    const handleCopyReferral = useCallback(() => {
        void navigator.clipboard.writeText(referralLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [referralLink]);
    const isLoading = simulating || txState.loading;
    const sharePercent = pointsInfo && pointsInfo.totalPoints > 0n
        ? Number((pointsInfo.myPoints * 10000n) / pointsInfo.totalPoints) / 100
        : 0;
    return (_jsxs("main", { className: "page", children: [_jsxs("div", { className: "page__header", children: [_jsx("h1", { className: "page__title", children: "Points and Airdrop" }), _jsx("p", { className: "page__subtitle", children: "Earn points by wagering and providing liquidity, then claim your $CASA airdrop" })] }), _jsx("div", { className: "stats-grid", children: infoLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) })] })) : pointsInfo ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "My Points" }), _jsx("span", { className: "stat-card__value tabular", children: formatTokenAmount(pointsInfo.myPoints, 0) })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Total Points" }), _jsx("span", { className: "stat-card__value tabular", children: formatTokenAmount(pointsInfo.totalPoints, 0) })] }), senderAddress && (_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "My Share" }), _jsxs("span", { className: "stat-card__value tabular", children: [sharePercent.toFixed(4), "%"] })] }))] })) : null }), isConnected && referralLink && (_jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Referral Link" }), _jsx("p", { className: "form-hint", children: "Share this link to earn a percentage of your referrals points" }), _jsxs("div", { className: "referral-row", children: [_jsx("input", { type: "text", className: "form-input form-input--mono", value: referralLink, readOnly: true }), _jsx("button", { className: "btn btn--secondary", onClick: handleCopyReferral, type: "button", children: copied ? 'Copied' : 'Copy' })] })] })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Airdrop Claim" }), _jsx("p", { className: "form-hint", children: "When the airdrop is triggered, your allocation equals your share of the total points. The airdrop is permissionless and anyone can trigger it once conditions are met." }), txState.error && (_jsx(ErrorBanner, { message: txState.error, onDismiss: reset })), _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "btn btn--primary", onClick: () => { void handleClaimAirdrop(); }, disabled: isLoading || !isConnected, type: "button", children: isLoading && actionType === 'claim' ? 'Claiming...' : 'Claim Airdrop' }), _jsx("button", { className: "btn btn--ghost", onClick: () => { void handleTriggerAirdrop(); }, disabled: isLoading || !isConnected, type: "button", children: isLoading && actionType === 'trigger' ? 'Triggering...' : 'Trigger Airdrop' })] }), txState.txHash && actionType === null && (_jsx(ExplorerLinks, { txHash: txState.txHash, label: "Transaction" })), !isConnected && (_jsx("p", { className: "form-hint form-hint--center", children: "Connect your wallet to claim" }))] }), _jsxs("div", { className: "info-card", children: [_jsx("h3", { className: "info-card__title", children: "How to Earn Points" }), _jsxs("ul", { className: "info-list", children: [_jsx("li", { children: "Wager $MOTO by opening cases" }), _jsx("li", { children: "Deposit into the LP pool (points per block locked)" }), _jsx("li", { children: "Refer others to earn a share of their points" })] })] })] }));
}
