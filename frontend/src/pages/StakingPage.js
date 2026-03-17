import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getCASAStakingContract, getCasaTokenContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { parseTokenAmount, formatTokenAmount } from '../utils/format';
const CASA_STAKING_ADDRESS = import.meta.env.VITE_CASA_STAKING_ADDRESS;
const STAKING_TIERS = [
    { label: '7 days continuous', multiplier: '1.0x' },
    { label: '30 days continuous', multiplier: '1.3x' },
    { label: '90 days continuous', multiplier: '1.8x' },
];
export function StakingPage() {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);
    const [stakeAmount, setStakeAmount] = useState('');
    const [stakeInfo, setStakeInfo] = useState(null);
    const [infoLoading, setInfoLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState(null);
    const [txStep, setTxStep] = useState('idle');
    const [showUnstakeWarning, setShowUnstakeWarning] = useState(false);
    const loadInfo = useCallback(async () => {
        if (!senderAddress)
            return;
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
    const handleStake = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        if (!CASA_STAKING_ADDRESS)
            return;
        let amount;
        try {
            amount = parseTokenAmount(stakeAmount);
            if (amount <= 0n)
                return;
        }
        catch {
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
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                setStakeAmount('');
                void loadInfo();
            }
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Stake failed');
        }
        setTxStep('idle');
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, stakeAmount, send, reset, loadInfo]);
    const handleClaimRewards = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        reset();
        setSimulating(true);
        setActionType('claim');
        try {
            const contract = getCASAStakingContract(senderAddress);
            const callResult = await contract.claimRewards();
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
    const handleUnstake = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        setShowUnstakeWarning(false);
        reset();
        setSimulating(true);
        setActionType('unstake');
        try {
            const contract = getCASAStakingContract(senderAddress);
            const callResult = await contract.unstake();
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash)
                void loadInfo();
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Unstake failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadInfo]);
    const isLoading = simulating || txState.loading;
    function getStakeButtonLabel() {
        if (txStep === 'approving')
            return 'Step 1: Approving tokens...';
        if (txStep === 'staking')
            return 'Step 2: Staking...';
        if (isLoading && actionType === 'stake')
            return 'Staking...';
        return 'Stake $CASA';
    }
    return (_jsxs("main", { className: "page", children: [_jsxs("div", { className: "page__header", children: [_jsx("h1", { className: "page__title", children: "Stake $CASA" }), _jsx("p", { className: "page__subtitle", children: "Stake $CASA to earn 30% of all house profits in $MOTO" })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Staking Multipliers" }), _jsx("div", { className: "tier-grid", children: STAKING_TIERS.map(tier => (_jsxs("div", { className: "tier-card tier-card--info", children: [_jsx("span", { className: "tier-card__duration", children: tier.label }), _jsx("span", { className: "tier-card__multiplier", children: tier.multiplier }), _jsx("span", { className: "tier-card__hint", children: "$MOTO rewards weight" })] }, tier.label))) }), _jsx("p", { className: "form-hint", children: "Unstaking resets your multiplier to 1.0x" })] }), senderAddress && (_jsxs("div", { className: "card card--position", children: [_jsx("h2", { className: "card__title", children: "My Stake" }), infoLoading ? (_jsx(SkeletonBlock, { lines: 3 })) : stakeInfo ? (_jsxs("div", { className: "position-info", children: [_jsxs("div", { className: "position-row", children: [_jsx("span", { className: "position-row__label", children: "Staked $CASA" }), _jsx("span", { className: "position-row__value tabular", children: formatTokenAmount(stakeInfo.staked) })] }), _jsxs("div", { className: "position-row", children: [_jsx("span", { className: "position-row__label", children: "Pending $MOTO Rewards" }), _jsx("span", { className: "position-row__value tabular", children: formatTokenAmount(stakeInfo.pendingRewards) })] })] })) : null, _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "btn btn--secondary", onClick: () => { void handleClaimRewards(); }, disabled: isLoading || !stakeInfo || stakeInfo.pendingRewards === 0n, type: "button", children: isLoading && actionType === 'claim' ? 'Claiming...' : 'Claim Rewards' }), _jsx("button", { className: "btn btn--ghost btn--warn", onClick: () => setShowUnstakeWarning(true), disabled: isLoading || !stakeInfo || stakeInfo.staked === 0n, type: "button", children: "Unstake" })] }), txState.txHash && actionType === null && (_jsx(ExplorerLinks, { txHash: txState.txHash, label: "Transaction" }))] })), showUnstakeWarning && (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "modal", children: [_jsx("h3", { className: "modal__title", children: "Unstake Warning" }), _jsx("p", { className: "modal__body", children: "Unstaking will reset your staking multiplier to 1.0x. Any unclaimed $MOTO rewards will be delivered with your $CASA." }), _jsxs("div", { className: "modal__actions", children: [_jsx("button", { className: "btn btn--ghost", onClick: () => setShowUnstakeWarning(false), type: "button", children: "Cancel" }), _jsx("button", { className: "btn btn--danger", onClick: () => { void handleUnstake(); }, type: "button", children: "Confirm Unstake" })] })] }) })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Stake $CASA" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "stakeAmount", className: "form-label", children: "Amount ($CASA)" }), _jsx("input", { id: "stakeAmount", type: "text", className: "form-input", value: stakeAmount, onChange: (e) => setStakeAmount(e.target.value), placeholder: "0.00", disabled: isLoading })] }), txStep !== 'idle' && actionType === 'stake' && (_jsxs("div", { className: "step-indicator", children: [_jsxs("div", { className: `step-indicator__step ${txStep === 'approving' ? 'step-indicator__step--active' : 'step-indicator__step--done'}`, children: [_jsx("span", { className: "step-indicator__number", children: "1" }), _jsx("span", { className: "step-indicator__label", children: "Approve tokens" })] }), _jsx("div", { className: "step-indicator__divider" }), _jsxs("div", { className: `step-indicator__step ${txStep === 'staking' ? 'step-indicator__step--active' : ''}`, children: [_jsx("span", { className: "step-indicator__number", children: "2" }), _jsx("span", { className: "step-indicator__label", children: "Stake" })] })] })), txState.error && (_jsx(ErrorBanner, { message: txState.error, onDismiss: reset })), _jsx("button", { className: "btn btn--primary btn--full", onClick: () => { void handleStake(); }, disabled: isLoading || !isConnected || !stakeAmount, type: "button", children: getStakeButtonLabel() }), !isConnected && (_jsx("p", { className: "form-hint form-hint--center", children: "Connect your wallet to stake" }))] })] }));
}
