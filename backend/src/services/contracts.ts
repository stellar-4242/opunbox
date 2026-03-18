import { getContract, ABIDataTypes, BitcoinAbiTypes } from 'opnet';
import type { CallResult } from 'opnet';
import type { FunctionBaseData, BitcoinInterfaceAbi } from 'opnet';
import type { ContractDecodedObjectResult } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { getProvider } from './provider.js';

// ─── ABI Definitions (matching actual contract ABIs) ──────────────────────────

const CASE_ENGINE_ABI_DEF: FunctionBaseData[] = [
    {
        name: 'getPoolInfo',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [],
        outputs: [{ name: 'totalDeposited', type: ABIDataTypes.UINT256 }],
    },
];

const LP_POOL_ABI_DEF: FunctionBaseData[] = [
    {
        name: 'getTotalDeposited',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [],
        outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
    },
    {
        name: 'getAvailableBalance',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [],
        outputs: [{ name: 'available', type: ABIDataTypes.UINT256 }],
    },
    {
        name: 'getDepositInfo',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [{ name: 'addr', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    },
    {
        name: 'isAboveMinimum',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [],
        outputs: [{ name: 'above', type: ABIDataTypes.BOOL }],
    },
];

const CASA_STAKING_ABI_DEF: FunctionBaseData[] = [
    {
        name: 'getStakeInfo',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [{ name: 'addr', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'staked', type: ABIDataTypes.UINT256 }],
    },
    {
        name: 'getPendingRewards',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [{ name: 'addr', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'pending', type: ABIDataTypes.UINT256 }],
    },
];

const POINTS_ABI_DEF: FunctionBaseData[] = [
    {
        name: 'getPoints',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [{ name: 'addr', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'points', type: ABIDataTypes.UINT256 }],
    },
    {
        name: 'totalPoints',
        type: BitcoinAbiTypes.Function,
        payable: false,
        inputs: [],
        outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
    },
];

// Export as BitcoinInterfaceAbi for use in getContract
export const CASE_ENGINE_ABI: BitcoinInterfaceAbi = CASE_ENGINE_ABI_DEF;
export const LP_POOL_ABI: BitcoinInterfaceAbi = LP_POOL_ABI_DEF;
export const CASA_STAKING_ABI: BitcoinInterfaceAbi = CASA_STAKING_ABI_DEF;
export const POINTS_ABI: BitcoinInterfaceAbi = POINTS_ABI_DEF;

// ─── Active network (driven by NETWORK env var) ───────────────────────────────

const NETWORK_NAME = process.env['NETWORK'] ?? 'testnet';
const ACTIVE_NETWORK = NETWORK_NAME === 'mainnet' ? networks.bitcoin : networks.opnetTestnet;

// ─── Environment helpers ───────────────────────────────────────────────────────

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export function getCaseEngineAddress(): string {
    return requireEnv('CASE_ENGINE_ADDRESS');
}

export function getLpPoolAddress(): string {
    return requireEnv('LP_POOL_ADDRESS');
}

export function getCasaStakingAddress(): string {
    return requireEnv('CASA_STAKING_ADDRESS');
}

export function getPointsAddress(): string {
    return requireEnv('POINTS_ADDRESS');
}

// ─── Contract type helpers ─────────────────────────────────────────────────────

// Minimal interface for read-only contract usage
type ContractMethod = (...args: string[]) => Promise<CallResult<ContractDecodedObjectResult>>;

interface ReadableContract {
    [key: string]: ContractMethod;
}

type ContractInstance = ReadableContract;

// ─── Contract cache with LRU pruning ──────────────────────────────────────────

const MAX_CONTRACT_CACHE = 200;

class ContractCache {
    private readonly cache: Map<string, ContractInstance> = new Map();

    public get(key: string): ContractInstance | undefined {
        const entry = this.cache.get(key);
        if (entry !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, entry);
        }
        return entry;
    }

    public set(key: string, value: ContractInstance): void {
        if (this.cache.size >= MAX_CONTRACT_CACHE) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    public has(key: string): boolean {
        return this.cache.has(key);
    }
}

const contractCache = new ContractCache();

// ─── Contract getters (read-only — no sender needed) ──────────────────────────

export function getCaseEngineContract(): ContractInstance {
    const address = getCaseEngineAddress();
    const key = `case-engine-${address}`;
    if (!contractCache.has(key)) {
        const provider = getProvider(ACTIVE_NETWORK);
        contractCache.set(
            key,
            (getContract(address, CASE_ENGINE_ABI, provider, ACTIVE_NETWORK) as unknown) as ContractInstance,
        );
    }
    return contractCache.get(key) as ContractInstance;
}

export function getLpPoolContract(): ContractInstance {
    const address = getLpPoolAddress();
    const key = `lp-pool-${address}`;
    if (!contractCache.has(key)) {
        const provider = getProvider(ACTIVE_NETWORK);
        contractCache.set(
            key,
            (getContract(address, LP_POOL_ABI, provider, ACTIVE_NETWORK) as unknown) as ContractInstance,
        );
    }
    return contractCache.get(key) as ContractInstance;
}

export function getCasaStakingContract(): ContractInstance {
    const address = getCasaStakingAddress();
    const key = `casa-staking-${address}`;
    if (!contractCache.has(key)) {
        const provider = getProvider(ACTIVE_NETWORK);
        contractCache.set(
            key,
            (getContract(address, CASA_STAKING_ABI, provider, ACTIVE_NETWORK) as unknown) as ContractInstance,
        );
    }
    return contractCache.get(key) as ContractInstance;
}

export function getPointsContract(): ContractInstance {
    const address = getPointsAddress();
    const key = `points-${address}`;
    if (!contractCache.has(key)) {
        const provider = getProvider(ACTIVE_NETWORK);
        contractCache.set(
            key,
            (getContract(address, POINTS_ABI, provider, ACTIVE_NETWORK) as unknown) as ContractInstance,
        );
    }
    return contractCache.get(key) as ContractInstance;
}

// ─── Safe contract call helper ─────────────────────────────────────────────────

export async function safeCall<T extends ContractDecodedObjectResult>(
    fn: () => Promise<CallResult<T>>,
): Promise<CallResult<T> | null> {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof Error) {
            console.error(`[contracts] Call failed: ${error.message}`);
        }
        return null;
    }
}

// ─── Contract call wrappers (typed) ───────────────────────────────────────────

function asCallable(contract: ContractInstance, method: string): (...args: string[]) => Promise<CallResult<ContractDecodedObjectResult>> {
    const fn = contract[method];
    if (typeof fn !== 'function') {
        throw new Error(`Contract method ${method} not found`);
    }
    return fn.bind(contract) as (...args: string[]) => Promise<CallResult<ContractDecodedObjectResult>>;
}

export async function callGetPoolInfo(): Promise<CallResult<{ totalDeposited: bigint }> | null> {
    const contract = getCaseEngineContract();
    return safeCall(() =>
        (asCallable(contract, 'getPoolInfo'))() as Promise<CallResult<{ totalDeposited: bigint }>>,
    );
}

export async function callGetTotalDeposited(): Promise<CallResult<{ total: bigint }> | null> {
    const contract = getLpPoolContract();
    return safeCall(() =>
        (asCallable(contract, 'getTotalDeposited'))() as Promise<CallResult<{ total: bigint }>>,
    );
}

export async function callGetAvailableBalance(): Promise<CallResult<{ available: bigint }> | null> {
    const contract = getLpPoolContract();
    return safeCall(() =>
        (asCallable(contract, 'getAvailableBalance'))() as Promise<CallResult<{ available: bigint }>>,
    );
}

export async function callGetDepositInfo(addr: string): Promise<CallResult<{ amount: bigint }> | null> {
    const contract = getLpPoolContract();
    return safeCall(() =>
        (asCallable(contract, 'getDepositInfo'))(addr) as Promise<CallResult<{ amount: bigint }>>,
    );
}

export async function callGetStakeInfo(addr: string): Promise<CallResult<{ staked: bigint }> | null> {
    const contract = getCasaStakingContract();
    return safeCall(() =>
        (asCallable(contract, 'getStakeInfo'))(addr) as Promise<CallResult<{ staked: bigint }>>,
    );
}

export async function callGetPendingRewards(addr: string): Promise<CallResult<{ pending: bigint }> | null> {
    const contract = getCasaStakingContract();
    return safeCall(() =>
        (asCallable(contract, 'getPendingRewards'))(addr) as Promise<CallResult<{ pending: bigint }>>,
    );
}

export async function callGetPoints(addr: string): Promise<CallResult<{ points: bigint }> | null> {
    const contract = getPointsContract();
    return safeCall(() =>
        (asCallable(contract, 'getPoints'))(addr) as Promise<CallResult<{ points: bigint }>>,
    );
}
