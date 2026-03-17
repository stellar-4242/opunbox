CLAUDE.md — MOTO Casino (OPNet Full-Stack)
============================================

This file tells Claude everything it needs to know about this project.

---

## What This Is

A full-stack OPNet application. A decentralized case gambling platform on Bitcoin L1
where the community LP pool is the house. AssemblyScript smart contracts, React frontend
with OPWallet integration, and a hyper-express backend for indexing and stats.

## Plugin Setup

This project uses the buidl-opnet-plugin. To start Claude with the plugin loaded:

    # Add these aliases to your shell config (~/.bashrc or ~/.zshrc):
    alias claudey="claude --plugin-dir /path/to/buidl-opnet-plugin/buidl"
    alias claudeyproj="claude --dangerously-skip-permissions \
      --plugin-dir /path/to/buidl-opnet-plugin/buidl"

Use `claudeyproj` for autonomous builds with the `/buidl` command.

When the plugin is loaded, Claude has access to all 8 specialized agents:

- `opnet-contract-dev` — AssemblyScript contracts
- `opnet-frontend-dev` — React frontend with wallet integration
- `opnet-backend-dev` — backend services (hyper-express)
- `opnet-auditor` — 27 real-bug audit patterns from btc-vision repos
- `opnet-deployer` — testnet and mainnet deployment
- `opnet-e2e-tester` — end-to-end test suite
- `opnet-ui-tester` — frontend interface testing
- `loop-reviewer` — final review before marking complete

The `/buidl` command runs the full pipeline automatically.

## Project Structure

    /
    ├── contracts/          # AssemblyScript smart contracts
    │   ├── src/
    │   │   ├── CASAToken.ts       # $CASA OP-20 token (ownership)
    │   │   ├── Points.ts          # On-chain points (non-transferable)
    │   │   ├── LPPool.ts          # House liquidity pool
    │   │   ├── CASAStaking.ts     # Stake $CASA, earn $MOTO
    │   │   └── CaseEngine.ts      # Case opening, RNG, payouts
    │   ├── tests/
    │   └── build/
    ├── frontend/           # React frontend
    │   ├── src/
    │   └── public/
    ├── backend/            # Backend service (hyper-express)
    │   └── src/
    └── CLAUDE.md           # This file

## Project Details

**App name:** MOTO Casino
**Contract addresses:** (fill after deployment)
- CASAToken: [pending]
- Points: [pending]
- LPPool: [pending]
- CASAStaking: [pending]
- CaseEngine: [pending]
**$MOTO address:** (existing OP-20 — fill with actual address)
**Network:** testnet (networks.opnetTestnet)
**Backend URL:** http://localhost:3000

## What This App Does

A trustless, community-owned casino on Bitcoin. Players open cases with $MOTO,
LPs bankroll the house and earn from the edge, and $CASA holders earn passive
income from every bet. No admin keys, no pause, fully immutable contracts.

## Core User Flow

1. Connect OPWallet
2. Deposit $MOTO into LP Pool (choose lock tier: 7d/30d/90d)
3. Open cases by spending $MOTO — instant result via on-chain RNG
4. Earn $CASA from playing and LPing
5. Stake $CASA to earn 30% of all house profits in $MOTO
6. Earn points for airdrop allocation

## Two-Token Economy

**$MOTO** (existing OP-20): Gambling currency. Used for bets, LP deposits, staking rewards.
**$CASA** (new OP-20): Ownership token. Earned by playing/LPing. Stake for 30% of revenue.

## Revenue Split

- 60% → LP providers
- 30% → $CASA stakers
- 10% → Treasury

## Smart Contracts

### CASAToken (OP-20)
- `mint(to, amount)`: Controlled minting by authorized contracts only
- Emission halving every ~388,800 blocks (90 days)
- Early LP boost: 3x emission first ~129,600 blocks (30 days)
- Fixed max supply: 1 billion $CASA

### Points (OP_NET — non-transferable)
- `addPoints(address, amount)`: Credited by CaseEngine and LPPool
- `setReferrer(address)`: One-time referral registration
- `claimAirdrop()`: Convert points to $CASA proportionally

### LPPool
- `deposit(amount, lockTier)`: Lock tiers 7d/30d/90d
- `withdraw()`: After lock expiry, respects 20% reserve ratio
- `pullPayout(amount)`: CaseEngine pulls winner payouts
- `addRevenue(amount)`: CaseEngine deposits house edge (60%)

### CASAStaking
- `stake(amount)`: Stake $CASA, build multiplier over time
- `unstake()`: Return $CASA + rewards, reset multiplier
- `claimRewards()`: Claim $MOTO without unstaking
- Multipliers: 7d=1.0x, 30d=1.3x, 90d=1.8x

### CaseEngine
- `openCase(amount, userSeed)`: Single-tx case opening
- RNG: hash(getBlockHash(block.number-1) + userSeed + nonce)
- Max bet: 1% of pool, max payout: 5% of pool
- House edge: 5% — split 60/30/10 atomically

**Security requirements:**
- All u256 arithmetic uses SafeMath
- Storage pointers are unique (Blockchain.nextPointer)
- No while loops
- CEI order: Checks → Effects → Interactions
- Fully immutable — no admin, no pause

## Frontend

**Framework:** React 18 + Vite + TypeScript
**Wallet:** OPWallet (signer always `null` in frontend — wallet extension signs)
**Design:** Dark theme, casino aesthetic, production-quality

## Backend

**Framework:** hyper-express (required — never Express/Fastify/Koa)
**Purpose:** Index contract events, serve stats/history, WebSocket live updates
**Port:** 3000

## Build Commands

    # Contracts
    cd contracts && npm run build
    cd contracts && npm run test

    # Frontend
    cd frontend && npm run dev
    cd frontend && npm run build

    # Backend
    cd backend && npm run dev
    cd backend && npm run start

## Using the /buidl Pipeline

For the initial build or major new features, use the full pipeline from the
project root:

    /buidl "describe the feature or full app"

The pipeline will build contracts, frontend, and backend in the correct order
(contracts first, then frontend+backend in parallel), then audit, deploy, and test.

For targeted changes after the initial build, use direct prompts.

## Deployment

**Contracts:** Deploy via deployer agent. Order: CASA → Points → LPPool → CASAStaking → CaseEngine.

**Frontend:**

    # .btc domain (recommended)
    opnet deploy your-domain ./frontend/dist

    # Vercel
    cd frontend && vercel

    # IPFS
    cd frontend && npm run build
    # upload ./dist to IPFS

**Backend:** Deploy to your preferred hosting (VPS, Railway, Fly.io, etc.)

## Storage Layout (Contracts)

See individual contract source files for pointer allocations.
Each contract uses Blockchain.nextPointer for unique slot assignment.

## Environment Variables

    # frontend/.env
    VITE_CASA_TOKEN_ADDRESS=
    VITE_POINTS_ADDRESS=
    VITE_LP_POOL_ADDRESS=
    VITE_CASA_STAKING_ADDRESS=
    VITE_CASE_ENGINE_ADDRESS=
    VITE_MOTO_TOKEN_ADDRESS=
    VITE_NETWORK=testnet
    VITE_BACKEND_URL=http://localhost:3000

    # backend/.env
    NETWORK=testnet
    RPC_URL=https://testnet.opnet.org
    PORT=3000
    CASA_TOKEN_ADDRESS=
    POINTS_ADDRESS=
    LP_POOL_ADDRESS=
    CASA_STAKING_ADDRESS=
    CASE_ENGINE_ADDRESS=
    MOTO_TOKEN_ADDRESS=

## Important Links

- OPNet Explorer (testnet): https://explorer.opnet.org/testnet
- OPNet Explorer (mainnet): https://explorer.opnet.org
- faucet.opnet.org — testnet BTC
- OPWallet — install from OPNet official site
- OPNet Discord — community help
- buidl-opnet-plugin: https://github.com/bc1plainview/buidl-opnet-plugin

## Tuning Parameters

All values are initial defaults — adjust after launch based on real data.
See `.claude/loop/sessions/case-gambling-lp/tuning-params.md` for full list.

- Max bet: 1% of LP pool
- Max payout: 5% of LP pool
- Reserve ratio: 20%
- House edge: 5%
- Revenue split: 60/30/10
- LP lock tiers: 7d (1.0x), 30d (1.5x), 90d (2.5x)
- $CASA staking multipliers: 7d (1.0x), 30d (1.3x), 90d (1.8x)
- $CASA emission halving: every 90 days
- Early LP boost: 3x for first 30 days
