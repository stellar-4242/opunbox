import { Blockchain } from '@btc-vision/btc-runtime/runtime';
import { LPPool } from './LPPool';
import { revertOnError } from '@btc-vision/btc-runtime/runtime/abort/abort';

Blockchain.contract = (): LPPool => {
    return new LPPool();
};

export * from '@btc-vision/btc-runtime/runtime/exports';

export function abort(message: string, fileName: string, line: u32, column: u32): void {
    revertOnError(message, fileName, line, column);
}
