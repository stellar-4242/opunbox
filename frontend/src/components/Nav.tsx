import React from 'react';
import { NavLink } from 'react-router-dom';
import { WalletButton } from './WalletButton';

const NAV_LINKS = [
    { to: '/', label: 'Cases', end: true },
    { to: '/lp', label: 'Liquidity' },
    { to: '/staking', label: 'Staking' },
    { to: '/points', label: 'Points' },
    { to: '/stats', label: 'Stats' },
];

export function Nav(): React.ReactElement {
    return (
        <nav className="nav">
            <div className="nav__inner">
                <div className="nav__brand">
                    <span className="nav__logo">MOTO</span>
                    <span className="nav__subtitle">Casino</span>
                </div>
                <ul className="nav__links">
                    {NAV_LINKS.map(({ to, label, end }) => (
                        <li key={to}>
                            <NavLink
                                to={to}
                                end={end}
                                className={({ isActive }): string =>
                                    `nav__link${isActive ? ' nav__link--active' : ''}`
                                }
                            >
                                {label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
                <WalletButton />
            </div>
        </nav>
    );
}
