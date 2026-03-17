import { useState, useCallback } from 'react';
import { networks } from '@btc-vision/bitcoin';
import type { CallResult } from 'opnet';
import type { TransactionParameters } from 'opnet';

const NETWORK = import.meta.env.VITE_NETWORK ?? 'testnet';
const MAX_SAT_TO_SPEND = 1_000_000n; // 0.01 BTC — generous upper bound

export interface TxState {
    loading: boolean;
    error: string | null;
    txHash: string | null;
}

export function useTransaction(walletAddress: string | null): {
    state: TxState;
    send: (callResult: CallResult) => Promise<string | null>;
    reset: () => void;
} {
    const [state, setState] = useState<TxState>({
        loading: false,
        error: null,
        txHash: null,
    });

    const send = useCallback(async (callResult: CallResult): Promise<string | null> => {
        if (!walletAddress) {
            setState({ loading: false, error: 'Wallet not connected', txHash: null });
            return null;
        }

        setState({ loading: true, error: null, txHash: null });
        try {
            const net = NETWORK !== 'mainnet' ? networks.opnetTestnet : networks.bitcoin;
            const params: TransactionParameters = {
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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Transaction failed';
            setState({ loading: false, error: msg, txHash: null });
            return null;
        }
    }, [walletAddress]);

    const reset = useCallback((): void => {
        setState({ loading: false, error: null, txHash: null });
    }, []);

    return { state, send, reset };
}
