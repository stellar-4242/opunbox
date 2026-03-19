/**
 * Test deploy: ONLY deploys CASAToken with calldata = [0x00] (0 minters)
 * If this works, calldata IS being passed correctly on testnet.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const MNEMONIC = process.env.DEPLOYER_MNEMONIC;
if (!MNEMONIC) { console.error('Set DEPLOYER_MNEMONIC in deploy/.env'); process.exit(1); }

const RPC_URL = 'https://testnet.opnet.org';
const ROOT = resolve(__dirname, '..');

async function main() {
    const { networks } = await import('@btc-vision/bitcoin');
    const { JSONRpcProvider } = await import('opnet');
    const { TransactionFactory, Mnemonic, BinaryWriter } = await import('@btc-vision/transaction');

    const NETWORK = networks.opnetTestnet;
    const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
    const mnemonic = new Mnemonic(MNEMONIC, '', NETWORK);
    const wallet = mnemonic.deriveOPWallet();
    const factory = new TransactionFactory();

    console.log(`Wallet: ${wallet.p2tr}`);

    // Build calldata: just uint8(0) = no minters
    const writer = new BinaryWriter();
    writer.writeU8(0);
    const calldata = writer.getBuffer();
    console.log(`Calldata: ${Buffer.from(calldata).toString('hex')} (${calldata.length} bytes)`);

    // Load WASM
    const wasmBytes = new Uint8Array(readFileSync(resolve(ROOT, 'contracts/build/CASAToken.wasm')));
    console.log(`WASM: ${wasmBytes.length} bytes`);

    // UTXOs
    const utxoResult = await provider.utxoManager.fetchUTXOs(wallet.p2tr);
    const utxos = [...(utxoResult.confirmed || []), ...(utxoResult.pending || [])];
    const total = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
    console.log(`UTXOs: ${utxos.length}, Balance: ${total} sats`);

    if (utxos.length === 0) { console.error('No UTXOs!'); process.exit(1); }

    // Gas
    const gasParams = await provider.gasParameters();
    const challenge = await provider.getChallenge();
    console.log(`Fee rate: ${gasParams.bitcoin.recommended.medium}`);

    // Sign deployment
    console.log('Signing deployment...');
    const result = await factory.signDeployment({
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network: NETWORK,
        from: wallet.p2tr,
        bytecode: wasmBytes,
        calldata: calldata,
        utxos,
        feeRate: gasParams.bitcoin.recommended.medium,
        priorityFee: 0n,
        gasSatFee: 500_000n,
        challenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
    });

    console.log(`Contract address: ${result.contractAddress}`);

    // Send
    const [fundTx, deployTx] = result.transaction;
    if (fundTx) {
        console.log('Sending funding tx...');
        try {
            const r = await provider.sendRawTransaction(fundTx, false);
            console.log('Funding result:', JSON.stringify(r));
        } catch (e) { console.log('Funding error:', e.message); }
    }

    console.log('Sending deploy tx...');
    try {
        const r = await provider.sendRawTransaction(deployTx, false);
        console.log('Deploy result:', JSON.stringify(r));
    } catch (e) { console.log('Deploy error:', e.message); }

    // Poll
    console.log('\nWaiting for confirmation...');
    const start = Date.now();
    while (Date.now() - start < 20 * 60 * 1000) {
        try {
            const code = await provider.getCode(result.contractAddress, true);
            if (code && code.bytecode && code.bytecode.length > 10) {
                console.log(`\n✓ CONFIRMED! CASAToken deployed at ${result.contractAddress}`);
                console.log(`Check: https://opscan.org/accounts/${result.contractAddress}?network=op_testnet`);
                return;
            }
        } catch {}
        const elapsed = Math.floor((Date.now() - start) / 1000);
        process.stdout.write(`\r${elapsed}s...    `);
        await new Promise(r => setTimeout(r, 15000));
    }
    console.log('\nTimeout — check OPScan manually:', result.contractAddress);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
