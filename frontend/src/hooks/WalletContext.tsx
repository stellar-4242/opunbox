import React, { useCallback, useState, useEffect, useRef } from 'react';
import type { Address } from '@btc-vision/transaction';
import type { IOP20Contract } from 'opnet';
import { clearContractCache, providerService } from '../services/provider';
import { getMotoUsdPrice, formatMotoAsFiat } from '../services/price';
import { WalletContext } from './walletContextValue';
import type { WalletState } from './walletContextValue';

const MOTO_ADDRESS = import.meta.env.VITE_MOTO_TOKEN_ADDRESS ?? '';
const NETWORK = import.meta.env.VITE_NETWORK ?? 'testnet';

export function WalletProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [senderAddress, setSenderAddress] = useState<Address | undefined>(undefined);
    const [motoBalance, setMotoBalance] = useState<string | null>(null);
    const [motoFiat, setMotoFiat] = useState<string | null>(null);
    const balanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const isConnected = walletAddress !== null;

    const refreshBalances = useCallback((): void => {
        if (!walletAddress || !MOTO_ADDRESS) {
            setMotoBalance('--');
            return;
        }

        (async (): Promise<void> => {
            try {
                const { getContract, OP_20_ABI } = await import('opnet');
                const { networks } = await import('@btc-vision/bitcoin');

                const net = NETWORK === 'mainnet' ? networks.bitcoin : networks.opnetTestnet;
                const provider = providerService.getProvider(NETWORK);

                const resolvedAddr = await provider.getPublicKeyInfo(walletAddress, false);
                setSenderAddress(resolvedAddr);

                const motoContract = getContract(
                    MOTO_ADDRESS,
                    OP_20_ABI,
                    provider,
                    net,
) as unknown as IOP20Contract;

                const result = await motoContract.balanceOf(resolvedAddr as Address);
                const bal: bigint = (result.properties.balance as bigint) ?? 0n;
                const scale = 10n ** 18n;
                const whole = bal / scale;
                const frac = ((bal % scale) * 100n) / scale;
                const balStr = `${whole.toLocaleString()}.${frac.toString().padStart(2, '0')}`;
                setMotoBalance(balStr);

                // Fetch fiat price
                const priceUsd = await getMotoUsdPrice();
                const fiat = formatMotoAsFiat(balStr, priceUsd);
                setMotoFiat(fiat || null);
            } catch (err: unknown) {
                console.error('MOTO balance fetch failed:', err);
                setMotoBalance('--');
                setMotoFiat(null);
            }
        })();
    }, [walletAddress]);

    useEffect((): (() => void) => {
        if (isConnected) {
            refreshBalances();
            balanceInterval.current = setInterval(refreshBalances, 30000);
        }
        return (): void => {
            if (balanceInterval.current) {
                clearInterval(balanceInterval.current);
                balanceInterval.current = null;
            }
        };
    }, [isConnected, refreshBalances]);

    const connect = useCallback((): void => {
        const opnet = (window as unknown as Record<string, unknown>).opnet;
        if (opnet && typeof opnet === 'object') {
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
        setMotoBalance(null);
        setMotoFiat(null);
    }, []);

    const value: WalletState = {
        isConnected,
        walletAddress,
        senderAddress,
        motoBalance,
        motoFiat,
        connect,
        disconnect,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}
