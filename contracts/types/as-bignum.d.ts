// Type stub for @btc-vision/as-bignum/assembly
// AssemblyScript u256 is compiled by asc — this stub satisfies tsc.

declare module '@btc-vision/as-bignum/assembly' {
    class u256 {
        static Zero: u256;
        static One: u256;
        static fromU32(val: number): u256;
        static fromU64(val: bigint | number): u256;
        static fromString(val: string): u256;
        static fromUint8ArrayBE(arr: Uint8Array): u256;
        static gt(a: u256, b: u256): boolean;
        static lt(a: u256, b: u256): boolean;
        static ge(a: u256, b: u256): boolean;
        static le(a: u256, b: u256): boolean;
        static eq(a: u256, b: u256): boolean;
        isZero(): boolean;
        toU64(): bigint;
        toUint8Array(bigEndian?: boolean): Uint8Array;
    }
    export { u256 };
}
