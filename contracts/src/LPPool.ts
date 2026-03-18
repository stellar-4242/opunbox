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

// LP Pool Contract
// Lock tiers: 0=7d (~1008 blocks), 1=30d (~4320), 2=90d (~12960)
// Tier weights: 7d=1000, 30d=1500, 90d=2500 (MULTI_DENOM=1000)
// Reserve: 20% always reserved
//
// AUDIT FIXES:
// - Additive deposits in same tier (extend lock, accumulate)
// - CEI: decrement totalDeposited BEFORE token transfer in pullPayout
// - _getAvailableBalance() is PRIVATE
// - addRevenue() increments totalDeposited

const BLOCKS_7D: u64 = 1008;
const BLOCKS_30D: u64 = 4320;
const BLOCKS_90D: u64 = 12960;
const WEIGHT_7D: u64 = 1000;
const WEIGHT_30D: u64 = 1500;
const WEIGHT_90D: u64 = 2500;
const MULTI_DENOM: u64 = 1000;
const RESERVE_BPS: u64 = 2000; // 20% reserve (out of 10000)
const MIN_POOL_THRESHOLD: u256 = u256.fromString('1000000000000000000000'); // 1000 MOTO * 10^18
const DECIMAL_BASE: u256 = u256.fromString('1000000000000000000'); // 10^18
const MIN_DEPOSIT: u256 = u256.fromString('10000000000000000000'); // 10 MOTO (10 * 10^18)


@final
export class LPPool extends OP_NET {
    // Config
    private readonly motoTokenPtr: u16 = Blockchain.nextPointer;
    private readonly casaTokenPtr: u16 = Blockchain.nextPointer;
    private readonly pointsContractPtr: u16 = Blockchain.nextPointer;
    private readonly caseEnginePtr: u16 = Blockchain.nextPointer;

    // Pool state
    private readonly totalDepositedPtr: u16 = Blockchain.nextPointer;
    private readonly totalWeightedSharesPtr: u16 = Blockchain.nextPointer;
    private readonly revenuePerSharePtr: u16 = Blockchain.nextPointer;

    // Per-address deposit state
    private readonly depositAmountPtr: u16 = Blockchain.nextPointer;
    private readonly depositUnlockBlockPtr: u16 = Blockchain.nextPointer;
    private readonly depositTierPtr: u16 = Blockchain.nextPointer;
    private readonly depositWeightedSharesPtr: u16 = Blockchain.nextPointer;
    private readonly depositRevenueSnapshotPtr: u16 = Blockchain.nextPointer;

    private readonly motoToken: StoredAddress = new StoredAddress(this.motoTokenPtr);
    private readonly casaToken: StoredAddress = new StoredAddress(this.casaTokenPtr);
    private readonly pointsContract: StoredAddress = new StoredAddress(this.pointsContractPtr);
    private readonly caseEngine: StoredAddress = new StoredAddress(this.caseEnginePtr);

    private readonly totalDeposited: StoredU256 = new StoredU256(this.totalDepositedPtr, EMPTY_POINTER);
    private readonly totalWeightedShares: StoredU256 = new StoredU256(this.totalWeightedSharesPtr, EMPTY_POINTER);
    // revenuePerShare * 10^18 for fixed-point
    private readonly revenuePerShare: StoredU256 = new StoredU256(this.revenuePerSharePtr, EMPTY_POINTER);

    private readonly depositAmount: AddressMemoryMap = new AddressMemoryMap(this.depositAmountPtr);
    private readonly depositUnlockBlock: AddressMemoryMap = new AddressMemoryMap(this.depositUnlockBlockPtr);
    private readonly depositTier: AddressMemoryMap = new AddressMemoryMap(this.depositTierPtr);
    private readonly depositWeightedShares: AddressMemoryMap = new AddressMemoryMap(this.depositWeightedSharesPtr);
    private readonly depositRevenueSnapshot: AddressMemoryMap = new AddressMemoryMap(this.depositRevenueSnapshotPtr);

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        const motoAddr: Address = _calldata.readAddress();
        const casaAddr: Address = _calldata.readAddress();
        const pointsAddr: Address = _calldata.readAddress();
        const caseEngineAddr: Address = _calldata.readAddress();

        if (!motoAddr.isZero()) this.motoToken.value = motoAddr;
        if (!casaAddr.isZero()) this.casaToken.value = casaAddr;
        if (!pointsAddr.isZero()) this.pointsContract.value = pointsAddr;
        if (!caseEngineAddr.isZero()) this.caseEngine.value = caseEngineAddr;
    }

    // deposit(uint256,uint8) — EOA only
    @method(
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'lockTier', type: ABIDataTypes.UINT8 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public deposit(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const origin: Address = Blockchain.tx.origin;

        if (!caller.equals(origin)) throw new Revert('LPPool: contract callers not allowed');

        const amount: u256 = calldata.readU256();
        const tier: u8 = calldata.readU8();

        if (amount.isZero()) throw new Revert('LPPool: deposit amount is zero');
        if (u256.lt(amount, MIN_DEPOSIT)) throw new Revert('LPPool: deposit below minimum');
        if (tier > 2) throw new Revert('LPPool: invalid lock tier');

        // Transfer MOTO from caller
        const motoAddr: Address = this.motoToken.value;
        this._transferFrom(motoAddr, caller, Blockchain.contractAddress, amount);

        // Settle pending revenue before modifying shares
        const existingAmount: u256 = this.depositAmount.get(caller);
        const existingShares: u256 = this.depositWeightedShares.get(caller);
        const existingTier: u8 = existingAmount.isZero() ? tier : u8(this.depositTier.get(caller).toU64());

        // AUDIT FIX: Additive deposits — allow second deposit, extend lock
        if (!existingShares.isZero()) {
            const pending: u256 = this._computePendingRevenue(caller);
            if (!pending.isZero()) {
                // Auto-compound pending into deposit amount
                this.depositAmount.set(caller, SafeMath.add(existingAmount, pending));
                // MAJOR-2 FIX: also increment totalDeposited by the compounded amount
                this.totalDeposited.value = SafeMath.add(this.totalDeposited.value, pending);
            }
        }

        // Use higher tier (upgrade allowed on additive deposit)
        const effectiveTier: u8 = tier > existingTier ? tier : existingTier;
        const tierWeight: u64 = this._getTierWeight(effectiveTier);
        const lockBlocks: u64 = this._getTierLockBlocks(effectiveTier);

        const updatedAmount: u256 = SafeMath.add(this.depositAmount.get(caller), amount);

        // New weighted shares = updatedAmount * tierWeight / MULTI_DENOM
        const newWeightedShares: u256 = SafeMath.div(
            SafeMath.mul(updatedAmount, u256.fromU64(tierWeight)),
            u256.fromU64(MULTI_DENOM),
        );

        // Update total weighted shares (remove old, add new)
        const currentTotal: u256 = this.totalWeightedShares.value;
        if (u256.gt(currentTotal, existingShares)) {
            this.totalWeightedShares.value = SafeMath.add(
                SafeMath.sub(currentTotal, existingShares),
                newWeightedShares,
            );
        } else {
            this.totalWeightedShares.value = newWeightedShares;
        }

        // Persist deposit state
        this.depositAmount.set(caller, updatedAmount);
        this.depositTier.set(caller, u256.fromU32(u32(effectiveTier)));
        this.depositWeightedShares.set(caller, newWeightedShares);
        this.depositUnlockBlock.set(caller, u256.fromU64(Blockchain.block.number + lockBlocks));
        this.depositRevenueSnapshot.set(caller, this.revenuePerShare.value);

        // Update total deposited
        this.totalDeposited.value = SafeMath.add(this.totalDeposited.value, amount);

        // Emit CASA for LP (optional, mustSucceed=false)
        this._mintCASAForLP(caller, amount);

        // Credit points for LP (optional, mustSucceed=false)
        this._creditPointsForLP(caller, amount, lockBlocks);

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // withdraw()
    @method()
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public withdraw(_calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const origin: Address = Blockchain.tx.origin;

        if (!caller.equals(origin)) throw new Revert('LPPool: contract callers not allowed');

        const depositAmt: u256 = this.depositAmount.get(caller);
        if (depositAmt.isZero()) throw new Revert('LPPool: no deposit found');

        // Check lock period
        const unlockBlock: u64 = this.depositUnlockBlock.get(caller).toU64();
        if (Blockchain.block.number < unlockBlock) throw new Revert('LPPool: deposit still locked');

        const pending: u256 = this._computePendingRevenue(caller);
        const totalPayout: u256 = SafeMath.add(depositAmt, pending);

        // Check reserve ratio
        if (u256.gt(totalPayout, this._getAvailableBalance())) {
            throw new Revert('LPPool: withdrawal would breach reserve ratio');
        }

        // CEI: effects first
        const userShares: u256 = this.depositWeightedShares.get(caller);
        const currentTotal: u256 = this.totalWeightedShares.value;
        if (u256.gt(currentTotal, userShares)) {
            this.totalWeightedShares.value = SafeMath.sub(currentTotal, userShares);
        } else {
            this.totalWeightedShares.value = u256.Zero;
        }

        this.depositAmount.set(caller, u256.Zero);
        this.depositWeightedShares.set(caller, u256.Zero);
        this.depositUnlockBlock.set(caller, u256.Zero);
        this.depositTier.set(caller, u256.Zero);
        this.depositRevenueSnapshot.set(caller, u256.Zero);

        if (u256.gt(this.totalDeposited.value, totalPayout)) {
            this.totalDeposited.value = SafeMath.sub(this.totalDeposited.value, totalPayout);
        } else {
            this.totalDeposited.value = u256.Zero;
        }

        // Interaction last
        const motoAddr: Address = this.motoToken.value;
        this._transfer(motoAddr, caller, totalPayout);

        const w = new BytesWriter(32);
        w.writeU256(totalPayout);
        return w;
    }

    // pullPayout(address,uint256) — CaseEngine only
    @method(
        { name: 'recipient', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public pullPayout(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (this.caseEngine.value.isZero()) throw new Revert('LPPool: not configured');
        if (!caller.equals(this.caseEngine.value)) {
            throw new Revert('LPPool: only CaseEngine can pull payouts');
        }

        const recipient: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        if (recipient.isZero()) throw new Revert('LPPool: payout to zero address');
        if (amount.isZero()) throw new Revert('LPPool: payout amount is zero');

        if (u256.gt(amount, this._getAvailableBalance())) {
            throw new Revert('LPPool: payout exceeds available balance');
        }

        // AUDIT FIX: CEI — decrement totalDeposited BEFORE token transfer
        if (u256.gt(this.totalDeposited.value, amount)) {
            this.totalDeposited.value = SafeMath.sub(this.totalDeposited.value, amount);
        } else {
            this.totalDeposited.value = u256.Zero;
        }

        const motoAddr: Address = this.motoToken.value;
        this._transfer(motoAddr, recipient, amount);

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // addPrincipal(uint256) — CaseEngine only
    // Tracks net bet principal flowing into the pool (NOT distributed as LP revenue).
    // Only increments totalDeposited so the pool ledger stays in sync with actual MOTO held.
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public addPrincipal(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (this.caseEngine.value.isZero()) throw new Revert('LPPool: not configured');
        if (!caller.equals(this.caseEngine.value)) {
            throw new Revert('LPPool: only CaseEngine can add principal');
        }

        const amount: u256 = calldata.readU256();
        if (amount.isZero()) throw new Revert('LPPool: principal amount is zero');

        // Track pool working capital — NOT distributed to LPs via revenuePerShare
        this.totalDeposited.value = SafeMath.add(this.totalDeposited.value, amount);

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // addRevenue(uint256) — CaseEngine only
    // Tracks actual LP revenue (house edge LP share). Increments totalDeposited AND
    // distributes to LPs via revenuePerShare accumulator.
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public addRevenue(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (this.caseEngine.value.isZero()) throw new Revert('LPPool: not configured');
        if (!caller.equals(this.caseEngine.value)) {
            throw new Revert('LPPool: only CaseEngine can add revenue');
        }

        const amount: u256 = calldata.readU256();
        if (amount.isZero()) throw new Revert('LPPool: revenue amount is zero');

        // Track the MOTO that physically entered the pool
        this.totalDeposited.value = SafeMath.add(this.totalDeposited.value, amount);

        // Distribute ONLY house edge LP share to LPs via revenuePerShare
        const totalShares: u256 = this.totalWeightedShares.value;
        if (!totalShares.isZero()) {
            const delta: u256 = SafeMath.div(
                SafeMath.mul(amount, DECIMAL_BASE),
                totalShares,
            );
            this.revenuePerShare.value = SafeMath.add(this.revenuePerShare.value, delta);
        }

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // getTotalDeposited() — view
    @method()
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public getTotalDeposited(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this.totalDeposited.value);
        return w;
    }

    // getAvailableBalance() — public view (AUDIT FIX: private computation is internal)
    @method()
    @returns({ name: 'available', type: ABIDataTypes.UINT256 })
    public getAvailableBalance(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this._getAvailableBalance());
        return w;
    }

    // getDepositInfo(address) — view
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public getDepositInfo(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(32);
        w.writeU256(this.depositAmount.get(addr));
        return w;
    }

    // isAboveMinimum() — view
    @method()
    @returns({ name: 'above', type: ABIDataTypes.BOOL })
    public isAboveMinimum(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(1);
        w.writeBoolean(u256.ge(this.totalDeposited.value, MIN_POOL_THRESHOLD));
        return w;
    }

    // AUDIT FIX: PRIVATE — not exposed
    private _getAvailableBalance(): u256 {
        const total: u256 = this.totalDeposited.value;
        if (total.isZero()) return u256.Zero;
        // available = total * 80% = total * (10000 - RESERVE_BPS) / 10000
        return SafeMath.div(
            SafeMath.mul(total, u256.fromU64(10000 - RESERVE_BPS)),
            u256.fromU64(10000),
        );
    }

    private _computePendingRevenue(user: Address): u256 {
        const userShares: u256 = this.depositWeightedShares.get(user);
        if (userShares.isZero()) return u256.Zero;

        const currentRPS: u256 = this.revenuePerShare.value;
        const userSnapshot: u256 = this.depositRevenueSnapshot.get(user);

        if (u256.le(currentRPS, userSnapshot)) return u256.Zero;

        const delta: u256 = SafeMath.sub(currentRPS, userSnapshot);
        return SafeMath.div(SafeMath.mul(userShares, delta), DECIMAL_BASE);
    }

    private _getTierLockBlocks(tier: u8): u64 {
        if (tier == 0) return BLOCKS_7D;
        if (tier == 1) return BLOCKS_30D;
        return BLOCKS_90D;
    }

    private _getTierWeight(tier: u8): u64 {
        if (tier == 0) return WEIGHT_7D;
        if (tier == 1) return WEIGHT_30D;
        return WEIGHT_90D;
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

    private _mintCASAForLP(to: Address, amount: u256): void {
        const casaAddr: Address = this.casaToken.value;
        if (casaAddr.isZero()) return;

        // Query CASAToken for boost-aware emission rate (includes 3x early LP boost)
        const rateSel: u32 = encodeSelector('computeEmissionWithBoost()');
        const rateCalldata = new BytesWriter(4);
        rateCalldata.writeSelector(rateSel);
        const rateResult = Blockchain.call(casaAddr, rateCalldata, false);
        if (!rateResult.success) return;

        const rate: u256 = rateResult.data.readU256();
        if (rate.isZero()) return;

        // emission = amount * rate / EMISSION_DENOM
        // EMISSION_DENOM = 1_000_000: with initial rate=1000, emission = amount * 1000 / 1_000_000 = amount / 1000
        // With 3x early boost rate=3000, emission = amount * 3000 / 1_000_000 = amount * 3 / 1000
        const emission: u256 = SafeMath.div(
            SafeMath.mul(amount, rate),
            u256.fromU64(1_000_000),
        );
        if (emission.isZero()) return;

        const mintSel: u32 = encodeSelector('mint(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(mintSel);
        cd.writeAddress(to);
        cd.writeU256(emission);
        Blockchain.call(casaAddr, cd, false);
    }

    private _creditPointsForLP(to: Address, amount: u256, lockBlocks: u64): void {
        const pointsAddr: Address = this.pointsContract.value;
        if (pointsAddr.isZero()) return;
        const pts: u256 = SafeMath.div(
            SafeMath.mul(amount, u256.fromU64(lockBlocks)),
            u256.fromU64(BLOCKS_7D),
        );
        if (pts.isZero()) return;
        const sel: u32 = encodeSelector('addPoints(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(to);
        cd.writeU256(pts);
        Blockchain.call(pointsAddr, cd, false);
    }
}
