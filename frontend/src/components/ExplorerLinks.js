import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { buildExplorerLinks } from '../utils/format';
export function ExplorerLinks({ txHash, label = 'Transaction' }) {
    const network = import.meta.env.VITE_NETWORK ?? 'testnet';
    const { mempool, opscan } = buildExplorerLinks(txHash, network);
    return (_jsxs("div", { className: "explorer-links", children: [label && _jsx("span", { className: "explorer-links__label", children: label }), _jsxs("div", { className: "explorer-links__buttons", children: [_jsx("a", { href: mempool, target: "_blank", rel: "noopener noreferrer", className: "explorer-link", children: "Mempool" }), _jsx("a", { href: opscan, target: "_blank", rel: "noopener noreferrer", className: "explorer-link", children: "OPScan" })] })] }));
}
