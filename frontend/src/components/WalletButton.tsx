import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { formatAddress } from '../utils/format';

export function WalletButton(): React.ReactElement {
    const { isConnected, walletAddress, motoBalance, motoFiat, connect, disconnect } = useWallet();

    if (isConnected && walletAddress) {
        return (
            <div className="wallet-connected">
                {motoBalance !== null && (
                    <span className="wallet-balance">
                        {motoBalance} $MOTO{motoFiat ? ` (${motoFiat})` : ''}
                    </span>
                )}
                <span className="wallet-address">{formatAddress(walletAddress)}</span>
                <button
                    className="btn btn--ghost btn--sm"
                    onClick={disconnect}
                    type="button"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            className="btn btn--primary"
            onClick={connect}
            type="button"
        >
            Connect Wallet
        </button>
    );
}
