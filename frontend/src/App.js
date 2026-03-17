import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import { Nav } from './components/Nav';
import { CasePage } from './pages/CasePage';
import { LPPage } from './pages/LPPage';
import { StakingPage } from './pages/StakingPage';
import { PointsPage } from './pages/PointsPage';
import { StatsPage } from './pages/StatsPage';
export function App() {
    return (_jsx(WalletConnectProvider, { children: _jsx(BrowserRouter, { children: _jsxs("div", { className: "app", children: [_jsx(Nav, {}), _jsx("main", { className: "app__main", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(CasePage, {}) }), _jsx(Route, { path: "/lp", element: _jsx(LPPage, {}) }), _jsx(Route, { path: "/staking", element: _jsx(StakingPage, {}) }), _jsx(Route, { path: "/points", element: _jsx(PointsPage, {}) }), _jsx(Route, { path: "/stats", element: _jsx(StatsPage, {}) })] }) })] }) }) }));
}
