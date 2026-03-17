import { Address } from '@btc-vision/transaction';
import { providerService, getCachedContract } from './provider';
import { CASE_ENGINE_ABI } from '../abi/CaseEngine.abi';
import { LP_POOL_ABI } from '../abi/LPPool.abi';
import { CASA_STAKING_ABI } from '../abi/CASAStaking.abi';
import { POINTS_ABI } from '../abi/Points.abi';
const NETWORK = import.meta.env.VITE_NETWORK ?? 'testnet';
const CASE_ENGINE_ADDRESS = import.meta.env.VITE_CASE_ENGINE_ADDRESS;
const LP_POOL_ADDRESS = import.meta.env.VITE_LP_POOL_ADDRESS;
const CASA_STAKING_ADDRESS = import.meta.env.VITE_CASA_STAKING_ADDRESS;
const POINTS_ADDRESS = import.meta.env.VITE_POINTS_ADDRESS;
function isAddressSet(addr) {
    return typeof addr === 'string' && addr.trim().length > 0;
}
export function getCaseEngineContract(sender) {
    if (!isAddressSet(CASE_ENGINE_ADDRESS)) {
        throw new Error('VITE_CASE_ENGINE_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract(CASE_ENGINE_ADDRESS, CASE_ENGINE_ABI, provider, network, sender);
}
export function getLPPoolContract(sender) {
    if (!isAddressSet(LP_POOL_ADDRESS)) {
        throw new Error('VITE_LP_POOL_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract(LP_POOL_ADDRESS, LP_POOL_ABI, provider, network, sender);
}
export function getCASAStakingContract(sender) {
    if (!isAddressSet(CASA_STAKING_ADDRESS)) {
        throw new Error('VITE_CASA_STAKING_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract(CASA_STAKING_ADDRESS, CASA_STAKING_ABI, provider, network, sender);
}
export function getPointsContract(sender) {
    if (!isAddressSet(POINTS_ADDRESS)) {
        throw new Error('VITE_POINTS_ADDRESS is not configured');
    }
    const provider = providerService.getProvider(NETWORK);
    const network = providerService.getNetwork(NETWORK);
    return getCachedContract(POINTS_ADDRESS, POINTS_ABI, provider, network, sender);
}
export function getProvider() {
    return providerService.getProvider(NETWORK);
}
export { Address };
