import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    OP_NET,
    Revert,
    SafeMath,
    StoredAddress,
    StoredU256,
    encodeSelector,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// $CASA Staking Contract
// stake(amount), unstake(), claimRewards()
// Multiplier tiers (continuous stake duration):
//   < 7d  (~1008 blocks) = 1.0x (1000)
//   < 30d (~4320 blocks) = 1.3x (1300)
//   >= 90d (~12960 blocks) = 1.8x (1800)
//
// AUDIT FIXES:
// - Multiplier applied in _computePending: effectiveStake = amount * multiplier / DENOM
// - _checkpointWeightedStake() updates totalWeightedStake when tier changes
// - Checkpoint called at start of unstake() and claimRewards()

const BLOCKS_7D: u64 = 1008;
const BLOCKS_30D: u64 = 4320;
const BLOCKS_90D: u64 = 12960;
const MULTI_DENOM: u64 = 1000;
const MULTI_7D: u64 = 1000;
const MULTI_30D: u64 = 1300;
const MULTI_90D: u64 = 1800;
const DECIMAL_BASE: u256 = u256.fromString('1000000000000000000'); // 10^18
const MIN_STAKE: u256 = u256.fromString('1000000000000000000'); // 1 CASA (10^18)


@final
export class CASAStaking extends OP_NET {
    private readonly casaTokenPtr: u16 = Blockchain.nextPointer;
    private readonly motoTokenPtr: u16 = Blockchain.nextPointer;
    private readonly caseEnginePtr: u16 = Blockchain.nextPointer;
    private readonly totalWeightedStakePtr: u16 = Blockchain.nextPointer;
    private readonly revenuePerWeightedStakePtr: u16 = Blockchain.nextPointer;

    private readonly stakeAmountPtr: u16 = Blockchain.nextPointer;
    private readonly stakeBlockPtr: u16 = Blockchain.nextPointer;
    private readonly stakeWeightedSnapshotPtr: u16 = Blockchain.nextPointer;
    private readonly stakeRevenueSnapshotPtr: u16 = Blockchain.nextPointer;

    private readonly casaToken: StoredAddress = new StoredAddress(this.casaTokenPtr);
    private readonly motoToken: StoredAddress = new StoredAddress(this.motoTokenPtr);
    private readonly caseEngine: StoredAddress = new StoredAddress(this.caseEnginePtr);
    private readonly totalWeightedStake: StoredU256 = new StoredU256(this.totalWeightedStakePtr, EMPTY_POINTER);
    // revenuePerWeightedStake * 10^18 for precision
    private readonly revenuePerWeightedStake: StoredU256 = new StoredU256(this.revenuePerWeightedStakePtr, EMPTY_POINTER);

    private readonly stakeAmount: AddressMemoryMap = new AddressMemoryMap(this.stakeAmountPtr);
    private readonly stakeBlock: AddressMemoryMap = new AddressMemoryMap(this.stakeBlockPtr);
    // checkpoint of weighted stake at last update
    private readonly stakeWeightedSnapshot: AddressMemoryMap = new AddressMemoryMap(this.stakeWeightedSnapshotPtr);
    // revenuePerWeightedStake snapshot at last claim
    private readonly stakeRevenueSnapshot: AddressMemoryMap = new AddressMemoryMap(this.stakeRevenueSnapshotPtr);

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        const casaAddr: Address = _calldata.readAddress();
        const motoAddr: Address = _calldata.readAddress();
        const caseEngineAddr: Address = _calldata.readAddress();

        if (!casaAddr.isZero()) this.casaToken.value = casaAddr;
        if (!motoAddr.isZero()) this.motoToken.value = motoAddr;
        if (!caseEngineAddr.isZero()) this.caseEngine.value = caseEngineAddr;
    }

    // stake(uint256) — EOA only
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public stake(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const origin: Address = Blockchain.tx.origin;

        if (!caller.equals(origin)) throw new Revert('CASAStaking: contract callers not allowed');

        const amount: u256 = calldata.readU256();
        if (amount.isZero()) throw new Revert('CASAStaking: stake amount is zero');
        if (u256.lt(amount, MIN_STAKE)) throw new Revert('CASAStaking: stake below minimum');

        // Transfer CASA from caller
        const casaAddr: Address = this.casaToken.value;
        this._transferFrom(casaAddr, caller, Blockchain.contractAddress, amount);

        // Checkpoint existing stake before adding more
        const existing: u256 = this.stakeAmount.get(caller);
        if (!existing.isZero()) {
            this._checkpointWeightedStake(caller);
            // Update snapshot to capture pending before adding
            this.stakeRevenueSnapshot.set(caller, this.revenuePerWeightedStake.value);
        }

        // Update stake amount
        const newStake: u256 = SafeMath.add(existing, amount);
        this.stakeAmount.set(caller, newStake);

        // For fresh stake, record block
        if (existing.isZero()) {
            this.stakeBlock.set(caller, u256.fromU64(Blockchain.block.number));
            this.stakeRevenueSnapshot.set(caller, this.revenuePerWeightedStake.value);
        }

        // Update totalWeightedStake with current multiplier
        const multiplier: u64 = this._getCurrentMultiplier(caller);
        const newWeighted: u256 = SafeMath.div(
            SafeMath.mul(newStake, u256.fromU64(multiplier)),
            u256.fromU64(MULTI_DENOM),
        );

        const oldWeighted: u256 = this.stakeWeightedSnapshot.get(caller);
        const currentTotal: u256 = this.totalWeightedStake.value;
        if (u256.gt(currentTotal, oldWeighted)) {
            this.totalWeightedStake.value = SafeMath.add(
                SafeMath.sub(currentTotal, oldWeighted),
                newWeighted,
            );
        } else {
            this.totalWeightedStake.value = newWeighted;
        }
        this.stakeWeightedSnapshot.set(caller, newWeighted);

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // unstake()
    @method()
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public unstake(_calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const origin: Address = Blockchain.tx.origin;

        if (!caller.equals(origin)) throw new Revert('CASAStaking: contract callers not allowed');

        const staked: u256 = this.stakeAmount.get(caller);
        if (staked.isZero()) throw new Revert('CASAStaking: no stake found');

        // AUDIT FIX: Checkpoint at start of unstake
        this._checkpointWeightedStake(caller);

        const pending: u256 = this._computePending(caller);

        // CEI: remove from totalWeightedStake
        const userWeighted: u256 = this.stakeWeightedSnapshot.get(caller);
        const currentTotal: u256 = this.totalWeightedStake.value;
        if (u256.gt(currentTotal, userWeighted)) {
            this.totalWeightedStake.value = SafeMath.sub(currentTotal, userWeighted);
        } else {
            this.totalWeightedStake.value = u256.Zero;
        }

        // Clear user state (multiplier resets to 1.0x)
        this.stakeAmount.set(caller, u256.Zero);
        this.stakeBlock.set(caller, u256.Zero);
        this.stakeWeightedSnapshot.set(caller, u256.Zero);
        this.stakeRevenueSnapshot.set(caller, this.revenuePerWeightedStake.value);

        // Return CASA stake
        const casaAddr: Address = this.casaToken.value;
        this._transfer(casaAddr, caller, staked);

        // Return MOTO rewards
        if (!pending.isZero()) {
            const motoAddr: Address = this.motoToken.value;
            this._transfer(motoAddr, caller, pending);
        }

        const w = new BytesWriter(32);
        w.writeU256(SafeMath.add(staked, pending));
        return w;
    }

    // claimRewards()
    @method()
    @returns({ name: 'rewards', type: ABIDataTypes.UINT256 })
    public claimRewards(_calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;

        const staked: u256 = this.stakeAmount.get(caller);
        if (staked.isZero()) throw new Revert('CASAStaking: no stake found');

        // AUDIT FIX: Checkpoint at start of claimRewards
        this._checkpointWeightedStake(caller);

        const pending: u256 = this._computePending(caller);
        if (pending.isZero()) throw new Revert('CASAStaking: no rewards to claim');

        // CEI: update snapshot before transfer
        this.stakeRevenueSnapshot.set(caller, this.revenuePerWeightedStake.value);

        const motoAddr: Address = this.motoToken.value;
        this._transfer(motoAddr, caller, pending);

        const w = new BytesWriter(32);
        w.writeU256(pending);
        return w;
    }

    // addRevenueShare(uint256) — CaseEngine only
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public addRevenueShare(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (this.caseEngine.value.isZero()) throw new Revert('CASAStaking: not configured');
        if (!caller.equals(this.caseEngine.value)) {
            throw new Revert('CASAStaking: only CaseEngine can add revenue');
        }

        const amount: u256 = calldata.readU256();
        if (amount.isZero()) throw new Revert('CASAStaking: revenue amount is zero');

        const totalWS: u256 = this.totalWeightedStake.value;
        if (!totalWS.isZero()) {
            const delta: u256 = SafeMath.div(
                SafeMath.mul(amount, DECIMAL_BASE),
                totalWS,
            );
            this.revenuePerWeightedStake.value = SafeMath.add(
                this.revenuePerWeightedStake.value,
                delta,
            );
        }

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // getTotalWeightedStake() — view (used by CaseEngine to check if stakers exist)
    @method()
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public getTotalWeightedStake(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this.totalWeightedStake.value);
        return w;
    }

    // getStakeInfo(address) — view
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'staked', type: ABIDataTypes.UINT256 })
    public getStakeInfo(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(32);
        w.writeU256(this.stakeAmount.get(addr));
        return w;
    }

    // getPendingRewards(address) — view
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'pending', type: ABIDataTypes.UINT256 })
    public getPendingRewards(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(32);
        w.writeU256(this._computePending(addr));
        return w;
    }

    // AUDIT FIX: Multiplier applied in reward computation
    private _computePending(user: Address): u256 {
        const amount: u256 = this.stakeAmount.get(user);
        if (amount.isZero()) return u256.Zero;

        // effectiveStake = stakeAmount * currentMultiplier / MULTI_DENOM
        const multiplier: u64 = this._getCurrentMultiplier(user);
        const effectiveStake: u256 = SafeMath.div(
            SafeMath.mul(amount, u256.fromU64(multiplier)),
            u256.fromU64(MULTI_DENOM),
        );

        const currentRPWS: u256 = this.revenuePerWeightedStake.value;
        const snapshot: u256 = this.stakeRevenueSnapshot.get(user);

        if (u256.le(currentRPWS, snapshot)) return u256.Zero;

        const delta: u256 = SafeMath.sub(currentRPWS, snapshot);
        return SafeMath.div(SafeMath.mul(effectiveStake, delta), DECIMAL_BASE);
    }

    // AUDIT FIX: Checkpoint pattern — update totalWeightedStake when multiplier changes
    private _checkpointWeightedStake(user: Address): void {
        const amount: u256 = this.stakeAmount.get(user);
        if (amount.isZero()) return;

        const multiplier: u64 = this._getCurrentMultiplier(user);
        const newWeighted: u256 = SafeMath.div(
            SafeMath.mul(amount, u256.fromU64(multiplier)),
            u256.fromU64(MULTI_DENOM),
        );

        const oldWeighted: u256 = this.stakeWeightedSnapshot.get(user);

        // If transitioning out of warmup (0 -> non-zero weight),
        // reset revenue snapshot so user only earns from NOW
        if (oldWeighted.isZero() && !newWeighted.isZero()) {
            this.stakeRevenueSnapshot.set(user, this.revenuePerWeightedStake.value);
        }

        const currentTotal: u256 = this.totalWeightedStake.value;
        if (u256.gt(currentTotal, oldWeighted)) {
            this.totalWeightedStake.value = SafeMath.add(
                SafeMath.sub(currentTotal, oldWeighted),
                newWeighted,
            );
        } else {
            this.totalWeightedStake.value = newWeighted;
        }

        this.stakeWeightedSnapshot.set(user, newWeighted);
    }

    private _getCurrentMultiplier(user: Address): u64 {
        const stakedAtU256: u256 = this.stakeBlock.get(user);
        if (stakedAtU256.isZero()) return 0; // no multiplier if not staked

        const stakedAt: u64 = stakedAtU256.toU64();
        const currentBlock: u64 = Blockchain.block.number;
        if (currentBlock < stakedAt) return 0;

        const elapsed: u64 = currentBlock - stakedAt;
        if (elapsed < BLOCKS_7D) return 0; // warmup: no multiplier for first 7 days
        if (elapsed >= BLOCKS_90D) return MULTI_90D;
        if (elapsed >= BLOCKS_30D) return MULTI_30D;
        return MULTI_7D;
    }

    private _transferFrom(token: Address, from: Address, to: Address, amount: u256): void {
        const sel: u32 = encodeSelector('transferFrom(address,address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(from);
        cd.writeAddress(to);
        cd.writeU256(amount);
        Blockchain.call(token, cd, true);
    }

    private _transfer(token: Address, to: Address, amount: u256): void {
        const sel: u32 = encodeSelector('transfer(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(to);
        cd.writeU256(amount);
        Blockchain.call(token, cd, true);
    }
}
