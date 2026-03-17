import path from 'path';
import { fileURLToPath } from 'url';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain, BytecodeManager, ContractRuntime } from '@btc-vision/unit-test-framework';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_PATH = path.resolve(__dirname, '../build/CaseEngine.wasm').replace(/\\/g, '/');

class CaseEngineContract extends ContractRuntime {
    public readonly openCaseSelector: number;
    public readonly getPoolInfoSelector: number;

    constructor(details: {
        deployer: Address;
        address: Address;
        deploymentCalldata?: Buffer;
    }) {
        super({ ...details });
        this.openCaseSelector = Number(
            `0x${this.abiCoder.encodeSelector('openCase(uint256,bytes32)')}`,
        );
        this.getPoolInfoSelector = Number(
            `0x${this.abiCoder.encodeSelector('getPoolInfo()')}`,
        );
    }

    protected override defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(WASM_PATH, this.address);
    }

    async openCase(
        sender: Address,
        betAmount: bigint,
        userSeed: Uint8Array,
    ): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.openCaseSelector);
        writer.writeU256(betAmount);
        writer.writeBytes(userSeed);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async getPoolInfo(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getPoolInfoSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }
}

function buildDeployCalldata(
    motoAddr: Address,
    casaAddr: Address,
    lpPoolAddr: Address,
    stakingAddr: Address,
    pointsAddr: Address,
    treasuryAddr: Address,
): Buffer {
    const writer = new BinaryWriter();
    writer.writeAddress(motoAddr);
    writer.writeAddress(casaAddr);
    writer.writeAddress(lpPoolAddr);
    writer.writeAddress(stakingAddr);
    writer.writeAddress(pointsAddr);
    writer.writeAddress(treasuryAddr);
    return writer.getBuffer() as Buffer;
}

describe('CaseEngine', () => {
    let deployer: Address;
    let motoToken: Address;
    let casaToken: Address;
    let lpPool: Address;
    let stakingContract: Address;
    let pointsContract: Address;
    let treasury: Address;
    let player: Address;
    let engine: CaseEngineContract;

    beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        Blockchain.blockNumber = 1000n;

        deployer = Blockchain.generateRandomAddress();
        motoToken = Blockchain.generateRandomAddress();
        casaToken = Blockchain.generateRandomAddress();
        lpPool = Blockchain.generateRandomAddress();
        stakingContract = Blockchain.generateRandomAddress();
        pointsContract = Blockchain.generateRandomAddress();
        treasury = Blockchain.generateRandomAddress();
        player = Blockchain.generateRandomAddress();

        const engineAddress = Blockchain.generateRandomAddress();

        engine = new CaseEngineContract({
            deployer,
            address: engineAddress,
            deploymentCalldata: buildDeployCalldata(
                motoToken,
                casaToken,
                lpPool,
                stakingContract,
                pointsContract,
                treasury,
            ),
        });

        Blockchain.register(engine);
        await engine.init();
        await engine.deployContract();
    });

    afterEach(() => {
        engine.dispose();
    });

    describe('openCase', () => {
        it('should revert on zero bet', async () => {
            const seed = new Uint8Array(32).fill(42);
            await expect(engine.openCase(player, 0n, seed)).rejects.toThrow();
        });

        it('should revert when contract calls openCase (sender != origin)', async () => {
            const seed = new Uint8Array(32).fill(1);
            const writer = new BinaryWriter();
            writer.writeSelector(engine.openCaseSelector);
            writer.writeU256(1000n);
            writer.writeBytes(seed);
            const result = await engine.execute({
                calldata: writer.getBuffer(),
                sender: deployer,
                txOrigin: player,
            });
            expect(result.error).toBeTruthy();
        });
    });

    describe('getPoolInfo', () => {
        it('should have getPoolInfo method defined', () => {
            expect(typeof engine.getPoolInfo).toBe('function');
        });
    });
});
