import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import { Nav } from './components/Nav';
import { CasePage } from './pages/CasePage';
import { LPPage } from './pages/LPPage';
import { StakingPage } from './pages/StakingPage';
import { PointsPage } from './pages/PointsPage';
import { StatsPage } from './pages/StatsPage';

export function App(): React.ReactElement {
    return (
        <WalletConnectProvider>
            <BrowserRouter>
                <div className="app">
                    <Nav />
                    <main className="app__main">
                        <Routes>
                            <Route path="/" element={<CasePage />} />
                            <Route path="/lp" element={<LPPage />} />
                            <Route path="/staking" element={<StakingPage />} />
                            <Route path="/points" element={<PointsPage />} />
                            <Route path="/stats" element={<StatsPage />} />
                        </Routes>
                    </main>
                </div>
            </BrowserRouter>
        </WalletConnectProvider>
    );
}
