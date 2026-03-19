/**
 * MOTO Casino — Step-by-Step Deployer
 *
 * Deploys one contract at a time. Run multiple times — it resumes from where it left off.
 * Each run deploys the next contract and waits for confirmation.
 *
 * The circular dependency (CASA needs minters that aren't deployed yet) is solved by:
 * - Deploying CASA with 0 minters (contract works, just can't mint yet)
 * - Deploying all others with real addresses
 * - Accepting that CASA minting is disabled (redeploy CASA last if needed)
 *
 * Usage: node deploy/deploy-simple.mjs
 *        (run repeatedly — it resumes automatically)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const MNEMONIC = process.env.DEPLOYER_MNEMONIC;
if (!MNEMONIC) { console.error('Set DEPLOYER_MNEMONIC in deploy/.env'); process.exit(1); }

const MOTO_ADDRESS = 'opt1sqzkx6wm5acawl9m6nay2mjsm6wagv7gazcgtczds';
const TREASURY = 'opt1p6esdzqeara4gq7qj5gmu8y55wula309h25hn3hre0atld7rgkywqtdqt92';
const RPC_URL = 'https://testnet.opnet.org';
const ROOT = resolve(__dirname, '..');
const STATE_FILE = resolve(__dirname, 'deploy-state.json');

function loadState() {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return { deployed: {} };
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

async function main() {
    const { networks } = await import('@btc-vision/bitcoin');
    const { JSONRpcProvider } = await import('opnet');
    const { TransactionFactory, Mnemonic, BinaryWriter } = await import('@btc-vision/transaction');

    const NETWORK = networks.opnetTestnet;
    const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
    const mnemonic = new Mnemonic(MNEMONIC, '', NETWORK);
    // Try OPWallet derivation first, then standard
    let wallet = mnemonic.deriveOPWallet();
    console.log(`Derived (OPWallet): ${wallet.p2tr}`);
    if (wallet.p2tr !== 'opt1p6esdzqeara4gq7qj5gmu8y55wula309h25hn3hre0atld7rgkywqtdqt92') {
        // Try standard derivation
        wallet = mnemonic.derive();
        console.log(`Derived (standard): ${wallet.p2tr}`);
        if (wallet.p2tr !== 'opt1p6esdzqeara4gq7qj5gmu8y55wula309h25hn3hre0atld7rgkywqtdqt92') {
            // Try index 0, account 0
            wallet = mnemonic.derive(0, 0);
            console.log(`Derived (0,0): ${wallet.p2tr}`);
        }
    }
    const factory = new TransactionFactory();
    const state = loadState();

    console.log('=== MOTO Casino Deployer ===');
    console.log(`Wallet: ${wallet.p2tr}`);
    console.log(`Already deployed: ${Object.entries(state.deployed).map(([k,v]) => `${k}=${v}`).join(', ') || 'none'}\n`);

    // ─── Deploy helper ───

    async function deploy(name, wasmFile, calldataBytes) {
        if (state.deployed[name]) {
            console.log(`${name}: already at ${state.deployed[name]}`);
            return state.deployed[name];
        }

        const wasmBytes = new Uint8Array(readFileSync(resolve(ROOT, 'contracts/build', wasmFile)));
        console.log(`\nDeploying ${name} (${wasmBytes.length} bytes)...`);

        const utxoResult = await provider.utxoManager.fetchUTXOs(wallet.p2tr);
        const utxos = [...(utxoResult.confirmed || []), ...(utxoResult.pending || [])];
        const total = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
        console.log(`  UTXOs: ${utxos.length}, Balance: ${total} sats`);

        if (utxos.length === 0) throw new Error('No UTXOs. Wait for previous tx to confirm and retry.');

        const gasParams = await provider.gasParameters();
        const challenge = await provider.getChallenge();

        const result = await factory.signDeployment({
            signer: wallet.keypair,
            mldsaSigner: wallet.mldsaKeypair,
            network: NETWORK,
            from: wallet.p2tr,
            bytecode: wasmBytes,
            calldata: calldataBytes,
            utxos,
            feeRate: gasParams.bitcoin.recommended.medium,
            priorityFee: 0n,
            gasSatFee: 500_000n,
            challenge,
            linkMLDSAPublicKeyToAddress: true,
            revealMLDSAPublicKey: true,
        });

        console.log(`  Address: ${result.contractAddress}`);
        const [fundTx, deployTx] = result.transaction;

        if (fundTx) {
            console.log('  Sending funding tx...');
            try { await provider.sendRawTransaction(fundTx, false); }
            catch (e) { console.log(`  Fund tx note: ${e.message}`); }
        }
        console.log('  Sending deploy tx...');
        try { await provider.sendRawTransaction(deployTx, false); }
        catch (e) { console.log(`  Deploy tx note: ${e.message}`); }

        // Poll for confirmation
        console.log('  Waiting for confirmation...');
        const start = Date.now();
        while (Date.now() - start < 15 * 60 * 1000) {
            try {
                const code = await provider.getCode(result.contractAddress, true);
                if (code && code.bytecode && code.bytecode.length > 10) {
                    console.log(`  ✓ ${name} CONFIRMED!`);
                    state.deployed[name] = result.contractAddress;
                    saveState(state);
                    return result.contractAddress;
                }
            } catch {}
            const elapsed = Math.floor((Date.now() - start) / 1000);
            process.stdout.write(`\r  ${elapsed}s elapsed...    `);
            await new Promise(r => setTimeout(r, 15000));
        }
        throw new Error(`${name} not confirmed in 15 min`);
    }

    // ─── Deployment Order ───
    // 1. CASA Token — 0 minters (works, just can't mint)
    // 2. Points — needs CASA address (0 authorized contracts)
    // 3. LPPool — needs MOTO, CASA, Points, CaseEngine(zero for now)
    // 4. CASAStaking — needs CASA, MOTO, CaseEngine(zero for now)
    // 5. CaseEngine — needs ALL addresses (has them now)
    // Note: LPPool.caseEngine and CASAStaking.caseEngine will be zero.
    //       This means pullPayout/addRevenue/addRevenueShare won't work
    //       (they check caller == caseEngine, and zero address won't match).
    //       For FULL functionality we'd need to redeploy LPPool and CASAStaking
    //       with the real CaseEngine address, or add an initialize() function.

    // Helper to resolve an address string to an Address object
    async function resolveAddr(addrStr, isContract) {
        return await provider.getPublicKeyInfo(addrStr, isContract);
    }

    // Step 1: CASA Token — deploy with 0 minters
    console.log('\n========== STEP 1: CASA Token ==========');
    const casaWriter = new BinaryWriter();
    casaWriter.writeU8(0); // 0 minters
    const casaAddr = await deploy('CASAToken', 'CASAToken.wasm', casaWriter.getBuffer());

    // Step 2: Points — [uint8 count=0, address casaToken]
    console.log('\n========== STEP 2: Points ==========');
    const casaAddrObj = await resolveAddr(casaAddr, true);
    const pointsWriter = new BinaryWriter();
    pointsWriter.writeU8(0); // 0 authorized contracts
    pointsWriter.writeAddress(casaAddrObj); // CASA token
    const pointsAddr = await deploy('Points', 'Points.wasm', pointsWriter.getBuffer());

    // Step 3: LPPool — [address moto, address casa, address points, address caseEngine]
    console.log('\n========== STEP 3: LP Pool ==========');
    const motoAddrObj = await resolveAddr(MOTO_ADDRESS, true);
    const pointsAddrObj = await resolveAddr(pointsAddr, true);
    const zeroAddr = await resolveAddr(casaAddr, true); // placeholder — will use zero bytes
    const lpWriter = new BinaryWriter();
    lpWriter.writeAddress(motoAddrObj);
    lpWriter.writeAddress(casaAddrObj);
    lpWriter.writeAddress(pointsAddrObj);
    lpWriter.writeAddress(casaAddrObj); // caseEngine placeholder — use CASA as dummy (will be zero-guarded)
    const lpAddr = await deploy('LPPool', 'LPPool.wasm', lpWriter.getBuffer());

    // Step 4: CASAStaking — [address casa, address moto, address caseEngine]
    console.log('\n========== STEP 4: CASA Staking ==========');
    const stakingWriter = new BinaryWriter();
    stakingWriter.writeAddress(casaAddrObj);
    stakingWriter.writeAddress(motoAddrObj);
    stakingWriter.writeAddress(casaAddrObj); // caseEngine placeholder
    const stakingAddr = await deploy('CASAStaking', 'CASAStaking.wasm', stakingWriter.getBuffer());

    // Step 5: CaseEngine — [address moto, address casa, address lpPool, address staking, address points, address treasury]
    console.log('\n========== STEP 5: Case Engine ==========');
    const lpAddrObj = await resolveAddr(lpAddr, true);
    const stakingAddrObj = await resolveAddr(stakingAddr, true);
    const treasuryAddrObj = await resolveAddr(TREASURY, false);
    const engineWriter = new BinaryWriter();
    engineWriter.writeAddress(motoAddrObj);
    engineWriter.writeAddress(casaAddrObj);
    engineWriter.writeAddress(lpAddrObj);
    engineWriter.writeAddress(stakingAddrObj);
    engineWriter.writeAddress(pointsAddrObj);
    engineWriter.writeAddress(treasuryAddrObj);
    const engineAddr = await deploy('CaseEngine', 'CaseEngine.wasm', engineWriter.getBuffer());

    // Done
    console.log('\n\n=== ALL DEPLOYED ===');
    console.log(`CASAToken:    ${casaAddr}`);
    console.log(`Points:       ${pointsAddr}`);
    console.log(`LPPool:       ${lpAddr}`);
    console.log(`CASAStaking:  ${stakingAddr}`);
    console.log(`CaseEngine:   ${engineAddr}`);

    console.log('\nNOTE: LPPool and CASAStaking have caseEngine=zero.');
    console.log('This means CaseEngine cannot call pullPayout/addRevenue/addRevenueShare.');
    console.log('For full functionality, redeploy LPPool and CASAStaking with CaseEngine address.');

    // Update frontend .env
    const envContent = `VITE_CASA_TOKEN_ADDRESS=${casaAddr}
VITE_POINTS_ADDRESS=${pointsAddr}
VITE_LP_POOL_ADDRESS=${lpAddr}
VITE_CASA_STAKING_ADDRESS=${stakingAddr}
VITE_CASE_ENGINE_ADDRESS=${engineAddr}
VITE_MOTO_TOKEN_ADDRESS=${MOTO_ADDRESS}
VITE_NETWORK=testnet
VITE_MOTO_PRICE_USD=
`;
    writeFileSync(resolve(ROOT, 'frontend/.env'), envContent);
    console.log('Frontend .env updated');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
