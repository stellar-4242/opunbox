import { JSONRpcProvider, getContract } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { networks } from '@btc-vision/bitcoin';
import type { Network } from '@btc-vision/bitcoin';
import type { BitcoinInterfaceAbi } from 'opnet';

const TESTNET_RPC = 'https://testnet.opnet.org';
const MAINNET_RPC = 'https://mainnet.opnet.org';

class ProviderService {
    private static instance: ProviderService;
    private readonly providers: Map<string, JSONRpcProvider> = new Map();

    private constructor() {}

    public static getInstance(): ProviderService {
        if (!ProviderService.instance) {
            ProviderService.instance = new ProviderService();
        }
        return ProviderService.instance;
    }

    public getProvider(networkName: string): JSONRpcProvider {
        const isTestnet = networkName !== 'mainnet';
        const key = isTestnet ? 'testnet' : 'mainnet';
        if (!this.providers.has(key)) {
            const url = isTestnet ? TESTNET_RPC : MAINNET_RPC;
            const net: Network = isTestnet ? networks.opnetTestnet : networks.bitcoin;
            this.providers.set(key, new JSONRpcProvider({ url, network: net }));
        }
        const p = this.providers.get(key);
        if (!p) throw new Error('Provider not initialized');
        return p;
    }

    public getNetwork(networkName: string): Network {
        return networkName !== 'mainnet' ? networks.opnetTestnet : networks.bitcoin;
    }
}

export const providerService = ProviderService.getInstance();

// Cache uses unknown to avoid generic constraint issues — callers cast to their interface
const contractCache = new Map<string, unknown>();

export function getCachedContract<T>(
    address: string,
    abi: BitcoinInterfaceAbi,
    provider: JSONRpcProvider,
    network: Network,
    sender: Address | undefined,
): T {
    const key = `${address}-${sender?.toString() ?? 'anon'}`;
    if (!contractCache.has(key)) {
        const contract = getContract(address, abi, provider, network, sender);
        contractCache.set(key, contract);
    }
    const cached = contractCache.get(key);
    if (!cached) throw new Error(`Contract cache miss for ${key}`);
    return cached as T;
}

export function clearContractCache(): void {
    contractCache.clear();
}

export { Address };
