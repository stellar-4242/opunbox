import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { Address } from '@btc-vision/transaction';
import { useCallback } from 'react';
import { clearContractCache } from '../services/provider';

export interface WalletState {
    isConnected: boolean;
    walletAddress: string | null;
    senderAddress: Address | undefined;
    connect: () => void;
    disconnect: () => void;
}

export function useWallet(): WalletState {
    const {
        walletAddress,
        address,
        connectToWallet,
        disconnect: wcDisconnect,
    } = useWalletConnect();

    const isConnected = walletAddress !== null;

    // `address` in walletconnect context is already `Address | null`
    const senderAddress: Address | undefined = address ?? undefined;

    const connect = useCallback((): void => {
        connectToWallet(SupportedWallets.OP_WALLET);
    }, [connectToWallet]);

    const disconnect = useCallback((): void => {
        clearContractCache();
        wcDisconnect();
    }, [wcDisconnect]);

    return {
        isConnected,
        walletAddress,
        senderAddress,
        connect,
        disconnect,
    };
}
