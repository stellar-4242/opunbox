import { createContext, useContext } from 'react';
import type { Address } from '@btc-vision/transaction';

export interface WalletState {
    isConnected: boolean;
    walletAddress: string | null;
    senderAddress: Address | undefined;
    motoBalance: string | null;
    motoFiat: string | null;
    connect: () => void;
    disconnect: () => void;
}

const defaultState: WalletState = {
    isConnected: false,
    walletAddress: null,
    senderAddress: undefined,
    motoBalance: null,
    motoFiat: null,
    connect: (): void => {},
    disconnect: (): void => {},
};

export const WalletContext = createContext<WalletState>(defaultState);

export function useWalletContext(): WalletState {
    return useContext(WalletContext);
}
