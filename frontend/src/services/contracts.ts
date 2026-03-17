import { Address } from '@btc-vision/transaction';
import { providerService, getCachedContract } from './provider';
import { CASE_ENGINE_ABI } from '../abi/CaseEngine.abi';
import { LP_POOL_ABI } from '../abi/LPPool.abi';
import { CASA_STAKING_ABI } from '../abi/CASAStaking.abi';
import { POINTS_ABI } from '../abi/Points.abi';
import { OP20_ALLOWANCE_ABI } from '../abi/OP20.abi';
import type {
    ICaseEngineContract,
    ILPPoolContract,
    ICASAStakingContract,
    IPointsContract,
    IOP20TokenContract,
} from '../types/contracts';

const NETWORK = import.meta.env.VITE_NETWORK ?? 'testnet';
const CASE_ENGINE_ADDRESS = import.meta.env.VITE_CASE_ENGINE_ADDRESS;
const LP_POOL_ADDRESS = import.meta.env.VITE_LP_POOL_ADDRESS;
const CASA_STAKING_ADDRESS = import.meta.env.VITE_CASA_STAKING_ADDRESS;
const POINTS_ADDRESS = import.meta.env.VITE_POINTS_ADDRESS;
const MOTO_TOKEN_ADDRESS = import.meta.env.VITE_MOTO_TOKEN_ADDRESS;
const CASA_TOKEN_ADDRESS = import.meta.env.VITE_CASA_TOKEN_ADDRESS;

function isAddressSet(addr: string | undefined): addr is string {
    return typeof addr === 'string' && addr.trim().length > 0;
}

export function getCaseEngineContract(sender?: Address): ICaseEngineContract {
    if (!isAddressSet(CASE_ENGINE_ADDRESS)) {
        throw new Error('VITE_CASE_ENGINE_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<ICaseEngineContract>(
        CASE_ENGINE_ADDRESS,
        CASE_ENGINE_ABI,
        provider,
        network,
        sender,
    );
}

export function getLPPoolContract(sender?: Address): ILPPoolContract {
    if (!isAddressSet(LP_POOL_ADDRESS)) {
        throw new Error('VITE_LP_POOL_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<ILPPoolContract>(
        LP_POOL_ADDRESS,
        LP_POOL_ABI,
        provider,
        network,
        sender,
    );
}

export function getCASAStakingContract(sender?: Address): ICASAStakingContract {
    if (!isAddressSet(CASA_STAKING_ADDRESS)) {
        throw new Error('VITE_CASA_STAKING_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<ICASAStakingContract>(
        CASA_STAKING_ADDRESS,
        CASA_STAKING_ABI,
        provider,
        network,
        sender,
    );
}

export function getPointsContract(sender?: Address): IPointsContract {
    if (!isAddressSet(POINTS_ADDRESS)) {
        throw new Error('VITE_POINTS_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<IPointsContract>(
        POINTS_ADDRESS,
        POINTS_ABI,
        provider,
        network,
        sender,
    );
}

export function getProvider(): ReturnType<typeof providerService.getProvider> {
    return providerService.getProvider(NETWORK);
}

export function getMotoTokenContract(sender?: Address): IOP20TokenContract {
    if (!isAddressSet(MOTO_TOKEN_ADDRESS)) {
        throw new Error('VITE_MOTO_TOKEN_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<IOP20TokenContract>(
        MOTO_TOKEN_ADDRESS,
        OP20_ALLOWANCE_ABI,
        provider,
        network,
        sender,
    );
}

export function getCasaTokenContract(sender?: Address): IOP20TokenContract {
    if (!isAddressSet(CASA_TOKEN_ADDRESS)) {
        throw new Error('VITE_CASA_TOKEN_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract<IOP20TokenContract>(
        CASA_TOKEN_ADDRESS,
        OP20_ALLOWANCE_ABI,
        provider,
        network,
        sender,
    );
}

export { Address };
