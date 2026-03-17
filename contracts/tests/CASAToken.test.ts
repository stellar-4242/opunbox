import path from 'path';
import { fileURLToPath } from 'url';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain, OP20 } from '@btc-vision/unit-test-framework';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_PATH = path.resolve(__dirname, '../build/CASAToken.wasm').replace(/\\/g, '/');

class CASATokenContract extends OP20 {
    public readonly isMinterSelector: number;
    public readonly getEmissionRateSelector: number;
    public readonly computeEmissionWithBoostSelector: number;

    constructor(details: {
        file: string;
        deployer: Address;
        address: Address;
        decimals: number;
        deploymentCalldata?: Buffer;
    }) {
        super(details);
        this.isMinterSelector = Number(
            `0x${this.abiCoder.encodeSelector('isMinter(address)')}`,
        );
        this.getEmissionRateSelector = Number(
            `0x${this.abiCoder.encodeSelector('getEmissionRate()')}`,
        );
        this.computeEmissionWithBoostSelector = Number(
            `0x${this.abiCoder.encodeSelector('computeEmissionWithBoost()')}`,
        );
    }

    async mintTokens(sender: Address, to: Address, amount: bigint): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.mintSelector);
        writer.writeAddress(to);
        writer.writeU256(amount);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            sender,
            txOrigin: sender,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async isMinterQuery(addr: Address): Promise<boolean> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.isMinterSelector);
        writer.writeAddress(addr);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readBoolean();
    }

    async getEmissionRateQuery(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.getEmissionRateSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }

    async computeEmissionWithBoostQuery(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.computeEmissionWithBoostSelector);
        const result = await this.executeThrowOnError({
            calldata: writer.getBuffer(),
            saveStates: false,
        });
        const reader = new BinaryReader(result.response!);
        return reader.readU256();
    }
}

function buildDeployCalldata(minterAddresses: Address[]): Buffer {
    const writer = new BinaryWriter();
    writer.writeU8(minterAddresses.length);
    for (const addr of minterAddresses) {
        writer.writeAddress(addr);
    }
    return writer.getBuffer() as Buffer;
}

async function deployToken(minterAddresses: Address[] = []): Promise<CASATokenContract> {
    const deployer = Blockchain.generateRandomAddress();
    const tokenAddress = Blockchain.generateRandomAddress();

    Blockchain.msgSender = deployer;
    Blockchain.txOrigin = deployer;

    const token = new CASATokenContract({
        file: WASM_PATH,
        deployer,
        address: tokenAddress,
        decimals: 18,
        deploymentCalldata: buildDeployCalldata(minterAddresses),
    });

    Blockchain.register(token);
    await token.init();
    await token.deployContract();
    return token;
}

describe('CASAToken', () => {
    let deployer: Address;
    let minter1: Address;
    let user: Address;
    let token: CASATokenContract;

    beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        Blockchain.blockNumber = 1000n;

        deployer = Blockchain.generateRandomAddress();
        minter1 = Blockchain.generateRandomAddress();
        user = Blockchain.generateRandomAddress();

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;

        token = await deployToken([minter1]);
    });

    afterEach(() => {
        token.dispose();
    });

    describe('metadata', () => {
        it('should have 18 decimals configured', () => {
            expect(token.decimals).toBe(18);
        });
    });

    describe('initial state', () => {
        it('should have zero initial supply', async () => {
            const supply = await token.totalSupply();
            expect(supply).toBe(0n);
        });
    });

    describe('minting authorization', () => {
        it('should mint when called by authorized minter', async () => {
            const amount = 1000n * 10n ** 18n;
            const success = await token.mintTokens(minter1, user, amount);
            expect(success).toBe(true);

            const bal = await token.balanceOf(user);
            expect(bal).toBe(amount);
        });

        it('should revert when called by unauthorized address', async () => {
            const amount = 1000n * 10n ** 18n;
            await expect(token.mintTokens(deployer, user, amount)).rejects.toThrow();
        });

        it('isMinter returns true for authorized minter', async () => {
            const result = await token.isMinterQuery(minter1);
            expect(result).toBe(true);
        });

        it('isMinter returns false for unauthorized address', async () => {
            const result = await token.isMinterQuery(deployer);
            expect(result).toBe(false);
        });
    });

    describe('emission rate', () => {
        it('should return non-zero initial emission rate', async () => {
            const rate = await token.getEmissionRateQuery();
            expect(rate).toBeGreaterThan(0n);
        });

        it('computeEmissionWithBoost returns 3x during early boost period', async () => {
            const base = await token.getEmissionRateQuery();
            const boosted = await token.computeEmissionWithBoostQuery();
            expect(boosted).toBe(base * 3n);
        });
    });
});
