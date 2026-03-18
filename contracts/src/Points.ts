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
    StoredBoolean,
    StoredU256,
    encodeSelector,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Points Contract — extends OP_NET (NOT OP-20)
// On-chain point balances, referrals, airdrop claim
// AUDIT FIX: triggerAirdrop requires minimum delay (~129,600 blocks / 30 days)

const AIRDROP_DELAY_BLOCKS: u64 = 129600; // ~30 days
const REFERRAL_PERCENT_NUM: u64 = 10; // 10%
const REFERRAL_PERCENT_DEN: u64 = 100;
const AIRDROP_RESERVE: u256 = u256.fromString('100000000000000000000000000'); // 100M CASA * 10^18


@final
export class Points extends OP_NET {
    private readonly deploymentBlockPtr: u16 = Blockchain.nextPointer;
    private readonly totalPointsPtr: u16 = Blockchain.nextPointer;
    private readonly airdropTriggeredPtr: u16 = Blockchain.nextPointer;
    private readonly authorizedPtr: u16 = Blockchain.nextPointer;
    private readonly pointsPtr: u16 = Blockchain.nextPointer;
    private readonly referrersPtr: u16 = Blockchain.nextPointer;
    private readonly airdropClaimedPtr: u16 = Blockchain.nextPointer;
    private readonly casaTokenPtr: u16 = Blockchain.nextPointer;

    private readonly deploymentBlock: StoredU256 = new StoredU256(this.deploymentBlockPtr, EMPTY_POINTER);
    private readonly totalPointsStored: StoredU256 = new StoredU256(this.totalPointsPtr, EMPTY_POINTER);
    private readonly airdropTriggered: StoredBoolean = new StoredBoolean(this.airdropTriggeredPtr, false);
    private readonly casaTokenAddress: StoredAddress = new StoredAddress(this.casaTokenPtr);

    // authorized contracts: address => 1/0
    private readonly authorized: AddressMemoryMap = new AddressMemoryMap(this.authorizedPtr);
    // per-address points: address => u256
    private readonly points: AddressMemoryMap = new AddressMemoryMap(this.pointsPtr);
    // per-address referrer (stored as address bytes interpreted as u256): address => u256
    private readonly referrers: AddressMemoryMap = new AddressMemoryMap(this.referrersPtr);
    // per-address airdrop claimed: address => 1/0
    private readonly airdropClaimed: AddressMemoryMap = new AddressMemoryMap(this.airdropClaimedPtr);

    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        // AUDIT FIX: Store deployment block for airdrop delay enforcement
        this.deploymentBlock.value = u256.fromU64(Blockchain.block.number);

        // Parse: [uint8 count, address1, ..., casaTokenAddress]
        const count: u8 = _calldata.readU8();
        for (let i: u8 = 0; i < count; i++) {
            const addr: Address = _calldata.readAddress();
            if (!addr.isZero()) {
                this.authorized.set(addr, u256.One);
            }
        }

        const casaAddr: Address = _calldata.readAddress();
        if (!casaAddr.isZero()) {
            this.casaTokenAddress.value = casaAddr;
        }
    }

    // addPoints(address,uint256) — authorized only
    @method(
        { name: 'recipient', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public addPoints(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        if (!this._checkAuthorized(caller)) {
            throw new Revert('Points: caller not authorized');
        }

        const recipient: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        this._creditPoints(recipient, amount);

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // getPoints(address) — public view
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'points', type: ABIDataTypes.UINT256 })
    public getPoints(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(32);
        w.writeU256(this.points.get(addr));
        return w;
    }

    // setReferrer(address) — one-time, self-set
    @method({ name: 'referrer', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setReferrer(calldata: Calldata): BytesWriter {
        const caller: Address = Blockchain.tx.sender;
        const referrer: Address = calldata.readAddress();

        if (referrer.isZero()) throw new Revert('Points: referrer is zero address');
        if (caller.equals(referrer)) throw new Revert('Points: cannot refer yourself');

        // Check not already set: store referrer address bytes as u256
        const existing: u256 = this.referrers.get(caller);
        if (!existing.isZero()) throw new Revert('Points: referrer already set');

        // Reject circular referrals: check whether the proposed referrer has already set
        // the caller as THEIR referrer. A -> B then B -> A would inflate both shares.
        const reverseRef: u256 = this.referrers.get(referrer);
        if (!reverseRef.isZero()) {
            const rawBytes: Uint8Array = reverseRef.toUint8Array(true);
            const refBytes: Uint8Array = new Uint8Array(32);
            const offset: i32 = 32 - rawBytes.length;
            for (let i: i32 = 0; i < rawBytes.length; i++) {
                refBytes[offset + i] = rawBytes[i];
            }
            const reverseAddr: Address = Address.fromUint8Array(refBytes);
            if (reverseAddr.equals(caller)) {
                throw new Revert('Points: circular referral not allowed');
            }
        }

        // Store referrer address as u256 (use fromUint8ArrayBE for Address bytes)
        this.referrers.set(caller, u256.fromUint8ArrayBE(referrer));

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // claimAirdrop() — after trigger
    @method()
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public claimAirdrop(_calldata: Calldata): BytesWriter {
        if (!this.airdropTriggered.value) {
            throw new Revert('Points: airdrop not triggered yet');
        }

        const caller: Address = Blockchain.tx.sender;

        if (!this.airdropClaimed.get(caller).isZero()) {
            throw new Revert('Points: airdrop already claimed');
        }

        const userPoints: u256 = this.points.get(caller);
        if (userPoints.isZero()) throw new Revert('Points: no points to claim');

        const total: u256 = this.totalPointsStored.value;
        if (total.isZero()) throw new Revert('Points: total points is zero');

        // allocation = userPoints * AIRDROP_RESERVE / total
        const allocation: u256 = SafeMath.div(
            SafeMath.mul(userPoints, AIRDROP_RESERVE),
            total,
        );
        if (allocation.isZero()) throw new Revert('Points: allocation rounds to zero');

        // CEI: mark claimed BEFORE cross-contract call
        this.airdropClaimed.set(caller, u256.One);

        // Mint CASA — mustSucceed=true so user doesn't lose their airdrop if mint fails
        const casaAddr: Address = this.casaTokenAddress.value;
        if (casaAddr.isZero()) throw new Revert('Points: CASA token not configured');
        const mintSelector: u32 = encodeSelector('mint(address,uint256)');
        const mintCalldata = new BytesWriter(4 + 32 + 32);
        mintCalldata.writeSelector(mintSelector);
        mintCalldata.writeAddress(caller);
        mintCalldata.writeU256(allocation);
        Blockchain.call(casaAddr, mintCalldata, true);

        const w = new BytesWriter(32);
        w.writeU256(allocation);
        return w;
    }

    // triggerAirdrop() — permissionless after delay
    @method()
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public triggerAirdrop(_calldata: Calldata): BytesWriter {
        if (this.airdropTriggered.value) {
            throw new Revert('Points: airdrop already triggered');
        }

        // AUDIT FIX: Enforce minimum block delay
        const currentBlock: u64 = Blockchain.block.number;
        const deployBlock: u64 = this.deploymentBlock.value.toU64();
        const elapsed: u64 = currentBlock - deployBlock;

        if (elapsed < AIRDROP_DELAY_BLOCKS) {
            throw new Revert('Points: airdrop delay not elapsed');
        }

        this.airdropTriggered.value = true;

        const w = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // totalPoints() — view
    @method()
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public totalPoints(_calldata: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this.totalPointsStored.value);
        return w;
    }

    // isAuthorized(address) — view
    @method({ name: 'addr', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'authorized', type: ABIDataTypes.BOOL })
    public isAuthorized(calldata: Calldata): BytesWriter {
        const addr: Address = calldata.readAddress();
        const w = new BytesWriter(1);
        w.writeBoolean(this._checkAuthorized(addr));
        return w;
    }

    private _creditPoints(recipient: Address, amount: u256): void {
        if (recipient.isZero() || amount.isZero()) return;

        const existing: u256 = this.points.get(recipient);
        this.points.set(recipient, SafeMath.add(existing, amount));
        this.totalPointsStored.value = SafeMath.add(this.totalPointsStored.value, amount);

        // Credit referrer 10% bonus
        const referrerU256: u256 = this.referrers.get(recipient);
        if (!referrerU256.isZero()) {
            // Safe round-trip: u256.toUint8Array(true) returns big-endian bytes.
            // Pad to 32 bytes if shorter to ensure Address.fromUint8Array gets full address.
            const rawBytes: Uint8Array = referrerU256.toUint8Array(true);
            const referrerBytes: Uint8Array = new Uint8Array(32);
            const offset: i32 = 32 - rawBytes.length;
            for (let i: i32 = 0; i < rawBytes.length; i++) {
                referrerBytes[offset + i] = rawBytes[i];
            }
            const referrerAddr: Address = Address.fromUint8Array(referrerBytes);
            if (!referrerAddr.isZero()) {
                const bonus: u256 = SafeMath.div(
                    SafeMath.mul(amount, u256.fromU64(REFERRAL_PERCENT_NUM)),
                    u256.fromU64(REFERRAL_PERCENT_DEN),
                );
                if (!bonus.isZero()) {
                    const rBal: u256 = this.points.get(referrerAddr);
                    this.points.set(referrerAddr, SafeMath.add(rBal, bonus));
                    this.totalPointsStored.value = SafeMath.add(this.totalPointsStored.value, bonus);
                }
            }
        }
    }

    private _checkAuthorized(addr: Address): bool {
        if (addr.isZero()) return false;
        return !this.authorized.get(addr).isZero();
    }
}
