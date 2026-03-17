import { useState, useCallback } from 'react';
import { networks } from '@btc-vision/bitcoin';
const NETWORK = import.meta.env.VITE_NETWORK ?? 'testnet';
const MAX_SAT_TO_SPEND = 1000000n; // 0.01 BTC — generous upper bound
export function useTransaction(walletAddress) {
    const [state, setState] = useState({
        loading: false,
        error: null,
        txHash: null,
    });
    const send = useCallback(async (callResult) => {
        if (!walletAddress) {
            setState({ loading: false, error: 'Wallet not connected', txHash: null });
            return null;
        }
        setState({ loading: true, error: null, txHash: null });
        try {
            const net = NETWORK !== 'mainnet' ? networks.opnetTestnet : networks.bitcoin;
            const params = {
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress,
                maximumAllowedSatToSpend: MAX_SAT_TO_SPEND,
                network: net,
            };
            const receipt = await callResult.sendTransaction(params);
            const txHash = receipt.transactionId;
            setState({ loading: false, error: null, txHash });
            return txHash;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Transaction failed';
            setState({ loading: false, error: msg, txHash: null });
            return null;
        }
    }, [walletAddress]);
    const reset = useCallback(() => {
        setState({ loading: false, error: null, txHash: null });
    }, []);
    return { state, send, reset };
}
