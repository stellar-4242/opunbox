import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTransaction } from '../hooks/useTransaction';
import { getCaseEngineContract, getMotoTokenContract } from '../services/contracts';
import { ExplorerLinks } from '../components/ExplorerLinks';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonBlock } from '../components/SkeletonLoader';
import { generateUserSeed, validateHexSeed, hexToBytes32, parseTokenAmount, formatTokenAmount, } from '../utils/format';
const MAX_HISTORY = 10;
const CASE_ENGINE_ADDRESS = import.meta.env.VITE_CASE_ENGINE_ADDRESS;
export function CasePage() {
    const { isConnected, walletAddress, senderAddress } = useWallet();
    const { state: txState, send, reset } = useTransaction(walletAddress);
    const [betAmount, setBetAmount] = useState('');
    const [userSeed, setUserSeed] = useState(generateUserSeed());
    const [useCustomSeed, setUseCustomSeed] = useState(false);
    const [customSeed, setCustomSeed] = useState('');
    const [seedError, setSeedError] = useState('');
    const [simulating, setSimulating] = useState(false);
    const [txStep, setTxStep] = useState('idle');
    const [lastResult, setLastResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [poolTotal, setPoolTotal] = useState(null);
    const [poolLoading, setPoolLoading] = useState(false);
    useEffect(() => {
        setPoolLoading(true);
        void (async () => {
            try {
                const contract = getCaseEngineContract();
                const res = await contract.getPoolInfo();
                setPoolTotal(res.properties.totalDeposited);
            }
            catch {
                // Contract not configured or network error
            }
            finally {
                setPoolLoading(false);
            }
        })();
    }, []);
    const regenerateSeed = useCallback(() => {
        setUserSeed(generateUserSeed());
    }, []);
    const handleCustomSeedChange = useCallback((e) => {
        const val = e.target.value;
        setCustomSeed(val);
        if (val && !validateHexSeed(val)) {
            setSeedError('Seed must be 64 hex characters (32 bytes)');
        }
        else {
            setSeedError('');
        }
    }, []);
    const handleOpenCase = useCallback(async () => {
        if (!isConnected || !senderAddress || !walletAddress)
            return;
        if (!CASE_ENGINE_ADDRESS)
            return;
        const activeSeed = useCustomSeed ? customSeed : userSeed;
        if (useCustomSeed && !validateHexSeed(activeSeed)) {
            setSeedError('Seed must be 64 hex characters');
            return;
        }
        let amount;
        try {
            amount = parseTokenAmount(betAmount);
            if (amount <= 0n)
                return;
        }
        catch {
            return;
        }
        let seedBytes;
        try {
            seedBytes = hexToBytes32(activeSeed);
        }
        catch {
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
            setSimulating(false);
            const txHash = await send(callResult);
            if (txHash) {
                setLastResult({ won });
                const entry = {
                    won,
                    txHash,
                    amount,
                    timestamp: Date.now(),
                };
                setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
                if (!useCustomSeed) {
                    setUserSeed(generateUserSeed());
                }
            }
        }
        catch (err) {
            setSimulating(false);
            const msg = err instanceof Error ? err.message : 'Failed to open case';
            console.error(msg);
        }
        setTxStep('idle');
    }, [isConnected, senderAddress, walletAddress, useCustomSeed, customSeed, userSeed, betAmount, send, reset]);
    const isLoading = simulating || txState.loading;
    function getButtonLabel() {
        if (txStep === 'approving')
            return 'Step 1: Approving tokens...';
        if (txStep === 'opening')
            return 'Step 2: Opening case...';
        if (isLoading)
            return 'Opening...';
        return 'Open Case';
    }
    return (_jsxs("main", { className: "page", children: [_jsxs("div", { className: "page__header", children: [_jsx("h1", { className: "page__title", children: "Open a Case" }), _jsx("p", { className: "page__subtitle", children: "Wager $MOTO for a chance to win from the community LP pool" })] }), poolLoading ? (_jsx("div", { className: "stat-card", children: _jsx(SkeletonBlock, { lines: 2 }) })) : poolTotal !== null && (_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-card__label", children: "Pool Total" }), _jsxs("span", { className: "stat-card__value tabular", children: [formatTokenAmount(poolTotal), " $MOTO"] })] })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Bet Configuration" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "betAmount", className: "form-label", children: "Bet Amount ($MOTO)" }), _jsx("input", { id: "betAmount", type: "text", className: "form-input", value: betAmount, onChange: (e) => setBetAmount(e.target.value), placeholder: "0.00", disabled: isLoading }), poolTotal !== null && (_jsxs("span", { className: "form-hint", children: ["Max bet: ", formatTokenAmount(poolTotal / 100n), " $MOTO (1% of pool)"] }))] }), _jsxs("div", { className: "form-group", children: [_jsxs("div", { className: "seed-header", children: [_jsx("label", { className: "form-label", children: "User Seed" }), _jsxs("label", { className: "toggle", children: [_jsx("input", { type: "checkbox", checked: useCustomSeed, onChange: (e) => setUseCustomSeed(e.target.checked), disabled: isLoading }), _jsx("span", { children: "Custom seed" })] })] }), useCustomSeed ? (_jsxs(_Fragment, { children: [_jsx("input", { type: "text", className: `form-input form-input--mono ${seedError ? 'form-input--error' : ''}`, value: customSeed, onChange: handleCustomSeedChange, placeholder: "64 hex characters (32 bytes)", disabled: isLoading, maxLength: 64 }), seedError && _jsx("span", { className: "form-error", children: seedError })] })) : (_jsxs("div", { className: "seed-display", children: [_jsx("code", { className: "seed-value", children: userSeed }), _jsx("button", { className: "btn btn--ghost btn--sm", onClick: regenerateSeed, type: "button", disabled: isLoading, children: "Regenerate" })] })), _jsx("span", { className: "form-hint", children: "Mixed with block hash for fair RNG. Save your seed to verify the result." })] }), txStep !== 'idle' && (_jsxs("div", { className: "step-indicator", children: [_jsxs("div", { className: `step-indicator__step ${txStep === 'approving' ? 'step-indicator__step--active' : 'step-indicator__step--done'}`, children: [_jsx("span", { className: "step-indicator__number", children: "1" }), _jsx("span", { className: "step-indicator__label", children: "Approve tokens" })] }), _jsx("div", { className: `step-indicator__divider` }), _jsxs("div", { className: `step-indicator__step ${txStep === 'opening' ? 'step-indicator__step--active' : ''}`, children: [_jsx("span", { className: "step-indicator__number", children: "2" }), _jsx("span", { className: "step-indicator__label", children: "Open case" })] })] })), txState.error && (_jsx(ErrorBanner, { message: txState.error, onDismiss: reset })), _jsx("button", { className: "btn btn--primary btn--full", onClick: () => { void handleOpenCase(); }, disabled: isLoading || !isConnected || !betAmount, type: "button", children: getButtonLabel() }), !isConnected && (_jsx("p", { className: "form-hint form-hint--center", children: "Connect your wallet to open cases" }))] }), lastResult !== null && (_jsxs("div", { className: `result-reveal ${lastResult.won ? 'result-reveal--win' : 'result-reveal--loss'}`, children: [_jsx("div", { className: "result-reveal__label", children: lastResult.won ? 'WIN' : 'LOSS' }), txState.txHash && (_jsx(ExplorerLinks, { txHash: txState.txHash, label: "Case Transaction" }))] })), history.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("h2", { className: "card__title", children: "Recent Cases" }), _jsx("div", { className: "history-list", children: history.map((entry, i) => (_jsxs("div", { className: `history-item ${entry.won ? 'history-item--win' : 'history-item--loss'}`, children: [_jsx("span", { className: "history-item__result", children: entry.won ? 'WIN' : 'LOSS' }), _jsxs("span", { className: "history-item__amount tabular", children: [formatTokenAmount(entry.amount), " $MOTO"] }), _jsx("div", { className: "history-item__links", children: _jsx(ExplorerLinks, { txHash: entry.txHash, label: "" }) })] }, i))) })] }))] }));
}
