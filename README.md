# Solit

**Split bills. Settle on Solana.**

Solit is a group expense tracker that settles balances in **USDC onchain** with one tap.
No more chasing friends in group chats — the moment you owe someone, the app shows
exactly how much, and a single click sends real USDC to their wallet in under a second.

> Built for the [Solana Frontier Hackathon](https://www.colosseum.com/frontier)
> with the help of the [Superteam Agentic Engineering Grant](https://earn.superteam.fun/listing/agentic-engineering-grants).

---

## Why Solit

Splitwise has 30M+ users globally and one fundamental flaw: **the settle button doesn't actually settle anything**.
You still have to Venmo / Paytm / wire-transfer your friend, then mark it as paid manually. The app is a glorified spreadsheet.

Solit does what Splitwise can't:

- **Real money moves.** USDC SPL transfer goes onchain when you click Settle.
- **Sub-second confirmation** on Solana. Sub-cent fees. Final, no chargebacks.
- **No middleware.** Wallet → tx → done. Nothing custodial.
- **Open ledger.** Every settlement has a Solscan link. Disputes are verifiable.

## What's working today (devnet)

- ✅ Wallet sign-in (Phantom / Solflare via wallet-adapter)
- ✅ Per-wallet display name profiles
- ✅ Group creation + member management (add / remove / rename / delete)
- ✅ **Shareable invite links** (`/invite/[code]`) — friends join by connecting their wallet, no wallet-address-typing
- ✅ Expense entry with **equal or custom split ratios** (per-member dollar shares, live remainder validation)
- ✅ Real-time balance computation honoring custom splits
- ✅ **Minimum-transactions settlement plan** (greedy algorithm — fewest transfers to zero out a group)
- ✅ **Onchain USDC settle button** with auto-creation of recipient associated token accounts
- ✅ Activity feed with Solscan deeplinks for every settlement

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | Tailwind v4 + shadcn/ui primitives + Lucide icons |
| Animation | framer-motion (Apple-style spring physics + blur-fades) |
| Typography | Instrument Serif (display) + Geist (body) + Geist Mono (numbers) |
| Wallet | `@solana/wallet-adapter-react` |
| Onchain | `@solana/web3.js` v1 + `@solana/spl-token` |
| Database | Supabase (Postgres, free tier) — groups, members, expenses, splits, settlements, profiles |
| RPC | Solana devnet (free public endpoint) |

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

1. The app computes a per-member balance map: `{ wallet → cents }`. Positive = owed, negative = owes.
2. The greedy `computeSettlementPlan` algorithm pairs largest debtor with largest creditor, settles the smaller of the two amounts, repeats. Output is a list of transfers `{ from, to, amountCents }` with the **minimum number of moves** to clear the group.
3. The debtor clicks **Settle in USDC**.
4. The app builds a transaction:
   - If the recipient's USDC associated token account doesn't exist, an `AssociatedTokenAccount` create instruction is added (debtor pays the rent).
   - A `TransferChecked` instruction moves the USDC from sender ATA → recipient ATA.
5. Wallet adapter signs, the tx is sent, we wait for `confirmed` commitment.
6. The signature is recorded in `public.settlements` with a Solscan deeplink shown in the activity feed.

See `src/lib/solana/usdc.ts` and `src/lib/groups.ts` for the full implementation.

## Architecture

```
src/
├── app/                          Next.js routes (App Router)
│   ├── page.tsx                  Landing
│   ├── groups/page.tsx           Group list
│   ├── groups/[id]/page.tsx      Group detail (balances, settle, activity)
│   ├── invite/[code]/page.tsx    Invite link join flow
│   └── account/[address]/        Per-wallet account page
├── components/
│   ├── dashboard/                Landing page hero
│   ├── groups/                   Group features (list, detail, dialogs)
│   ├── profile/                  Display-name context + dialog
│   ├── solana/                   Wallet adapter glue
│   ├── cluster/                  Devnet/mainnet switcher
│   └── motion.tsx                Apple-style animation primitives
└── lib/
    ├── groups.ts                 DB ops + balance + settlement algorithm
    ├── solana/usdc.ts            USDC transfer builder + helpers
    └── supabase.ts               Lazy Supabase client + DB types
```

## Database schema

5 tables, all with row-level security enabled:

| Table | Purpose |
|---|---|
| `profiles` | per-wallet global display name |
| `groups` | one row per shared expense group, with `invite_code` |
| `group_members` | wallet ↔ group membership |
| `expenses` | the spend events (description, amount, payer) |
| `expense_splits` | optional per-member shares (overrides equal-split) |
| `settlements` | onchain settle records with `tx_signature` |

Schema lives in [`SETUP.md`](./SETUP.md).

## Roadmap (post-grant)

- [ ] Pick payer in Add Expense ("Sarah paid, log it for her")
- [ ] Edit / delete expense
- [ ] Self-leave group (currently only creator can remove)
- [ ] Settle-all bundle (one tx, multiple transfers via `TransferChecked` per pair)
- [ ] Receipt photo upload (Supabase Storage)
- [ ] Mainnet support (USDC mint already wired)
- [ ] Email magic-link onboarding via Privy embedded wallets

## License

MIT

