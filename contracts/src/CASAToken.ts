import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    OP20,
    OP20InitParameters,
    Revert,
    SafeMath,
    StoredBoolean,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// $CASA Token — OPNet OP-20
// Max supply: 1,000,000,000 CASA (18 decimals)
// Mint only by authorized minters
// Emission halves every ~388,800 blocks (~90 days)
// Early LP boost: 3x for first ~129,600 blocks (~30 days)

const MAX_SUPPLY: u256 = u256.fromString('1000000000000000000000000000'); // 1B * 10^18
const HALVING_INTERVAL: u64 = 388800;
const EARLY_BOOST_BLOCKS: u64 = 129600;
const EARLY_BOOST_MULT: u64 = 3;


@final
export class CASAToken extends OP20 {
    private readonly deploymentBlockPtr: u16 = Blockchain.nextPointer;
    private readonly initialEmissionRatePtr: u16 = Blockchain.nextPointer;
    private readonly minterAuthPtr: u16 = Blockchain.nextPointer;
    private readonly mintClosedPtr: u16 = Blockchain.nextPointer;

    private readonly deploymentBlock: StoredU256 = new StoredU256(
        this.deploymentBlockPtr,
        EMPTY_POINTER,
    );
    private readonly initialEmissionRate: StoredU256 = new StoredU256(
        this.initialEmissionRatePtr,
        EMPTY_POINTER,
    );
    private readonly mintClosed: StoredBoolean = new StoredBoolean(this.mintClosedPtr, false);

    // address => 1/0 authorization flag
    private readonly minters: AddressMemoryMap = new AddressMemoryMap(this.minterAuthPtr);

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        this.instantiate(new OP20InitParameters(MAX_SUPPLY, 18, 'CASA Token', 'CASA'));

        this.deploymentBlock.value = u256.fromU64(Blockchain.block.number);
        this.initialEmissionRate.value = u256.fromU64(1000);

        // Parse minter addresses: [uint8 count, address, ...]
        const count: u8 = _calldata.readU8();
        for (let i: u8 = 0; i < count; i++) {
            const addr: Address = _calldata.readAddress();
            if (!addr.isZero()) {
                this.minters.set(addr, u256.One);
            }
        }
    }

    // mint(address,uint256) — authorized minters only
    @method({ name: 'to', type: ABIDataTypes.ADDRESS }, { name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public mint(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (!this._isMinterAddress(caller)) {
            throw new Revert('CASAToken: not an authorized minter');
        }

        const to: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        if (to.isZero()) throw new Revert('CASAToken: mint to zero address');
        if (amount.isZero()) throw new Revert('CASAToken: amount is zero');

        if (this.mintClosed.value) throw new Revert('CASAToken: max supply reached');

        const current: u256 = this._totalSupply.value;
        const newSupply: u256 = SafeMath.add(current, amount);

        if (u256.gt(newSupply, MAX_SUPPLY)) {
            const remaining: u256 = SafeMath.sub(MAX_SUPPLY, current);
            if (remaining.isZero()) throw new Revert('CASAToken: max supply reached');
            this._mint(to, remaining);
            this.mintClosed.value = true;
        } else {
            this._mint(to, amount);
        }

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // AUDIT FIX: getEmissionRate() — pure view, does NOT write state
    @method()
    @returns({ name: 'rate', type: ABIDataTypes.UINT256 })
    public getEmissionRate(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this.getEmissionRateValue());
        return w;
    }

    // isMinter(address) — check authorization
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'authorized', type: ABIDataTypes.BOOL })
    public isMinter(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(1);
        w.writeBoolean(this._isMinterAddress(addr));
        return w;
    }

    // computeEmissionWithBoost() — early LP 3x boost view
    @method()
    @returns({ name: 'rate', type: ABIDataTypes.UINT256 })
    public computeEmissionWithBoost(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this.getEmissionWithBoostValue());
        return w;
    }

    // AUDIT FIX: Pure computation — reads state, NEVER writes
    public getEmissionRateValue(): u256 {
        const currentBlock: u64 = Blockchain.block.number;
        const deployBlock: u64 = this.deploymentBlock.value.toU64();

        if (currentBlock <= deployBlock) return this.initialEmissionRate.value;

        const elapsed: u64 = currentBlock - deployBlock;
        const halvings: u64 = elapsed / HALVING_INTERVAL;

        // Cap loop at 64 iterations — rate reaches 0 well before this (after ~10 halvings
        // with initial rate 1000). Explicit cap satisfies Bob's C-04 (no unbounded loops).
        const MAX_HALVINGS: u64 = 64;
        const cappedHalvings: u64 = halvings < MAX_HALVINGS ? halvings : MAX_HALVINGS;

        let rate: u256 = this.initialEmissionRate.value;
        for (let i: u64 = 0; i < cappedHalvings; i++) {
            if (rate.isZero()) break;
            rate = SafeMath.div(rate, u256.fromU64(2));
        }
        return rate;
    }

    public getEmissionWithBoostValue(): u256 {
        const rate: u256 = this.getEmissionRateValue();
        const currentBlock: u64 = Blockchain.block.number;
        const deployBlock: u64 = this.deploymentBlock.value.toU64();

        if (currentBlock <= deployBlock) return SafeMath.mul(rate, u256.fromU64(EARLY_BOOST_MULT));

        const elapsed: u64 = currentBlock - deployBlock;
        if (elapsed < EARLY_BOOST_BLOCKS) return SafeMath.mul(rate, u256.fromU64(EARLY_BOOST_MULT));

        return rate;
    }

    // AUDIT FIX: Zero-address guard
    private _isMinterAddress(addr: Address): bool {
        if (addr.isZero()) return false;
        return !this.minters.get(addr).isZero();
    }
}
