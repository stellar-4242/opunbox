import path from 'path';
import { fileURLToPath } from 'url';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain, BytecodeManager, ContractRuntime } from '@btc-vision/unit-test-framework';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_PATH = path.resolve(__dirname, '../build/LPPool.wasm').replace(/\\/g, '/');

class LPPoolContract extends ContractRuntime {
    public readonly depositSelector: number;
    public readonly withdrawSelector: number;
    public readonly pullPayoutSelector: number;
    public readonly addRevenueSelector: number;
    public readonly getTotalDepositedSelector: number;
    public readonly getAvailableBalanceSelector: number;
    public readonly getDepositInfoSelector: number;
    public readonly isAboveMinimumSelector: number;
    public readonly initializeSelector: number;

    constructor(details: {
        deployer: Address;
        address: Address;
        deploymentCalldata?: Buffer;
    }) {
        super({ ...details });
        this.depositSelector = Number(
            `0x${this.abiCoder.encodeSelector('deposit(uint256,uint8)')}`,
        );
        this.withdrawSelector = Number(`0x${this.abiCoder.encodeSelector('withdraw()')}`);
        this.pullPayoutSelector = Number(
            `0x${this.abiCoder.encodeSelector('pullPayout(address,uint256)')}`,
        );
        this.addRevenueSelector = Number(
            `0x${this.abiCoder.encodeSelector('addRevenue(uint256)')}`,
        );
        this.getTotalDepositedSelector = Number(
            `0x${this.abiCoder.encodeSelector('getTotalDeposited()')}`,
        );
        this.getAvailableBalanceSelector = Number(
            `0x${this.abiCoder.encodeSelector('getAvailableBalance()')}`,
        );
        this.getDepositInfoSelector = Number(
            `0x${this.abiCoder.encodeSelector('getDepositInfo(address)')}`,
        );
        this.isAboveMinimumSelector = Number(
            `0x${this.abiCoder.encodeSelector('isAboveMinimum()')}`,
        );
        this.initializeSelector = Number(
            `0x${this.abiCoder.encodeSelector('initialize()')}`,
        );
    }

    protected override defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(WASM_PATH, this.address);
    }

    async callInitialize(
        sender: Address,
        motoAddr: Address,
        casaAddr: Address,
        pointsAddr: Address,
        engineAddr: Address,
    ): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.initializeSelector);
        writer.writeAddress(motoAddr);
        writer.writeAddress(casaAddr);
        writer.writeAddress(pointsAddr);
        writer.writeAddress(engineAddr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async deposit(sender: Address, amount: bigint, tier: number): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.depositSelector);
        writer.writeU256(amount);
        writer.writeU8(tier);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async withdraw(sender: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.withdrawSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async addRevenue(sender: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.addRevenueSelector);
        writer.writeU256(amount);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async pullPayout(sender: Address, recipient: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.pullPayoutSelector);
        writer.writeAddress(recipient);
        writer.writeU256(amount);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async getTotalDeposited(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getTotalDepositedSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async isAboveMinimum(): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.isAboveMinimumSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async getDepositInfo(addr: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getDepositInfoSelector);
        writer.writeAddress(addr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }
}

describe('LPPool', () => {
    let deployer: Address;
    let motoToken: Address;
    let casaToken: Address;
    let pointsContract: Address;
    let caseEngine: Address;
    let lp1: Address;
    let pool: LPPoolContract;

    beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        Blockchain.blockNumber = 1000n;

        deployer = Blockchain.generateRandomAddress();
        motoToken = Blockchain.generateRandomAddress();
        casaToken = Blockchain.generateRandomAddress();
        pointsContract = Blockchain.generateRandomAddress();
        caseEngine = Blockchain.generateRandomAddress();
        lp1 = Blockchain.generateRandomAddress();

        const poolAddress = Blockchain.generateRandomAddress();

        pool = new LPPoolContract({
            deployer,
            address: poolAddress,
        });

        Blockchain.register(pool);
        await pool.init();
        await pool.deployContract();

        // Call initialize() to configure peer addresses
        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
        await pool.callInitialize(deployer, motoToken, casaToken, pointsContract, caseEngine);
    });

    afterEach(() => {
        pool.dispose();
    });

    describe('initialize', () => {
        it('should revert on second call to initialize', async () => {
            await expect(
                pool.callInitialize(deployer, motoToken, casaToken, pointsContract, caseEngine),
            ).rejects.toThrow();
        });

        it('should revert when non-deployer calls initialize', async () => {
            const freshAddress = Blockchain.generateRandomAddress();
            const fresh = new LPPoolContract({ deployer, address: freshAddress });
            Blockchain.register(fresh);
            await fresh.init();
            await fresh.deployContract();
            await expect(
                fresh.callInitialize(lp1, motoToken, casaToken, pointsContract, caseEngine),
            ).rejects.toThrow();
            fresh.dispose();
        });
    });

    describe('deposit', () => {
        it('should revert on zero deposit', async () => {
            await expect(pool.deposit(lp1, 0n, 0)).rejects.toThrow();
        });

        it('should revert on invalid tier', async () => {
            await expect(pool.deposit(lp1, 1000n, 3)).rejects.toThrow();
        });

        it('should revert when contract is caller (sender != origin)', async () => {
            const writer = new BinaryWriter();
            writer.writeSelector(pool.depositSelector);
            writer.writeU256(1000n);
            writer.writeU8(0);
            const result = await pool.execute({
                calldata: writer.getBuffer(),
                sender: deployer,
                txOrigin: lp1,
            });
            expect(result.error).toBeTruthy();
        });
    });

    describe('withdraw', () => {
        it('should revert when no deposit exists', async () => {
            await expect(pool.withdraw(lp1)).rejects.toThrow();
        });
    });

    describe('addRevenue', () => {
        it('should revert when called by non-CaseEngine', async () => {
            await expect(pool.addRevenue(deployer, 1000n)).rejects.toThrow();
        });
    });

    describe('pullPayout', () => {
        it('should revert when called by non-CaseEngine', async () => {
            await expect(pool.pullPayout(deployer, lp1, 1000n)).rejects.toThrow();
        });
    });

    describe('isAboveMinimum', () => {
        it('should return false on empty pool', async () => {
            const result = await pool.isAboveMinimum();
            expect(result).toBe(false);
        });
    });

    describe('getDepositInfo', () => {
        it('should return zero for address with no deposit', async () => {
            const amount = await pool.getDepositInfo(lp1);
            expect(amount).toBe(0n);
        });
    });

    describe('getTotalDeposited', () => {
        it('should return zero on empty pool', async () => {
            const total = await pool.getTotalDeposited();
            expect(total).toBe(0n);
        });
    });
});
