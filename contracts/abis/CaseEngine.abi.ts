import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const CaseEngineEvents = [];

export const CaseEngineAbi = [
    {
        name: 'openCase',
        inputs: [
            { name: 'amount', type: ABIDataTypes.UINT256 },
            { name: 'userSeed', type: ABIDataTypes.BYTES32 },
        ],
        outputs: [{ name: 'won', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getPoolInfo',
        inputs: [],
        outputs: [{ name: 'totalDeposited', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...CaseEngineEvents,
    ...OP_NET_ABI,
];

export default CaseEngineAbi;
