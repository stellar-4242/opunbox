import { BitcoinAbiTypes } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';
import type { BitcoinInterfaceAbi } from 'opnet';

export const CASA_STAKING_ABI: BitcoinInterfaceAbi = [
    {
        name: 'stake',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'unstake',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'claimRewards',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'rewards', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'addRevenueShare',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'getStakeInfo',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'staked', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'getPendingRewards',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'pending', type: ABIDataTypes.UINT256 }
        ]
    }
];
