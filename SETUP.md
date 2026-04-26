# Solit — local setup

## 1. Environment variables

Create `d:\solit\app\.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Get these from Supabase → Project → Settings → API.

## 2. Supabase schema

In Supabase → SQL Editor → paste and run:

```sql
-- groups: one row per shared expense group
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_wallet text not null,
  created_at timestamptz not null default now()
);

-- group_members: who is in the group
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  wallet text not null,
  display_name text,
  joined_at timestamptz not null default now(),
  unique (group_id, wallet)
);

-- expenses: shared spend events
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_wallet text not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null,
  created_at timestamptz not null default now()
);

-- settlements: USDC transfers that cleared a debt onchain
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  amount_cents bigint not null check (amount_cents > 0),
  tx_signature text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_members_wallet on public.group_members (wallet);
create index if not exists idx_group_members_group on public.group_members (group_id);
create index if not exists idx_expenses_group on public.expenses (group_id);
create index if not exists idx_settlements_group on public.settlements (group_id);

-- Row level security: enable but allow all for MVP (we'll lock this down later)
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;

-- Permissive policies for MVP (replace before production)
create policy "MVP: anyone can read groups" on public.groups for select using (true);
create policy "MVP: anyone can insert groups" on public.groups for insert with check (true);

create policy "MVP: anyone can read members" on public.group_members for select using (true);
create policy "MVP: anyone can insert members" on public.group_members for insert with check (true);

create policy "MVP: anyone can read expenses" on public.expenses for select using (true);
create policy "MVP: anyone can insert expenses" on public.expenses for insert with check (true);

create policy "MVP: anyone can read settlements" on public.settlements for select using (true);
create policy "MVP: anyone can insert settlements" on public.settlements for insert with check (true);
```

## 3. Run

```powershell
npm run dev
```

Open http://localhost:3000

## 4. Get devnet USDC for testing

1. Switch the cluster selector (top right) to **Devnet**
2. Get devnet SOL: `solana airdrop 2 <YOUR_WALLET>` (or use https://faucet.solana.com)
3. Get devnet USDC: https://faucet.circle.com (paste your wallet address, choose Solana Devnet)

## Notes

- USDC mint addresses are in `src/lib/solana/usdc.ts`
- DB types are in `src/lib/supabase.ts`
- Group/expense logic is in `src/lib/groups.ts`
- The `computeSettlementPlan` function in `lib/groups.ts` runs the minimum-transactions algorithm
