import { JSONRpcProvider, getContract } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { networks } from '@btc-vision/bitcoin';
const TESTNET_RPC = 'https://testnet.opnet.org';
const MAINNET_RPC = 'https://mainnet.opnet.org';
class ProviderService {
    static instance;
    providers = new Map();
    constructor() { }
    static getInstance() {
        if (!ProviderService.instance) {
            ProviderService.instance = new ProviderService();
        }
        return ProviderService.instance;
    }
    getProvider(networkName) {
        const isTestnet = networkName !== 'mainnet';
        const key = isTestnet ? 'testnet' : 'mainnet';
        if (!this.providers.has(key)) {
            const url = isTestnet ? TESTNET_RPC : MAINNET_RPC;
            const net = isTestnet ? networks.opnetTestnet : networks.bitcoin;
            this.providers.set(key, new JSONRpcProvider({ url, network: net }));
        }
        const p = this.providers.get(key);
        if (!p)
            throw new Error('Provider not initialized');
        return p;
    }
    getNetwork(networkName) {
        return networkName !== 'mainnet' ? networks.opnetTestnet : networks.bitcoin;
    }
}
export const providerService = ProviderService.getInstance();
// Cache uses unknown to avoid generic constraint issues — callers cast to their interface
const contractCache = new Map();
export function getCachedContract(address, abi, provider, network, sender) {
    const key = `${address}-${sender?.toString() ?? 'anon'}`;
    if (!contractCache.has(key)) {
        const contract = getContract(address, abi, provider, network, sender);
        contractCache.set(key, contract);
    }
    const cached = contractCache.get(key);
    if (!cached)
        throw new Error(`Contract cache miss for ${key}`);
    return cached;
}
export function clearContractCache() {
    contractCache.clear();
}
export { Address };
