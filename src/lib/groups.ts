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
  receipt_url: string | null
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
  /** Optional public URL of the uploaded receipt photo. */
  receiptUrl?: string | null
}): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      payer_wallet: input.payerWallet,
      amount_cents: input.amountCents,
      description: input.description,
      receipt_url: input.receiptUrl ?? null,
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

/* ---------- Expense edit / delete ---------- */

export async function updateExpenseDescription(expenseId: string, description: string): Promise<void> {
  const trimmed = description.trim()
  if (!trimmed) throw new Error('Description cannot be empty')
  const { error } = await supabase.from('expenses').update({ description: trimmed }).eq('id', expenseId)
  if (error) throw error
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

/* ---------- Receipt photos ---------- */

const RECEIPTS_BUCKET = 'receipts'

/**
 * Upload a receipt image file to Supabase Storage and return its public URL.
 * Files are namespaced by group/expense and randomized to avoid collisions.
 */
export async function uploadReceipt(args: {
  groupId: string
  file: File
}): Promise<string> {
  const { groupId, file } = args
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext) ? ext : 'jpg'
  const path = `${groupId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type || `image/${safeExt}`,
  })
  if (error) throw error

  const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function updateExpenseReceipt(expenseId: string, receiptUrl: string | null): Promise<void> {
  const { error } = await supabase.from('expenses').update({ receipt_url: receiptUrl }).eq('id', expenseId)
  if (error) throw error
}

/* ---------- Self-leave ---------- */

/**
 * Convenience wrapper: a member removes themselves from a group.
 * Creators cannot leave their own group — they must delete it instead.
 */
export async function leaveGroup(groupId: string, wallet: string, creatorWallet: string): Promise<void> {
  if (wallet === creatorWallet) {
    throw new Error('Group creator cannot leave. Delete the group instead.')
  }
  await removeMember(groupId, wallet)
}

/* ---------- Group summary (for the /groups list) ---------- */

export type GroupSummary = Group & {
  memberCount: number
  expenseCount: number
  /** Net balance (cents) for the requesting wallet within this group. Positive = owed, negative = owes. */
  myBalanceCents: number
}

/**
 * Fetch all groups the user is in plus aggregate counts and their personal balance per group.
 * Done with a few batched queries (Supabase doesn't support arbitrary SQL through the JS client).
 */
export async function listGroupSummariesForUser(wallet: string): Promise<GroupSummary[]> {
  const groups = await listGroupsForUser(wallet)
  if (groups.length === 0) return []
  const groupIds = groups.map((g) => g.id)

  const [membersRes, expensesRes, settlementsRes, splitsRes] = await Promise.all([
    supabase.from('group_members').select('group_id, wallet').in('group_id', groupIds),
    supabase.from('expenses').select('id, group_id, payer_wallet, amount_cents').in('group_id', groupIds),
    supabase
      .from('settlements')
      .select('group_id, from_wallet, to_wallet, amount_cents')
      .in('group_id', groupIds),
    supabase
      .from('expense_splits')
      .select('expense_id, wallet, share_cents, expenses!inner(group_id)')
      .in('expenses.group_id', groupIds),
  ])

  if (membersRes.error) throw membersRes.error
  if (expensesRes.error) throw expensesRes.error
  if (settlementsRes.error) throw settlementsRes.error
  if (splitsRes.error) throw splitsRes.error

  const membersByGroup = new Map<string, string[]>()
  for (const m of (membersRes.data ?? []) as { group_id: string; wallet: string }[]) {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, [])
    membersByGroup.get(m.group_id)!.push(m.wallet)
  }

  const splitsByExpenseId = new Map<string, { wallet: string; share_cents: number }[]>()
  for (const s of (splitsRes.data ?? []) as {
    expense_id: string
    wallet: string
    share_cents: number
  }[]) {
    if (!splitsByExpenseId.has(s.expense_id)) splitsByExpenseId.set(s.expense_id, [])
    splitsByExpenseId
      .get(s.expense_id)!
      .push({ wallet: s.wallet, share_cents: s.share_cents })
  }

  const expensesByGroup = new Map<
    string,
    { id: string; payer_wallet: string; amount_cents: number }[]
  >()
  for (const e of (expensesRes.data ?? []) as {
    id: string
    group_id: string
    payer_wallet: string
    amount_cents: number
  }[]) {
    if (!expensesByGroup.has(e.group_id)) expensesByGroup.set(e.group_id, [])
    expensesByGroup
      .get(e.group_id)!
      .push({ id: e.id, payer_wallet: e.payer_wallet, amount_cents: e.amount_cents })
  }

  const settlementsByGroup = new Map<
    string,
    { from_wallet: string; to_wallet: string; amount_cents: number }[]
  >()
  for (const s of (settlementsRes.data ?? []) as {
    group_id: string
    from_wallet: string
    to_wallet: string
    amount_cents: number
  }[]) {
    if (!settlementsByGroup.has(s.group_id)) settlementsByGroup.set(s.group_id, [])
    settlementsByGroup.get(s.group_id)!.push({
      from_wallet: s.from_wallet,
      to_wallet: s.to_wallet,
      amount_cents: s.amount_cents,
    })
  }

  return groups.map<GroupSummary>((g) => {
    const groupMembers = membersByGroup.get(g.id) ?? []
    const groupExpenses = expensesByGroup.get(g.id) ?? []
    const groupSettlements = settlementsByGroup.get(g.id) ?? []

    let myBalance = 0
    for (const e of groupExpenses) {
      const customSplits = splitsByExpenseId.get(e.id)
      if (e.payer_wallet === wallet) myBalance += e.amount_cents
      if (customSplits && customSplits.length > 0) {
        for (const s of customSplits) {
          if (s.wallet === wallet) myBalance -= s.share_cents
        }
      } else if (groupMembers.length > 0) {
        // Equal split — distribute remainder to first members
        const base = Math.floor(e.amount_cents / groupMembers.length)
        const remainder = e.amount_cents - base * groupMembers.length
        const idx = groupMembers.indexOf(wallet)
        if (idx >= 0) {
          myBalance -= base + (idx < remainder ? 1 : 0)
        }
      }
    }
    for (const s of groupSettlements) {
      if (s.from_wallet === wallet) myBalance += s.amount_cents
      if (s.to_wallet === wallet) myBalance -= s.amount_cents
    }

    return {
      ...g,
      memberCount: groupMembers.length,
      expenseCount: groupExpenses.length,
      myBalanceCents: myBalance,
    }
  })
}
