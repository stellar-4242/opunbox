/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CASE_ENGINE_ADDRESS: string;
    readonly VITE_LP_POOL_ADDRESS: string;
    readonly VITE_CASA_STAKING_ADDRESS: string;
    readonly VITE_CASA_TOKEN_ADDRESS: string;
    readonly VITE_POINTS_ADDRESS: string;
    readonly VITE_MOTO_TOKEN_ADDRESS: string;
    readonly VITE_NETWORK: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
