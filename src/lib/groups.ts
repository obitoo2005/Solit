import { supabase } from './supabase'

export type Group = {
  id: string
  name: string
  creator_wallet: string
  invite_code: string | null
  created_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  wallet: string
  display_name: string | null
  joined_at: string
}

export type Expense = {
  id: string
  group_id: string
  payer_wallet: string
  amount_cents: number
  description: string
  created_at: string
}

export type ExpenseSplit = {
  id: string
  expense_id: string
  wallet: string
  share_cents: number
}

export type Settlement = {
  id: string
  group_id: string
  from_wallet: string
  to_wallet: string
  amount_cents: number
  tx_signature: string
  created_at: string
}

export type Profile = {
  wallet: string
  display_name: string
  created_at: string
  updated_at: string
}

export async function listGroupsForUser(wallet: string): Promise<Group[]> {
  const { data: memberships, error: memErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('wallet', wallet)

  if (memErr) throw memErr
  const groupIds = (memberships ?? []).map((m: { group_id: string }) => m.group_id)
  if (groupIds.length === 0) return []

  const { data: groups, error: groupErr } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false })

  if (groupErr) throw groupErr
  return (groups ?? []) as Group[]
}

export async function createGroup(input: {
  name: string
  creatorWallet: string
  memberWallets: string[]
}): Promise<Group> {
  const { name, creatorWallet, memberWallets } = input

  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .insert({ name, creator_wallet: creatorWallet })
    .select()
    .single()

  if (groupErr || !group) throw groupErr ?? new Error('Failed to create group')

  const allMembers = Array.from(new Set([creatorWallet, ...memberWallets])).map((wallet) => ({
    group_id: group.id as string,
    wallet,
  }))

  const { error: memErr } = await supabase.from('group_members').insert(allMembers)
  if (memErr) throw memErr

  return group as Group
}

export async function getGroup(id: string): Promise<Group | null> {
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data ?? null) as Group | null
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as GroupMember[]
}

export async function listExpenses(groupId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Expense[]
}

export async function listSettlements(groupId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Settlement[]
}

export async function addExpense(input: {
  groupId: string
  payerWallet: string
  amountCents: number
  description: string
  /**
   * Optional per-member share map (wallet -> cents). Sum must equal amountCents.
   * If omitted, the expense is split equally across current group members at read time.
   */
  splits?: Record<string, number>
}): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      payer_wallet: input.payerWallet,
      amount_cents: input.amountCents,
      description: input.description,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to add expense')

  if (input.splits && Object.keys(input.splits).length > 0) {
    const sum = Object.values(input.splits).reduce((a, b) => a + b, 0)
    if (sum !== input.amountCents) {
      throw new Error(`Split shares (${sum}\u00a2) must equal expense amount (${input.amountCents}\u00a2).`)
    }
    const rows = Object.entries(input.splits).map(([wallet, share_cents]) => ({
      expense_id: data.id as string,
      wallet,
      share_cents,
    }))
    const { error: splitErr } = await supabase.from('expense_splits').insert(rows)
    if (splitErr) throw splitErr
  }

  return data as Expense
}

export async function listExpenseSplits(groupId: string): Promise<ExpenseSplit[]> {
  // Pull all splits for any expense in the group via a join through expenses.
  const { data, error } = await supabase
    .from('expense_splits')
    .select('id, expense_id, wallet, share_cents, expenses!inner(group_id)')
    .eq('expenses.group_id', groupId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    expense_id: row.expense_id as string,
    wallet: row.wallet as string,
    share_cents: row.share_cents as number,
  }))
}

export async function recordSettlement(input: {
  groupId: string
  fromWallet: string
  toWallet: string
  amountCents: number
  txSignature: string
}): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: input.groupId,
      from_wallet: input.fromWallet,
      to_wallet: input.toWallet,
      amount_cents: input.amountCents,
      tx_signature: input.txSignature,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to record settlement')
  return data as Settlement
}

/**
 * Compute net balances for each member.
 * - Payer is credited the full expense amount.
 * - Each member is debited their share. Custom splits in `splitsByExpense` take precedence;
 *   otherwise the expense is split equally across current members.
 * - Settlements transfer balance from `from_wallet` to `to_wallet`.
 *
 * Returns a map of wallet -> net cents. Positive = owed money, negative = owes money.
 */
export function computeBalances(
  members: GroupMember[],
  expenses: Expense[],
  settlements: Settlement[],
  splitsByExpense?: Record<string, ExpenseSplit[]>,
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const m of members) balances[m.wallet] = 0
  if (members.length === 0) return balances

  for (const expense of expenses) {
    balances[expense.payer_wallet] = (balances[expense.payer_wallet] ?? 0) + expense.amount_cents
    const customSplits = splitsByExpense?.[expense.id]
    if (customSplits && customSplits.length > 0) {
      for (const s of customSplits) {
        balances[s.wallet] = (balances[s.wallet] ?? 0) - s.share_cents
      }
    } else {
      // Equal split across current members. Distribute remainder to the first members.
      const baseShare = Math.floor(expense.amount_cents / members.length)
      const remainder = expense.amount_cents - baseShare * members.length
      members.forEach((m, idx) => {
        const share = baseShare + (idx < remainder ? 1 : 0)
        balances[m.wallet] = (balances[m.wallet] ?? 0) - share
      })
    }
  }

  for (const s of settlements) {
    balances[s.from_wallet] = (balances[s.from_wallet] ?? 0) + s.amount_cents
    balances[s.to_wallet] = (balances[s.to_wallet] ?? 0) - s.amount_cents
  }

  return balances
}

/**
 * Group expense splits by expense_id for fast lookup.
 */
export function groupSplits(splits: ExpenseSplit[]): Record<string, ExpenseSplit[]> {
  const out: Record<string, ExpenseSplit[]> = {}
  for (const s of splits) {
    if (!out[s.expense_id]) out[s.expense_id] = []
    out[s.expense_id].push(s)
  }
  return out
}

/**
 * Greedy minimum-transaction settlement routing.
 * Given net balances, return a list of transfers that zero out everyone with the fewest moves.
 */
export function computeSettlementPlan(
  balances: Record<string, number>,
): { from: string; to: string; amountCents: number }[] {
  const debtors: { wallet: string; amount: number }[] = []
  const creditors: { wallet: string; amount: number }[] = []

  for (const [wallet, amount] of Object.entries(balances)) {
    if (amount < -1) debtors.push({ wallet, amount: -amount })
    else if (amount > 1) creditors.push({ wallet, amount })
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transfers: { from: string; to: string; amountCents: number }[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    transfers.push({ from: debtors[i].wallet, to: creditors[j].wallet, amountCents: pay })
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }

  return transfers
}

/* ---------- Profiles (per-wallet display names) ---------- */

export async function getProfile(wallet: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('wallet', wallet).maybeSingle()
  if (error) throw error
  return (data ?? null) as Profile | null
}

export async function listProfiles(wallets: string[]): Promise<Record<string, Profile>> {
  if (wallets.length === 0) return {}
  const unique = Array.from(new Set(wallets))
  const { data, error } = await supabase.from('profiles').select('*').in('wallet', unique)
  if (error) throw error
  const out: Record<string, Profile> = {}
  for (const p of (data ?? []) as Profile[]) out[p.wallet] = p
  return out
}

export async function upsertProfile(input: { wallet: string; displayName: string }): Promise<Profile> {
  const display_name = input.displayName.trim()
  if (!display_name) throw new Error('Display name cannot be empty')
  if (display_name.length > 40) throw new Error('Display name must be 40 characters or fewer')

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { wallet: input.wallet, display_name, updated_at: new Date().toISOString() },
      { onConflict: 'wallet' },
    )
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to save profile')
  return data as Profile
}

/* ---------- Group management ---------- */

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Group name cannot be empty')
  const { error } = await supabase.from('groups').update({ name: trimmed }).eq('id', groupId)
  if (error) throw error
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}

export async function addMembers(groupId: string, wallets: string[]): Promise<void> {
  const unique = Array.from(new Set(wallets.map((w) => w.trim()).filter(Boolean)))
  if (unique.length === 0) return
  const rows = unique.map((wallet) => ({ group_id: groupId, wallet }))
  // Insert and ignore unique violations (member already in group).
  const { error } = await supabase.from('group_members').upsert(rows, { onConflict: 'group_id,wallet' })
  if (error) throw error
}

export async function removeMember(groupId: string, wallet: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('wallet', wallet)
  if (error) throw error
}

/* ---------- Invite links ---------- */

export async function getGroupByInvite(inviteCode: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as Group | null
}

export async function joinGroupByInvite(inviteCode: string, wallet: string): Promise<Group> {
  const group = await getGroupByInvite(inviteCode)
  if (!group) throw new Error('Invite link is invalid or has expired')

  const { error } = await supabase
    .from('group_members')
    .upsert({ group_id: group.id, wallet }, { onConflict: 'group_id,wallet' })
  if (error) throw error
  return group
}
