import React from 'react';
import { buildExplorerLinks } from '../utils/format';

interface ExplorerLinksProps {
    txHash: string;
    label?: string;
}

export function ExplorerLinks({ txHash, label = 'Transaction' }: ExplorerLinksProps): React.ReactElement {
    const network = import.meta.env.VITE_NETWORK ?? 'testnet';
    const { mempool, opscan } = buildExplorerLinks(txHash, network);

    return (
        <div className="explorer-links">
            {label && <span className="explorer-links__label">{label}</span>}
            <div className="explorer-links__buttons">
                <a
                    href={mempool}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                >
                    Mempool
                </a>
                <a
                    href={opscan}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                >
                    OPScan
                </a>
            </div>
        </div>
    );
}
