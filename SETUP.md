# Solit — local setup

## 1. Environment variables

Create `d:\solit\app\.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Get these from Supabase → Project → Settings → API.

## 2. Supabase schema (full, current)

In Supabase → SQL Editor → paste **all of this** and click Run. This is the complete schema for a fresh install — 9 tables, RLS enabled with MVP-permissive policies, plus Realtime publication and Storage bucket for receipts.

```sql
-- ====================================================================
-- Solit — full schema (v1 through v6 consolidated)
-- Run this once on a fresh Supabase project.
-- ====================================================================

-- ---------- v1: core tables ----------

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
  receipt_url text,                           -- v4
  emoji text,                                 -- v6
  created_at timestamptz not null default now()
);

-- settlements: onchain transfers that cleared a debt
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  amount_cents bigint not null check (amount_cents > 0),
  tx_signature text not null,
  asset text not null default 'USDC',          -- v5: 'USDC' | 'SOL'
  asset_amount_base_units text,                -- v5: lamports for SOL, base units for USDC
  created_at timestamptz not null default now()
);

-- ---------- v2: profiles, invite codes, custom splits ----------

create table if not exists public.profiles (
  wallet text primary key,
  display_name text not null check (length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.groups
  add column if not exists invite_code text unique
    default substr(md5(random()::text || clock_timestamp()::text), 1, 10);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  wallet text not null,
  share_cents bigint not null check (share_cents >= 0),
  unique (expense_id, wallet)
);

-- ---------- v6: comments, notifications, recurring ----------

create table if not exists public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  author_wallet text not null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_wallet text not null,
  group_id uuid references public.groups(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_wallet text not null,
  amount_cents integer not null check (amount_cents > 0),
  description text not null,
  emoji text,
  frequency text not null check (frequency in ('weekly','monthly')),
  next_run_at timestamptz not null,
  splits jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------

create index if not exists idx_group_members_wallet on public.group_members (wallet);
create index if not exists idx_group_members_group on public.group_members (group_id);
create index if not exists idx_expenses_group on public.expenses (group_id);
create index if not exists idx_settlements_group on public.settlements (group_id);
create index if not exists idx_settlements_asset on public.settlements (asset);
create index if not exists idx_expense_comments_expense_id on public.expense_comments (expense_id, created_at);
create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_wallet, read_at, created_at desc);
create index if not exists idx_recurring_group on public.recurring_expenses (group_id);
create index if not exists idx_recurring_due on public.recurring_expenses (next_run_at);

-- ---------- RLS: enable on all tables ----------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.profiles enable row level security;
alter table public.expense_splits enable row level security;
alter table public.expense_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.recurring_expenses enable row level security;

-- ---------- MVP-permissive policies (TIGHTEN BEFORE PRODUCTION) ----------

create policy "MVP: anyone can read groups" on public.groups for select using (true);
create policy "MVP: anyone can insert groups" on public.groups for insert with check (true);
create policy "MVP: anyone can update groups" on public.groups for update using (true) with check (true);
create policy "MVP: anyone can delete groups" on public.groups for delete using (true);

create policy "MVP: anyone can read members" on public.group_members for select using (true);
create policy "MVP: anyone can insert members" on public.group_members for insert with check (true);
create policy "MVP: anyone can update members" on public.group_members for update using (true) with check (true);
create policy "MVP: anyone can delete members" on public.group_members for delete using (true);

create policy "MVP: anyone can read expenses" on public.expenses for select using (true);
create policy "MVP: anyone can insert expenses" on public.expenses for insert with check (true);
create policy "MVP: anyone can update expenses" on public.expenses for update using (true) with check (true);
create policy "MVP: anyone can delete expenses" on public.expenses for delete using (true);

create policy "MVP: anyone can read settlements" on public.settlements for select using (true);
create policy "MVP: anyone can insert settlements" on public.settlements for insert with check (true);

create policy "MVP: anyone can read profiles" on public.profiles for select using (true);
create policy "MVP: anyone can upsert profiles" on public.profiles for insert with check (true);
create policy "MVP: anyone can update profiles" on public.profiles for update using (true) with check (true);

create policy "MVP: anyone can read splits" on public.expense_splits for select using (true);
create policy "MVP: anyone can insert splits" on public.expense_splits for insert with check (true);
create policy "MVP: anyone can delete splits" on public.expense_splits for delete using (true);

create policy "MVP: anyone can read comments" on public.expense_comments for select using (true);
create policy "MVP: anyone can write comments" on public.expense_comments for insert with check (true);
create policy "MVP: author can delete own comments" on public.expense_comments for delete using (true);

create policy "MVP: anyone can read notifications" on public.notifications for select using (true);
create policy "MVP: anyone can insert notifications" on public.notifications for insert with check (true);
create policy "MVP: anyone can update notifications" on public.notifications for update using (true) with check (true);

create policy "MVP: anyone can read recurring" on public.recurring_expenses for select using (true);
create policy "MVP: anyone can manage recurring" on public.recurring_expenses for all using (true) with check (true);

-- ---------- Realtime publication ----------

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.expense_comments;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.settlements;

-- ---------- Storage: receipts bucket ----------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "MVP: anyone can upload receipts"
  on storage.objects for insert to public
  with check (bucket_id = 'receipts');

create policy "MVP: anyone can view receipts"
  on storage.objects for select to public
  using (bucket_id = 'receipts');

create policy "MVP: anyone can delete receipts"
  on storage.objects for delete to public
  using (bucket_id = 'receipts');
```

If you already ran an earlier version of the schema, the `if not exists` / `add column if not exists` / `on conflict` clauses make this safe to re-run — it'll just add what's missing.

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

- USDC mint addresses (devnet + mainnet) are in `src/lib/solana/usdc.ts`
- SOL transfer builders are in `src/lib/solana/sol.ts`
- SOL/USD price feed is in `src/lib/price.ts` (CoinGecko, 30s cache)
- DB types and Supabase client are in `src/lib/supabase.ts`
- Group/expense/comment/notification/recurring logic is in `src/lib/groups.ts`
- The `computeSettlementPlan` function in `lib/groups.ts` runs the minimum-transactions greedy algorithm
- Header bell + Realtime subscription is in `src/components/notifications/notifications-bell.tsx`
