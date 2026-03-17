import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { formatAddress } from '../utils/format';

export function WalletButton(): React.ReactElement {
    const { isConnected, walletAddress, connect, disconnect } = useWallet();

    if (isConnected && walletAddress) {
        return (
            <div className="wallet-connected">
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
