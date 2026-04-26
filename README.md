# Solit

**Split bills. Settle on Solana.**

Solit is a group expense tracker that settles balances in **USDC or SOL onchain** with one tap.
No more chasing friends in group chats — the moment you owe someone, the app shows
exactly how much, and a single click sends real money to their wallet in under a second.
Owe three people? *One signature, one atomic transaction* clears them all.

> Built for the [Solana Frontier Hackathon](https://www.colosseum.com/frontier)
> with the help of the [Superteam Agentic Engineering Grant](https://earn.superteam.fun/listing/agentic-engineering-grants).

---

## Why Solit

Splitwise has 30M+ users globally and one fundamental flaw: **the settle button doesn't actually settle anything**.
You still have to Venmo / Paytm / wire-transfer your friend, then mark it as paid manually. The app is a glorified spreadsheet.

Solit does what Splitwise can't:

- **Real money moves.** Real USDC or SOL goes onchain when you click Settle.
- **Atomic bundles.** Owe three friends? Pay them all in *one signed transaction* — impossible without a custodial middleman, trivial on Solana.
- **Sub-second confirmation, sub-cent fees.** Final, no chargebacks.
- **Live by default.** Supabase Realtime pushes notifications the moment a settlement, expense, or comment lands. No refresh.
- **No middleware.** Wallet → tx → done. Nothing custodial.
- **Open ledger.** Every settlement has a Solscan link. Disputes are verifiable.

## What's working today (devnet)

### Core
- ✅ Wallet sign-in (Phantom / Solflare via wallet-adapter)
- ✅ Per-wallet display name profiles + onboarding nudge
- ✅ Group creation, member management (add / remove / rename / delete)
- ✅ Self-leave for non-creators (creators must delete the group)
- ✅ **Shareable invite links** (`/invite/[code]`) — friends join by connecting their wallet
- ✅ Add expense with **payer picker** ("Sarah paid for the group")
- ✅ **Equal or custom split ratios** with live remainder validation
- ✅ Edit / delete expenses (with rollback on failure)
- ✅ **Receipt photo upload** to Supabase Storage (5 MB cap, public CDN URLs)
- ✅ **Emoji / category tags** on expenses (24-emoji curated picker)
- ✅ Activity feed with Solscan deeplinks for every settlement

### Onchain settlement (the differentiator)
- ✅ **Minimum-transactions settlement plan** (greedy algorithm — fewest transfers to zero out a group)
- ✅ **USDC settle button** — `TransferChecked` SPL instruction with auto-creation of recipient associated token accounts
- ✅ **SOL settle button** — toggle between USDC and SOL, with live CoinGecko USD↔SOL conversion preview
- ✅ **Settle-all bundle** — when you owe multiple people, *one signature, one atomic transaction* clears them all (multiple `TransferChecked` or `SystemProgram.transfer` instructions in a single tx)
- ✅ Devnet ↔ mainnet cluster switcher (USDC mint resolves automatically)

### Social layer
- ✅ **Comments thread** per expense (inline animated drawer, 500-char limit, author can delete)
- ✅ **Inbound notifications** with Supabase Realtime — "You received $25 in SOL from Sarah" arrives as a live toast + unread badge in the header bell, no refresh needed
- ✅ Auto-fanout on settlement, expense added, and comment events
- ✅ **Recurring expenses** for rent, subscriptions, etc. — weekly/monthly templates with materialize-on-open pattern ("2 recurring due — Run now" banner)

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | Tailwind v4 + shadcn/ui primitives + Lucide icons |
| Animation | framer-motion (Apple-style spring physics + blur-fades) |
| Typography | Instrument Serif (display) + Geist (body) + Geist Mono (numbers) |
| Wallet | `@solana/wallet-adapter-react` |
| Onchain | `@solana/web3.js` v1 + `@solana/spl-token` |
| Database | Supabase Postgres (9 tables, RLS enabled) |
| Realtime | Supabase Realtime channels (per-wallet notification stream) |
| Storage | Supabase Storage (`receipts` public bucket) |
| Price feed | CoinGecko free API (SOL/USD, 30s in-memory cache) |
| RPC | Solana devnet by default; mainnet via cluster switcher |

## Run it locally

### 1. Clone + install

```bash
npm install
```

### 2. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → run the schema from [`SETUP.md`](./SETUP.md)
3. Settings → API → copy the **Project URL** and **publishable key**

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

### 3. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

### 4. Get devnet SOL + USDC

You'll need a Solana wallet (Phantom recommended) switched to **Devnet** (Phantom → Settings → Developer Settings → Devnet).

- **Devnet SOL** (for gas): <https://faucet.solana.com>
- **Devnet USDC** (for settlement): <https://faucet.circle.com> → Solana Devnet

## How settlement works

### 1. Computing the plan

The app computes a per-member balance map: `{ wallet → cents }`. Positive = owed, negative = owes.

The greedy `computeSettlementPlan` algorithm pairs largest debtor with largest creditor, settles the smaller of the two amounts, repeats. Output is a list of transfers `{ from, to, amountCents }` with the **minimum number of moves** to clear the group.

### 2a. Single-recipient settle (USDC or SOL)

The debtor clicks **Settle**, picks USDC or SOL via a pill toggle.

- **USDC path:** if the recipient's USDC associated token account doesn't exist, an `AssociatedTokenAccount` create instruction is prepended (debtor pays the rent). A `TransferChecked` instruction moves USDC from sender ATA → recipient ATA.
- **SOL path:** a single `SystemProgram.transfer` instruction. CoinGecko's SOL/USD price is fetched (30s cached) to convert cents → lamports.

### 2b. Settle-all bundle (the kicker)

When you owe **2+ different people**, a green "Settle all in one tx" panel appears. Click → the app builds a *single transaction* containing N transfer instructions (one per recipient). One Phantom signature, one onchain confirmation, all transfers atomic — if any fail, all revert.

This is the feature Splitwise can't replicate without becoming a custodian.

### 3. Recording + notifying

The wallet adapter signs, the tx is sent, we wait for `confirmed` commitment. The signature is recorded in `public.settlements` (with `asset` and `asset_amount_base_units` columns capturing what was actually sent onchain). Each recipient gets a live notification via Supabase Realtime.

See `src/lib/solana/usdc.ts`, `src/lib/solana/sol.ts`, and `src/lib/groups.ts` for the full implementation.

## Architecture

```
src/
├── app/                              Next.js routes (App Router)
│   ├── page.tsx                      Landing
│   ├── groups/page.tsx               Group list
│   ├── groups/[id]/page.tsx          Group detail (balances, settle, activity)
│   ├── invite/[code]/page.tsx        Invite link join flow
│   └── account/[address]/            Per-wallet account page (send/receive/airdrop)
├── components/
│   ├── dashboard/                    Landing page hero
│   ├── groups/
│   │   ├── add-expense-dialog.tsx    Add expense (payer picker, splits, emoji, receipt)
│   │   ├── settle-up-button.tsx      Single-recipient settle (USDC|SOL toggle)
│   │   ├── settle-all-button.tsx     Atomic bundle settle (USDC|SOL toggle)
│   │   ├── expense-list.tsx          Activity feed with inline comments
│   │   ├── comments-thread.tsx       Per-expense comment drawer
│   │   ├── emoji-picker.tsx          Curated 24-emoji category picker
│   │   ├── recurring-panel.tsx       Recurring templates + "run due" banner
│   │   └── recurring-dialog.tsx      Create recurring expense
│   ├── notifications/
│   │   └── notifications-bell.tsx    Header bell, unread badge, Realtime subscription
│   ├── profile/                      Display-name context + dialog
│   ├── solana/                       Wallet adapter glue
│   ├── cluster/                      Devnet/mainnet switcher
│   └── motion.tsx                    Apple-style animation primitives
└── lib/
    ├── groups.ts                     DB ops + balance + settlement algorithm + notifications
    ├── solana/usdc.ts                USDC TransferChecked builders (single + bulk)
    ├── solana/sol.ts                 SystemProgram.transfer builders (single + bulk)
    ├── price.ts                      CoinGecko SOL/USD with 30s cache
    ├── errors.ts                     friendlyError + logError for Supabase errors
    └── supabase.ts                   Lazy Supabase client + DB types
```

## Database schema

9 tables, all with row-level security enabled:

| Table | Purpose |
|---|---|
| `profiles` | per-wallet global display name |
| `groups` | one row per shared expense group, with `invite_code` |
| `group_members` | wallet ↔ group membership |
| `expenses` | the spend events (description, amount, payer, emoji, receipt URL) |
| `expense_splits` | optional per-member shares (overrides equal-split) |
| `expense_comments` | comment thread per expense |
| `settlements` | onchain settle records (`tx_signature`, `asset`, `asset_amount_base_units`) |
| `notifications` | per-wallet inbox with `read_at`, broadcast via Realtime |
| `recurring_expenses` | weekly/monthly templates, materialized on group open |

Realtime publication is enabled on `notifications`, `expense_comments`, `expenses`, `settlements`.

Full schema (v1 → v6 migrations) lives in [`SETUP.md`](./SETUP.md).

## Shipped after the original grant scope

Everything below was on the post-grant roadmap and is now live:

- [x] Pick payer in Add Expense
- [x] Edit / delete expense
- [x] Self-leave group
- [x] **Settle-all bundle** (atomic single-tx for N transfers, USDC or SOL)
- [x] **SOL settlement option** with live USD conversion
- [x] **Receipt photo upload** to Supabase Storage
- [x] **Emoji / category tags** on expenses
- [x] **Comments threads** per expense
- [x] **Realtime notifications** (Supabase Realtime + bell icon + live toasts)
- [x] **Recurring expenses** (weekly/monthly templates)

## Roadmap (still open)

- [ ] Tighten RLS policies (currently MVP-permissive `using (true)`)
- [ ] Mainnet smoke test (USDC mint already wired, just needs a single live tx)
- [ ] Email magic-link onboarding via Privy embedded wallets (for non-crypto-native users)
- [ ] CSV export for tax season
- [ ] iOS/Android via React Native (existing wallet-adapter setup is web-only)

## License

MIT

