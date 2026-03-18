import type { Address } from '@btc-vision/transaction';
import { useCallback, useState, useEffect } from 'react';
import { clearContractCache } from '../services/provider';

export interface WalletState {
    isConnected: boolean;
    walletAddress: string | null;
    senderAddress: Address | undefined;
    connect: () => void;
    disconnect: () => void;
}

// Dynamically detect OPWallet — gracefully returns disconnected state if unavailable
export function useWallet(): WalletState {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [senderAddress, setSenderAddress] = useState<Address | undefined>(undefined);

    // Try to use WalletConnect if available
    const [wcAvailable, setWcAvailable] = useState(false);
    const [wcHook, setWcHook] = useState<ReturnType<typeof import('@btc-vision/walletconnect').useWalletConnect> | null>(null);

    useEffect(() => {
        import('@btc-vision/walletconnect').then((mod) => {
            setWcAvailable(true);
            // Store the module for later use
            (window as unknown as Record<string, unknown>).__wcModule = mod;
        }).catch(() => {
            // WalletConnect not available
        });
    }, []);

    // If WalletConnect is loaded, try to use it via the provider
    // For now, provide a manual connect flow via OPWallet extension detection
    const isConnected = walletAddress !== null;

    const connect = useCallback((): void => {
        // Check for OPWallet extension
        const opnet = (window as unknown as Record<string, unknown>).opnet;
        if (opnet && typeof opnet === 'object') {
            // OPWallet detected — attempt connection
            const wallet = opnet as Record<string, unknown>;
            if (typeof wallet.requestAccounts === 'function') {
                (wallet.requestAccounts() as Promise<string[]>).then((accounts: string[]) => {
                    if (accounts.length > 0) {
                        setWalletAddress(accounts[0]);
                    }
                }).catch((err: unknown) => {
                    console.error('Wallet connect failed:', err);
                });
            }
        } else {
            alert('OPWallet extension not detected. Please install it from the OPNet website.');
        }
    }, []);

    const disconnect = useCallback((): void => {
        clearContractCache();
        setWalletAddress(null);
        setSenderAddress(undefined);
    }, []);

    return {
        isConnected,
        walletAddress,
        senderAddress,
        connect,
        disconnect,
    };
}
