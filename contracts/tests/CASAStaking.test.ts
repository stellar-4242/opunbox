import path from 'path';
import { fileURLToPath } from 'url';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain, BytecodeManager, ContractRuntime } from '@btc-vision/unit-test-framework';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_PATH = path.resolve(__dirname, '../build/CASAStaking.wasm').replace(/\\/g, '/');

class CASAStakingContract extends ContractRuntime {
    public readonly stakeSelector: number;
    public readonly unstakeSelector: number;
    public readonly claimRewardsSelector: number;
    public readonly addRevenueShareSelector: number;
    public readonly getStakeInfoSelector: number;
    public readonly getPendingRewardsSelector: number;
    public readonly initializeSelector: number;

    constructor(details: {
        deployer: Address;
        address: Address;
        deploymentCalldata?: Buffer;
    }) {
        super({ ...details });
        this.stakeSelector = Number(`0x${this.abiCoder.encodeSelector('stake(uint256)')}`);
        this.unstakeSelector = Number(`0x${this.abiCoder.encodeSelector('unstake()')}`);
        this.claimRewardsSelector = Number(
            `0x${this.abiCoder.encodeSelector('claimRewards()')}`,
        );
        this.addRevenueShareSelector = Number(
            `0x${this.abiCoder.encodeSelector('addRevenueShare(uint256)')}`,
        );
        this.getStakeInfoSelector = Number(
            `0x${this.abiCoder.encodeSelector('getStakeInfo(address)')}`,
        );
        this.getPendingRewardsSelector = Number(
            `0x${this.abiCoder.encodeSelector('getPendingRewards(address)')}`,
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
        casaAddr: Address,
        motoAddr: Address,
        engineAddr: Address,
    ): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.initializeSelector);
        writer.writeAddress(casaAddr);
        writer.writeAddress(motoAddr);
        writer.writeAddress(engineAddr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async stake(sender: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.stakeSelector);
        writer.writeU256(amount);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async unstake(sender: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.unstakeSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async claimRewards(sender: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.claimRewardsSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async addRevenueShare(sender: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.addRevenueShareSelector);
        writer.writeU256(amount);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async getStakeInfo(addr: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getStakeInfoSelector);
        writer.writeAddress(addr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async getPendingRewards(addr: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getPendingRewardsSelector);
        writer.writeAddress(addr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }
}

describe('CASAStaking', () => {
    let deployer: Address;
    let casaToken: Address;
    let motoToken: Address;
    let caseEngine: Address;
    let staker1: Address;
    let staking: CASAStakingContract;

    beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        Blockchain.blockNumber = 1000n;

        deployer = Blockchain.generateRandomAddress();
        casaToken = Blockchain.generateRandomAddress();
        motoToken = Blockchain.generateRandomAddress();
        caseEngine = Blockchain.generateRandomAddress();
        staker1 = Blockchain.generateRandomAddress();

        const stakingAddress = Blockchain.generateRandomAddress();

        staking = new CASAStakingContract({
            deployer,
            address: stakingAddress,
        });

        Blockchain.register(staking);
        await staking.init();
        await staking.deployContract();

        // Call initialize() to configure peer addresses
        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
        await staking.callInitialize(deployer, casaToken, motoToken, caseEngine);
    });

    afterEach(() => {
        staking.dispose();
    });

    describe('initialize', () => {
        it('should revert on second call to initialize', async () => {
            await expect(
                staking.callInitialize(deployer, casaToken, motoToken, caseEngine),
            ).rejects.toThrow();
        });

        it('should revert when non-deployer calls initialize', async () => {
            const freshAddress = Blockchain.generateRandomAddress();
            const fresh = new CASAStakingContract({ deployer, address: freshAddress });
            Blockchain.register(fresh);
            await fresh.init();
            await fresh.deployContract();
            await expect(
                fresh.callInitialize(staker1, casaToken, motoToken, caseEngine),
            ).rejects.toThrow();
            fresh.dispose();
        });
    });

    describe('stake', () => {
        it('should revert on zero stake', async () => {
            await expect(staking.stake(staker1, 0n)).rejects.toThrow();
        });

        it('should revert when contract is caller (sender != origin)', async () => {
            const writer = new BinaryWriter();
            writer.writeSelector(staking.stakeSelector);
            writer.writeU256(1000n);
            const result = await staking.execute({
                calldata: writer.getBuffer(),
                sender: deployer,
                txOrigin: staker1,
            });
            expect(result.error).toBeTruthy();
        });
    });

    describe('unstake', () => {
        it('should revert when no stake found', async () => {
            await expect(staking.unstake(staker1)).rejects.toThrow();
        });
    });

    describe('claimRewards', () => {
        it('should revert when no stake found', async () => {
            await expect(staking.claimRewards(staker1)).rejects.toThrow();
        });
    });

    describe('addRevenueShare', () => {
        it('should revert when not called by CaseEngine', async () => {
            await expect(staking.addRevenueShare(deployer, 1000n)).rejects.toThrow();
        });

        it('should succeed when called by CaseEngine', async () => {
            const result = await staking.addRevenueShare(caseEngine, 1000n);
            expect(result).toBe(true);
        });
    });

    describe('getStakeInfo', () => {
        it('should return zero for unstaked address', async () => {
            const amount = await staking.getStakeInfo(staker1);
            expect(amount).toBe(0n);
        });
    });

    describe('getPendingRewards', () => {
        it('should return zero for unstaked address', async () => {
            const pending = await staking.getPendingRewards(staker1);
            expect(pending).toBe(0n);
        });
    });
});
