// Re-export from shared context so all components share the same wallet state
export { useWalletContext as useWallet } from './walletContextValue';
export type { WalletState } from './walletContextValue';
