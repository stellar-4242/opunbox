import { BitcoinAbiTypes } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';
import type { BitcoinInterfaceAbi } from 'opnet';

export const POINTS_ABI: BitcoinInterfaceAbi = [
    {
        name: 'addPoints',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'recipient', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'getPoints',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'points', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'setReferrer',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'referrer', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'claimAirdrop',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'triggerAirdrop',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'totalPoints',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'total', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'isAuthorized',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'authorized', type: ABIDataTypes.BOOL }
        ]
    }
];
