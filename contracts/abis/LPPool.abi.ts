import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const LPPoolEvents = [];

export const LPPoolAbi = [
    {
        name: 'deposit',
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 },
            { name: 'lockTier', type: ABIDataTypes.UINT8 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'withdraw',
        inputs: [],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'pullPayout',
        inputs: [
            { name: 'recipient', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'addRevenue',
        inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getTotalDeposited',
        inputs: [],
        outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getAvailableBalance',
        inputs: [],
        outputs: [{ name: 'available', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getDepositInfo',
        inputs: [{ name: 'addr', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isAboveMinimum',
        inputs: [],
        outputs: [{ name: 'above', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    ...LPPoolEvents,
    ...OP_NET_ABI,
];

export default LPPoolAbi;
