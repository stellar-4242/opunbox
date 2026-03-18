// Price service: MOTO → USD
// TODO: Enable when MotoSwap API recovers
// Endpoint: /api/v1/bitcoin/opnetTestnet/{pubKey}/lookup/token/{tokenAddress}

export async function getMotoUsdPrice(): Promise<number> {
    return 0;
}

export function formatMotoAsFiat(motoAmount: string, priceUsd: number): string {
    if (priceUsd <= 0) return '';

    const cleanAmount = motoAmount.replace(/,/g, '');
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount)) return '';

    const fiatValue = numAmount * priceUsd;

    if (fiatValue < 0.01) return '<$0.01';
    return `$${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
