import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWallet } from '../hooks/useWallet';
import { formatAddress } from '../utils/format';
export function WalletButton() {
    const { isConnected, walletAddress, connect, disconnect } = useWallet();
    if (isConnected && walletAddress) {
        return (_jsxs("div", { className: "wallet-connected", children: [_jsx("span", { className: "wallet-address", children: formatAddress(walletAddress) }), _jsx("button", { className: "btn btn--ghost btn--sm", onClick: disconnect, type: "button", children: "Disconnect" })] }));
    }
    return (_jsx("button", { className: "btn btn--primary", onClick: connect, type: "button", children: "Connect Wallet" }));
}
