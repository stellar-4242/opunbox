import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './hooks/WalletContext';
import { Nav } from './components/Nav';
import { CasePage } from './pages/CasePage';
import { LPPage } from './pages/LPPage';
import { StakingPage } from './pages/StakingPage';
import { PointsPage } from './pages/PointsPage';
import { StatsPage } from './pages/StatsPage';

interface ErrorBoundaryState {
    hasError: boolean;
    error: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error: error.message };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('App error:', error, info);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: '#fff', background: '#0a0a0f', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
                    <h1 style={{ color: '#f59e0b' }}>MOTO Casino</h1>
                    <p style={{ color: '#f87171', marginTop: '1rem' }}>Error: {this.state.error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '4px' }}
                    >
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export function App(): React.ReactElement {
    return (
        <AppErrorBoundary>
            <WalletProvider>
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
            </WalletProvider>
        </AppErrorBoundary>
    );
}
