const TOKEN_DECIMALS = 18n;
const TOKEN_SCALE = 10n ** TOKEN_DECIMALS;

export function formatTokenAmount(raw: bigint, decimals = 18): string {
    const scale = 10n ** BigInt(decimals);
    const whole = raw / scale;
    const frac = raw % scale;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    if (fracStr.length === 0) return whole.toLocaleString();
    return `${whole.toLocaleString()}.${fracStr}`;
}

export function parseTokenAmount(input: string, decimals = 18): bigint {
    const scale = 10n ** BigInt(decimals);
    const trimmed = input.trim();
    if (!trimmed || trimmed === '.') return 0n;
    const [wholePart, fracPart = ''] = trimmed.split('.');
    const wholeVal = BigInt(wholePart || '0') * scale;
    const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
    const fracVal = BigInt(paddedFrac || '0');
    return wholeVal + fracVal;
}

export function formatAddress(addr: string, chars = 6): string {
    if (addr.length <= chars * 2 + 3) return addr;
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
}

export function generateUserSeed(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function validateHexSeed(seed: string): boolean {
    const clean = seed.startsWith('0x') ? seed.slice(2) : seed;
    if (clean.length !== 64) return false;
    return /^[0-9a-fA-F]+$/.test(clean);
}

export function hexToBytes32(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const padded = clean.padStart(64, '0').slice(0, 64);
    const result = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        result[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
    }
    return result;
}

export function buildExplorerLinks(txHash: string, network: string): { mempool: string; opscan: string } {
    const isTestnet = network !== 'mainnet';
    const mempoolBase = isTestnet
        ? 'https://mempool.opnet.org/testnet4/tx/'
        : 'https://mempool.opnet.org/tx/';
    const opscanNetwork = isTestnet ? 'op_testnet' : 'op_mainnet';
    return {
        mempool: `${mempoolBase}${txHash}`,
        opscan: `https://opscan.org/accounts/${txHash}?network=${opscanNetwork}`,
    };
}

export { TOKEN_SCALE };
