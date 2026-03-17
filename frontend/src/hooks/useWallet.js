import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { useCallback } from 'react';
import { clearContractCache } from '../services/provider';
export function useWallet() {
    const { walletAddress, address, connectToWallet, disconnect: wcDisconnect, } = useWalletConnect();
    const isConnected = walletAddress !== null;
    // `address` in walletconnect context is already `Address | null`
    const senderAddress = address ?? undefined;
    const connect = useCallback(() => {
        connectToWallet(SupportedWallets.OP_WALLET);
    }, [connectToWallet]);
    const disconnect = useCallback(() => {
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
