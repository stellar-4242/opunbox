import { BitcoinAbiTypes } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';
export const CASA_TOKEN_ABI = [
    {
        name: 'mint',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'to', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 }
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'getEmissionRate',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'rate', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'isMinter',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'addr', type: ABIDataTypes.ADDRESS }
        ],
        outputs: [
            { name: 'authorized', type: ABIDataTypes.BOOL }
        ]
    },
    {
        name: 'computeEmissionWithBoost',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'rate', type: ABIDataTypes.UINT256 }
        ]
    }
];
