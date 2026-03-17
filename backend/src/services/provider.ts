import { JSONRpcProvider } from 'opnet';
import { networks, type Network } from '@btc-vision/bitcoin';

const TESTNET_RPC = 'https://testnet.opnet.org';
const MAINNET_RPC = 'https://mainnet.opnet.org';

class ProviderService {
    private static instance: ProviderService | undefined;
    private readonly providers: Map<string, JSONRpcProvider> = new Map();

    private constructor() {
        // singleton
    }

    public static getInstance(): ProviderService {
        if (ProviderService.instance === undefined) {
            ProviderService.instance = new ProviderService();
        }
        return ProviderService.instance;
    }

    public getProvider(network: Network): JSONRpcProvider {
        const key = network === networks.bitcoin ? 'mainnet' : 'testnet';
        if (!this.providers.has(key)) {
            const url = network === networks.bitcoin ? MAINNET_RPC : TESTNET_RPC;
            this.providers.set(key, new JSONRpcProvider({ url, network }));
        }
        return this.providers.get(key) as JSONRpcProvider;
    }
}

export function getProvider(network?: Network): JSONRpcProvider {
    const net = network ?? networks.opnetTestnet;
    return ProviderService.getInstance().getProvider(net);
}
