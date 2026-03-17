import { BitcoinAbiTypes } from 'opnet';
import { ABIDataTypes } from '@btc-vision/transaction';
export const CASE_ENGINE_ABI = [
    {
        name: 'openCase',
        type: BitcoinAbiTypes.Function,
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 },
            { name: 'userSeed', type: ABIDataTypes.BYTES32 }
        ],
        outputs: [
            { name: 'won', type: ABIDataTypes.BOOL },
            { name: 'payout', type: ABIDataTypes.UINT256 }
        ]
    },
    {
        name: 'getPoolInfo',
        type: BitcoinAbiTypes.Function,
        inputs: [],
        outputs: [
            { name: 'totalDeposited', type: ABIDataTypes.UINT256 }
        ]
    }
];
