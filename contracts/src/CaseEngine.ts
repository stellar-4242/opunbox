import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Revert,
    SafeMath,
    StoredAddress,
    encodeSelector,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Case Engine — orchestrator
// AUDIT FIXES:
// - Per-address nonce (NOT global). Include caller address + nonce in hash.
//   hash(blockHash + userSeed + callerAddress + perAddressNonce)
//   Nonce incremented BEFORE hash computation
// - Max bet = 1% of TOTAL pool; max payout = 5% of AVAILABLE balance
// - Revenue distribution Blockchain.calls use mustSucceed=TRUE
// - Optional side-effects (points, CASA) use mustSucceed=false
// - After sending net to LP pool, also call addRevenue

const HOUSE_EDGE_BPS: u64 = 500;    // 5%
const LP_SHARE_BPS: u64 = 6000;     // 60%
const STAKING_SHARE_BPS: u64 = 3000; // 30%
// Treasury = 10% (remainder)
const MAX_BET_BPS: u64 = 100;       // 1% of total pool
const MAX_PAYOUT_BPS: u64 = 500;    // 5% of available balance
const WIN_THRESHOLD: u64 = 4750;    // ~47.5% win rate out of 10000


@final
export class CaseEngine extends OP_NET {
    private readonly motoTokenPtr: u16 = Blockchain.nextPointer;
    private readonly casaTokenPtr: u16 = Blockchain.nextPointer;
    private readonly lpPoolPtr: u16 = Blockchain.nextPointer;
    private readonly casaStakingPtr: u16 = Blockchain.nextPointer;
    private readonly pointsContractPtr: u16 = Blockchain.nextPointer;
    private readonly treasuryPtr: u16 = Blockchain.nextPointer;

    // AUDIT FIX: per-address nonce
    private readonly noncePtr: u16 = Blockchain.nextPointer;

    private readonly motoToken: StoredAddress = new StoredAddress(this.motoTokenPtr);
    private readonly casaToken: StoredAddress = new StoredAddress(this.casaTokenPtr);
    private readonly lpPool: StoredAddress = new StoredAddress(this.lpPoolPtr);
    private readonly casaStaking: StoredAddress = new StoredAddress(this.casaStakingPtr);
    private readonly pointsContract: StoredAddress = new StoredAddress(this.pointsContractPtr);
    private readonly treasury: StoredAddress = new StoredAddress(this.treasuryPtr);

    // AUDIT FIX: per-address nonce map
    private readonly nonces: AddressMemoryMap = new AddressMemoryMap(this.noncePtr);

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        // No cross-contract calls here (FORBIDDEN in onDeployment)
        const motoAddr: Address = _calldata.readAddress();
        const casaAddr: Address = _calldata.readAddress();
        const lpPoolAddr: Address = _calldata.readAddress();
        const stakingAddr: Address = _calldata.readAddress();
        const pointsAddr: Address = _calldata.readAddress();
        const treasuryAddr: Address = _calldata.readAddress();

        if (!motoAddr.isZero()) this.motoToken.value = motoAddr;
        if (!casaAddr.isZero()) this.casaToken.value = casaAddr;
        if (!lpPoolAddr.isZero()) this.lpPool.value = lpPoolAddr;
        if (!stakingAddr.isZero()) this.casaStaking.value = stakingAddr;
        if (!pointsAddr.isZero()) this.pointsContract.value = pointsAddr;
        if (!treasuryAddr.isZero()) this.treasury.value = treasuryAddr;
    }

    // openCase(uint256,bytes32) — EOA only
    @method(
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'userSeed', type: ABIDataTypes.BYTES32 },
    )
    @returns({ name: 'won', type: ABIDataTypes.BOOL })
    public openCase(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const origin: Address = Blockchain.tx.origin;

        // Block contract callers
        if (!caller.equals(origin)) throw new Revert('CaseEngine: contract callers not allowed');

        const betAmount: u256 = calldata.readU256();
        const userSeed: Uint8Array = calldata.readBytes(32);

        if (betAmount.isZero()) throw new Revert('CaseEngine: bet amount is zero');

        const lpPoolAddr: Address = this.lpPool.value;

        // Check pool above minimum
        if (!this._checkPoolAboveMinimum(lpPoolAddr)) {
            throw new Revert('CaseEngine: pool below minimum threshold');
        }

        // AUDIT FIX: Max bet = 1% of TOTAL pool
        const totalPool: u256 = this._getTotalPoolBalance(lpPoolAddr);
        const maxBet: u256 = SafeMath.div(
            SafeMath.mul(totalPool, u256.fromU64(MAX_BET_BPS)),
            u256.fromU64(10000),
        );
        if (u256.gt(betAmount, maxBet)) throw new Revert('CaseEngine: bet exceeds max bet cap');

        // AUDIT FIX: Max payout = 5% of AVAILABLE balance
        const availBal: u256 = this._getAvailablePoolBalance(lpPoolAddr);
        const maxPayout: u256 = SafeMath.div(
            SafeMath.mul(availBal, u256.fromU64(MAX_PAYOUT_BPS)),
            u256.fromU64(10000),
        );

        // CEI FIX (NEW-H4): Increment nonce BEFORE any external interaction
        const currentNonce: u256 = this.nonces.get(caller);
        const newNonce: u256 = SafeMath.add(currentNonce, u256.One);
        this.nonces.set(caller, newNonce);

        // Transfer MOTO from player (interaction comes after state update)
        const motoAddr: Address = this.motoToken.value;
        this._transferFrom(motoAddr, caller, Blockchain.contractAddress, betAmount);

        // RNG: sha256(blockHash + userSeed + callerAddress + perAddressNonce)
        const blockHash: Uint8Array = Blockchain.getBlockHash(Blockchain.block.number - 1);
        const randomValue: u256 = this._computeRandom(blockHash, userSeed, caller, newNonce);

        // roll = randomValue % 10000
        const roll: u256 = SafeMath.mod(randomValue, u256.fromU64(10000));
        const won: bool = u256.lt(roll, u256.fromU64(WIN_THRESHOLD));

        // houseEdge = betAmount * 5%
        const houseEdge: u256 = SafeMath.div(
            SafeMath.mul(betAmount, u256.fromU64(HOUSE_EDGE_BPS)),
            u256.fromU64(10000),
        );

        if (won) {
            // Pool pays: betAmount - houseEdge (net payout from pool)
            const payoutFromPool: u256 = SafeMath.sub(betAmount, houseEdge);

            if (u256.gt(payoutFromPool, maxPayout)) {
                throw new Revert('CaseEngine: payout exceeds max payout cap');
            }

            // Distribute house edge first
            this._distributeHouseEdge(houseEdge, lpPoolAddr);

            // Pool pays out: net bet (95%). Player's return IS the pool payout.
            // NEW-C1 FIX: Do NOT also return betAmount — that is a double-spend.
            this._pullPayoutFromPool(lpPoolAddr, caller, payoutFromPool);
        } else {
            // Player loses — distribute house edge
            this._distributeHouseEdge(houseEdge, lpPoolAddr);

            // Remaining (95% of bet) goes to LP pool
            const netToLP: u256 = SafeMath.sub(betAmount, houseEdge);
            // AUDIT FIX: Send to LP + call addRevenue to update totalDeposited
            this._transfer(motoAddr, lpPoolAddr, netToLP);
            this._addRevenueToPool(lpPoolAddr, netToLP);
        }

        // Optional side-effects — mustSucceed=false
        this._mintCASAForPlayer(caller, betAmount);
        this._creditPointsForWager(caller, betAmount);

        const w = new BytesWriter(1);
        w.writeBoolean(won);
        return w;
    }

    // getPoolInfo() — view
    @method()
    @returns({ name: 'totalDeposited', type: ABIDataTypes.UINT256 })
    public getPoolInfo(_calldata: Calldata): BytesWriter {
        const lpPoolAddr: Address = this.lpPool.value;
        const total: u256 = lpPoolAddr.isZero() ? u256.Zero : this._getTotalPoolBalance(lpPoolAddr);
        const w = new BytesWriter(32);
        w.writeU256(total);
        return w;
    }

    private _distributeHouseEdge(houseEdge: u256, lpPoolAddr: Address): void {
        if (houseEdge.isZero()) return;

        const motoAddr: Address = this.motoToken.value;
        const stakingAddr: Address = this.casaStaking.value;
        const treasuryAddr: Address = this.treasury.value;

        // LP 60%
        const lpShare: u256 = SafeMath.div(
            SafeMath.mul(houseEdge, u256.fromU64(LP_SHARE_BPS)),
            u256.fromU64(10000),
        );

        // Staking 30%
        const stakingShare: u256 = SafeMath.div(
            SafeMath.mul(houseEdge, u256.fromU64(STAKING_SHARE_BPS)),
            u256.fromU64(10000),
        );

        // Treasury 10% (remainder avoids rounding dust)
        const treasuryShare: u256 = SafeMath.sub(houseEdge, SafeMath.add(lpShare, stakingShare));

        // AUDIT FIX: Revenue distribution mustSucceed=TRUE
        if (!lpShare.isZero()) {
            this._transfer(motoAddr, lpPoolAddr, lpShare);
            this._addRevenueToPool(lpPoolAddr, lpShare);
        }

        if (!stakingShare.isZero() && !stakingAddr.isZero()) {
            this._transfer(motoAddr, stakingAddr, stakingShare);
            this._addRevenueToStaking(stakingAddr, stakingShare);
        }

        if (!treasuryShare.isZero() && !treasuryAddr.isZero()) {
            this._transfer(motoAddr, treasuryAddr, treasuryShare);
        }
    }

    // AUDIT FIX: hash includes callerAddress + per-address nonce
    private _computeRandom(
        blockHash: Uint8Array,
        userSeed: Uint8Array,
        caller: Address,
        nonce: u256,
    ): u256 {
        // 32 + 32 + 32 + 32 = 128 bytes
        const data = new Uint8Array(128);

        for (let i = 0; i < 32 && i < blockHash.length; i++) {
            data[i] = blockHash[i];
        }
        for (let i = 0; i < 32 && i < userSeed.length; i++) {
            data[32 + i] = userSeed[i];
        }

        // Write caller bytes (32 bytes)
        for (let i = 0; i < 32 && i < caller.length; i++) {
            data[64 + i] = caller[i];
        }

        // Write nonce as big-endian bytes
        const nonceBytes: Uint8Array = nonce.toUint8Array(true);
        for (let i = 0; i < 32 && i < nonceBytes.length; i++) {
            data[96 + i] = nonceBytes[i];
        }

        const hashBytes: Uint8Array = Blockchain.sha256(data);
        return u256.fromUint8ArrayBE(hashBytes);
    }

    private _checkPoolAboveMinimum(lpPool: Address): bool {
        if (lpPool.isZero()) return false;
        const sel: u32 = encodeSelector('isAboveMinimum()');
        const cd = new BytesWriter(4);
        cd.writeSelector(sel);
        const result = Blockchain.call(lpPool, cd, true);
        return result.data.readBoolean();
    }

    private _getTotalPoolBalance(lpPool: Address): u256 {
        if (lpPool.isZero()) return u256.Zero;
        const sel: u32 = encodeSelector('getTotalDeposited()');
        const cd = new BytesWriter(4);
        cd.writeSelector(sel);
        const result = Blockchain.call(lpPool, cd, true);
        return result.data.readU256();
    }

    private _getAvailablePoolBalance(lpPool: Address): u256 {
        if (lpPool.isZero()) return u256.Zero;
        const sel: u32 = encodeSelector('getAvailableBalance()');
        const cd = new BytesWriter(4);
        cd.writeSelector(sel);
        const result = Blockchain.call(lpPool, cd, true);
        return result.data.readU256();
    }

    private _pullPayoutFromPool(lpPool: Address, recipient: Address, amount: u256): void {
        const sel: u32 = encodeSelector('pullPayout(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(recipient);
        cd.writeU256(amount);
        // AUDIT FIX: mustSucceed=TRUE
        Blockchain.call(lpPool, cd, true);
    }

    private _addRevenueToPool(lpPool: Address, amount: u256): void {
        const sel: u32 = encodeSelector('addRevenue(uint256)');
        const cd = new BytesWriter(4 + 32);
        cd.writeSelector(sel);
        cd.writeU256(amount);
        // AUDIT FIX: mustSucceed=TRUE
        Blockchain.call(lpPool, cd, true);
    }

    private _addRevenueToStaking(stakingAddr: Address, amount: u256): void {
        const sel: u32 = encodeSelector('addRevenueShare(uint256)');
        const cd = new BytesWriter(4 + 32);
        cd.writeSelector(sel);
        cd.writeU256(amount);
        // AUDIT FIX: mustSucceed=TRUE
        Blockchain.call(stakingAddr, cd, true);
    }

    private _mintCASAForPlayer(to: Address, betAmount: u256): void {
        const casaAddr: Address = this.casaToken.value;
        if (casaAddr.isZero()) return;
        const emission: u256 = SafeMath.div(betAmount, u256.fromU64(1000));
        if (emission.isZero()) return;
        const sel: u32 = encodeSelector('mint(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(to);
        cd.writeU256(emission);
        // AUDIT FIX: Optional side-effect — mustSucceed=false
        Blockchain.call(casaAddr, cd, false);
    }

    private _creditPointsForWager(to: Address, betAmount: u256): void {
        const pointsAddr: Address = this.pointsContract.value;
        if (pointsAddr.isZero()) return;
        // 1 point per 0.001 MOTO (per 10^15 smallest units)
        const pts: u256 = SafeMath.div(betAmount, u256.fromString('1000000000000000'));
        if (pts.isZero()) return;
        const sel: u32 = encodeSelector('addPoints(address,uint256)');
        const cd = new BytesWriter(4 + 32 + 32);
        cd.writeSelector(sel);
        cd.writeAddress(to);
        cd.writeU256(pts);
        // AUDIT FIX: Optional side-effect — mustSucceed=false
        Blockchain.call(pointsAddr, cd, false);
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
