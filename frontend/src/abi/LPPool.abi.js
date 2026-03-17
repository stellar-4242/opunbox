import { BitcoinAbiTypes } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';
export const LP_POOL_ABI = [
    {
        name: 'deposit',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 },
            { name: 'lockTier', type: ABIDataTypes.UINT8 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'withdraw',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'pullPayout',
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
        name: 'addRevenue',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'getTotalDeposited',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'total', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'getAvailableBalance',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'available', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'getDepositInfo',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'isAboveMinimum',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'above', type: ABIDataTypes.BOOL }
        ]
    }
];
