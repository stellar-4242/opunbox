import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getLPPoolContract, getMotoTokenContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { parseTokenAmount, formatTokenAmount } from '../utils/format';
import { LOCK_TIERS } from '../types/contracts';
const LP_POOL_ADDRESS = import.meta.env.VITE_LP_POOL_ADDRESS;
export function LPPage() {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);
    const [depositAmount, setDepositAmount] = useState('');
    const [selectedTier, setSelectedTier] = useState(0);
    const [poolStats, setPoolStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [actionType, setActionType] = useState(null);
    const [txStep, setTxStep] = useState('idle');
    const loadStats = useCallback(async () => {
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
        }
        catch {
            // silently fail
        }
        finally {
            setStatsLoading(false);
        }
    }, [senderAddress]);
    useEffect(() => {
        void loadStats();
    }, [loadStats]);
    const handleDeposit = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        if (!LP_POOL_ADDRESS)
            return;
        let amount;
        try {
            amount = parseTokenAmount(depositAmount);
            if (amount <= 0n)
                return;
        }
        catch {
            return;
        }
        reset();
        setSimulating(true);
        setActionType('deposit');
        setTxStep('approving');
        try {
            // Step 1: increaseAllowance on MOTO token for the LPPool
            const motoToken = getMotoTokenContract(senderAddress);
            const allowanceResult = await motoToken.increaseAllowance(LP_POOL_ADDRESS, amount);
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
            // Step 2: deposit
            setSimulating(true);
            setTxStep('depositing');
            const contract = getLPPoolContract(senderAddress);
            const callResult = await contract.deposit(amount, selectedTier);
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                setDepositAmount('');
                void loadStats();
            }
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Deposit failed');
        }
        setTxStep('idle');
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, depositAmount, selectedTier, send, reset, loadStats]);
    const handleWithdraw = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        reset();
        setSimulating(true);
        setActionType('withdraw');
        try {
            const contract = getLPPoolContract(senderAddress);
            const callResult = await contract.withdraw();
            if (callResult.revert)
                throw new Error(callResult.revert);
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                void loadStats();
            }
        }
        catch (err) {
            setSimulating(false);
            console.error(err instanceof Error ? err.message : 'Withdraw failed');
        }
        setActionType(null);
    }, [isConnected, senderAddress, walletAddress, send, reset, loadStats]);
    const isLoading = simulating || txState.loading;
    const reserveRatio = poolStats && poolStats.totalDeposited > 0n
        ? Number((poolStats.availableBalance * 100n) / poolStats.totalDeposited)
        : null;
    function getDepositButtonLabel() {
        if (txStep === 'approving')
            return 'Step 1: Approving tokens...';
        if (txStep === 'depositing')
            return 'Step 2: Depositing...';
        if (isLoading && actionType === 'deposit')
            return 'Depositing...';
        return 'Deposit';
    }
    return (_jsxs("main", { className: "page", children: [_jsxs("div", { className: "page__header", children: [_jsx("h1", { className: "page__title", children: "LP Pool" }), _jsx("p", { className: "page__subtitle", children: "Provide liquidity and earn $MOTO revenue and $CASA emissions" })] }), _jsx("div", { className: "stats-grid", children: statsLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) }), _jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) })] })) : poolStats && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Total Pool Size" }), _jsxs("span", { className: "stat-card__value tabular", children: [formatTokenAmount(poolStats.totalDeposited), " $MOTO"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Available Balance" }), _jsxs("span", { className: "stat-card__value tabular", children: [formatTokenAmount(poolStats.availableBalance), " $MOTO"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Reserve Ratio" }), _jsx("span", { className: `stat-card__value tabular ${reserveRatio !== null && reserveRatio < 20 ? 'stat-card__value--warn' : ''}`, children: reserveRatio !== null ? `${reserveRatio.toFixed(1)}%` : '--' })] })] })) }), senderAddress && poolStats && poolStats.myDeposit > 0n && (_jsxs("div", { className: "card card--position", children: [_jsx("h2", { className: "card__title", children: "My Position" }), _jsx("div", { className: "position-info", children: _jsxs("div", { className: "position-row", children: [_jsx("span", { className: "position-row__label", children: "Deposited" }), _jsxs("span", { className: "position-row__value tabular", children: [formatTokenAmount(poolStats.myDeposit), " $MOTO"] })] }) }), _jsx("button", { className: "btn btn--secondary btn--full", onClick: () => { void handleWithdraw(); }, disabled: isLoading, type: "button", children: isLoading && actionType === 'withdraw' ? 'Withdrawing...' : 'Withdraw' }), txState.txHash && actionType === null && (_jsx(ExplorerLinks, { txHash: txState.txHash, label: "Withdrawal" }))] })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Deposit" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "depositAmount", className: "form-label", children: "Amount ($MOTO)" }), _jsx("input", { id: "depositAmount", type: "text", className: "form-input", value: depositAmount, onChange: (e) => setDepositAmount(e.target.value), placeholder: "0.00", disabled: isLoading })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Lock Tier" }), _jsx("div", { className: "tier-grid", children: LOCK_TIERS.map(tier => (_jsxs("button", { type: "button", className: `tier-card ${selectedTier === tier.tier ? 'tier-card--selected' : ''}`, onClick: () => setSelectedTier(tier.tier), disabled: isLoading, children: [_jsx("span", { className: "tier-card__duration", children: tier.label }), _jsx("span", { className: "tier-card__multiplier", children: tier.multiplier }), _jsx("span", { className: "tier-card__hint", children: "revenue share" })] }, tier.tier))) })] }), txStep !== 'idle' && actionType === 'deposit' && (_jsxs("div", { className: "step-indicator", children: [_jsxs("div", { className: `step-indicator__step ${txStep === 'approving' ? 'step-indicator__step--active' : 'step-indicator__step--done'}`, children: [_jsx("span", { className: "step-indicator__number", children: "1" }), _jsx("span", { className: "step-indicator__label", children: "Approve tokens" })] }), _jsx("div", { className: "step-indicator__divider" }), _jsxs("div", { className: `step-indicator__step ${txStep === 'depositing' ? 'step-indicator__step--active' : ''}`, children: [_jsx("span", { className: "step-indicator__number", children: "2" }), _jsx("span", { className: "step-indicator__label", children: "Deposit" })] })] })), txState.error && (_jsx(ErrorBanner, { message: txState.error, onDismiss: reset })), _jsx("button", { className: "btn btn--primary btn--full", onClick: () => { void handleDeposit(); }, disabled: isLoading || !isConnected || !depositAmount, type: "button", children: getDepositButtonLabel() }), txState.txHash && actionType === null && (_jsx(ExplorerLinks, { txHash: txState.txHash, label: "Deposit" })), !isConnected && (_jsx("p", { className: "form-hint form-hint--center", children: "Connect your wallet to deposit" }))] }), _jsxs("div", { className: "info-card", children: [_jsx("h3", { className: "info-card__title", children: "Revenue Split" }), _jsx("div", { className: "split-viz", children: _jsxs("div", { className: "split-bar", children: [_jsx("div", { className: "split-bar__segment split-bar__segment--lp", style: { width: '60%' }, children: _jsx("span", { children: "60% LP" }) }), _jsx("div", { className: "split-bar__segment split-bar__segment--staking", style: { width: '30%' }, children: _jsx("span", { children: "30% Stakers" }) }), _jsx("div", { className: "split-bar__segment split-bar__segment--treasury", style: { width: '10%' }, children: _jsx("span", { children: "10%" }) })] }) })] })] }));
}
