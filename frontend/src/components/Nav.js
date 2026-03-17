import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { WalletButton } from './WalletButton';
const NAV_LINKS = [
    { to: '/', label: 'Cases', end: true },
    { to: '/lp', label: 'Liquidity' },
    { to: '/staking', label: 'Staking' },
    { to: '/points', label: 'Points' },
    { to: '/stats', label: 'Stats' },
];
export function Nav() {
    return (_jsx("nav", { className: "nav", children: _jsxs("div", { className: "nav__inner", children: [_jsxs("div", { className: "nav__brand", children: [_jsx("span", { className: "nav__logo", children: "MOTO" }), _jsx("span", { className: "nav__subtitle", children: "Casino" })] }), _jsx("ul", { className: "nav__links", children: NAV_LINKS.map(({ to, label, end }) => (_jsx("li", { children: _jsx(NavLink, { to: to, end: end, className: ({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`, children: label }) }, to))) }), _jsx(WalletButton, {})] }) }));
}
