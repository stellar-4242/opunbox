import path from 'path';
import { fileURLToPath } from 'url';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain, BytecodeManager, ContractRuntime } from '@btc-vision/unit-test-framework';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_PATH = path.resolve(__dirname, '../build/Points.wasm').replace(/\\/g, '/');

class PointsContract extends ContractRuntime {
    public readonly addPointsSelector: number;
    public readonly getPointsSelector: number;
    public readonly setReferrerSelector: number;
    public readonly claimAirdropSelector: number;
    public readonly triggerAirdropSelector: number;
    public readonly totalPointsSelector: number;
    public readonly isAuthorizedSelector: number;
    public readonly initializeSelector: number;

    constructor(details: {
        deployer: Address;
        address: Address;
        deploymentCalldata?: Buffer;
    }) {
        super({ ...details });
        this.addPointsSelector = Number(
            `0x${this.abiCoder.encodeSelector('addPoints(address,uint256)')}`,
        );
        this.getPointsSelector = Number(
            `0x${this.abiCoder.encodeSelector('getPoints(address)')}`,
        );
        this.setReferrerSelector = Number(
            `0x${this.abiCoder.encodeSelector('setReferrer(address)')}`,
        );
        this.claimAirdropSelector = Number(
            `0x${this.abiCoder.encodeSelector('claimAirdrop()')}`,
        );
        this.triggerAirdropSelector = Number(
            `0x${this.abiCoder.encodeSelector('triggerAirdrop()')}`,
        );
        this.totalPointsSelector = Number(
            `0x${this.abiCoder.encodeSelector('totalPoints()')}`,
        );
        this.isAuthorizedSelector = Number(
            `0x${this.abiCoder.encodeSelector('isAuthorized(address)')}`,
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
        authorizedAddresses: Address[],
        casaAddr: Address,
    ): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.initializeSelector);
        writer.writeU8(authorizedAddresses.length);
        for (const addr of authorizedAddresses) {
            writer.writeAddress(addr);
        }
        writer.writeAddress(casaAddr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async addPoints(sender: Address, recipient: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.addPointsSelector);
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

    async getPoints(addr: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getPointsSelector);
        writer.writeAddress(addr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async setReferrer(sender: Address, referrer: Address): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.setReferrerSelector);
        writer.writeAddress(referrer);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async triggerAirdrop(sender: Address): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.triggerAirdropSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async claimAirdrop(sender: Address): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.claimAirdropSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async totalPoints(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.totalPointsSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }
}

describe('Points', () => {
    let deployer: Address;
    let authorizedContract: Address;
    let casaToken: Address;
    let user1: Address;
    let user2: Address;
    let points: PointsContract;

    beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        Blockchain.blockNumber = 1000n;

        deployer = Blockchain.generateRandomAddress();
        authorizedContract = Blockchain.generateRandomAddress();
        casaToken = Blockchain.generateRandomAddress();
        user1 = Blockchain.generateRandomAddress();
        user2 = Blockchain.generateRandomAddress();

        const pointsAddress = Blockchain.generateRandomAddress();

        points = new PointsContract({
            deployer,
            address: pointsAddress,
        });

        Blockchain.register(points);
        await points.init();
        await points.deployContract();

        // Call initialize() to set authorized contracts and CASA token
        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
        await points.callInitialize(deployer, [authorizedContract], casaToken);
    });

    afterEach(() => {
        points.dispose();
    });

    describe('initialize', () => {
        it('should revert on second call to initialize', async () => {
            const other = Blockchain.generateRandomAddress();
            await expect(
                points.callInitialize(deployer, [other], casaToken),
            ).rejects.toThrow();
        });

        it('should revert when non-deployer calls initialize', async () => {
            const freshAddress = Blockchain.generateRandomAddress();
            const fresh = new PointsContract({ deployer, address: freshAddress });
            Blockchain.register(fresh);
            await fresh.init();
            await fresh.deployContract();
            await expect(
                fresh.callInitialize(user1, [authorizedContract], casaToken),
            ).rejects.toThrow();
            fresh.dispose();
        });
    });

    describe('addPoints', () => {
        it('should add points for authorized caller', async () => {
            await points.addPoints(authorizedContract, user1, 500n);
            const pts = await points.getPoints(user1);
            expect(pts).toBe(500n);
        });

        it('should revert when called by unauthorized address', async () => {
            await expect(points.addPoints(deployer, user1, 100n)).rejects.toThrow();
        });

        it('should credit referrer 10% when points are added', async () => {
            await points.setReferrer(user1, user2);
            await points.addPoints(authorizedContract, user1, 1000n);

            const user2Pts = await points.getPoints(user2);
            expect(user2Pts).toBe(100n);
        });
    });

    describe('setReferrer', () => {
        it('should set referrer one-time', async () => {
            await expect(points.setReferrer(user1, user2)).resolves.toBe(true);
        });

        it('should revert on second referrer set', async () => {
            await points.setReferrer(user1, user2);
            await expect(points.setReferrer(user1, user2)).rejects.toThrow();
        });

        it('should revert on self-referral', async () => {
            await expect(points.setReferrer(user1, user1)).rejects.toThrow();
        });
    });

    describe('triggerAirdrop', () => {
        it('should revert before delay elapses (audit fix)', async () => {
            await expect(points.triggerAirdrop(deployer)).rejects.toThrow();
        });

        it('should succeed after delay elapses', async () => {
            Blockchain.blockNumber = 1000n + 129600n;
            await expect(points.triggerAirdrop(deployer)).resolves.toBe(true);
        });

        it('should revert if triggered twice', async () => {
            Blockchain.blockNumber = 1000n + 129600n;
            await points.triggerAirdrop(deployer);
            await expect(points.triggerAirdrop(deployer)).rejects.toThrow();
        });
    });

    describe('claimAirdrop', () => {
        it('should revert before airdrop is triggered', async () => {
            await expect(points.claimAirdrop(user1)).rejects.toThrow();
        });

        it('should revert when user has no points', async () => {
            Blockchain.blockNumber = 1000n + 129600n;
            await points.triggerAirdrop(deployer);
            await expect(points.claimAirdrop(user1)).rejects.toThrow();
        });
    });
});
