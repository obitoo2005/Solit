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
  emoji: string | null
  created_at: string
  /**
   * Set when an expense is edited via {@link updateExpense}. Null for un-edited
   * rows or rows created before the migration was applied.
   */
  updated_at?: string | null
}

export type ExpenseSplit = {
  id: string
  expense_id: string
  wallet: string
  share_cents: number
}

export type SettlementAsset = 'USDC' | 'SOL'

export type Settlement = {
  id: string
  group_id: string
  from_wallet: string
  to_wallet: string
  amount_cents: number
  tx_signature: string
  asset: SettlementAsset
  /** Base-unit amount of the asset actually transferred onchain, as a string (lamports for SOL, USDC base units for USDC). Null for legacy rows. */
  asset_amount_base_units: string | null
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
  /** Optional emoji / category tag (single emoji char or short label). */
  emoji?: string | null
}): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      payer_wallet: input.payerWallet,
      amount_cents: input.amountCents,
      description: input.description,
      receipt_url: input.receiptUrl ?? null,
      emoji: input.emoji ?? null,
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
    if (splitErr) {
      // Roll back the expense if splits fail to insert.
      await supabase.from('expenses').delete().eq('id', data.id)
      throw splitErr
    }
  }

  // Notify every other group member — best-effort
  const usd = (input.amountCents / 100).toFixed(2)
  notifyGroup({
    groupId: input.groupId,
    actorWallet: input.payerWallet,
    kind: 'expense_added',
    title: `${input.emoji ? input.emoji + ' ' : ''}New expense: $${usd}`,
    body: input.description,
    link: `/groups/${input.groupId}`,
  })

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
  asset?: SettlementAsset
  /** Base units of asset actually moved (lamports for SOL, USDC base units for USDC). Pass as bigint or string. */
  assetAmountBaseUnits?: bigint | string
}): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: input.groupId,
      from_wallet: input.fromWallet,
      to_wallet: input.toWallet,
      amount_cents: input.amountCents,
      tx_signature: input.txSignature,
      asset: input.asset ?? 'USDC',
      asset_amount_base_units:
        input.assetAmountBaseUnits != null ? input.assetAmountBaseUnits.toString() : null,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to record settlement')

  // Notify recipient — best-effort
  try {
    const usd = (input.amountCents / 100).toFixed(2)
    const asset = input.asset ?? 'USDC'
    await createNotification({
      recipientWallet: input.toWallet,
      groupId: input.groupId,
      kind: 'settlement',
      title: `You received $${usd} in ${asset}`,
      body: `From ${input.fromWallet.slice(0, 4)}…${input.fromWallet.slice(-4)}`,
      link: `/groups/${input.groupId}`,
    })
  } catch (notifErr) {
    console.error('settlement notification failed', notifErr)
  }

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

/**
 * Search profiles by display name (case-insensitive contains).
 * Used for the 'add member by name' autocomplete. Returns up to `limit`
 * profiles ordered by display_name. Strips % so the query can't hijack
 * the LIKE pattern.
 */
export async function searchProfiles(query: string, limit = 8): Promise<Profile[]> {
  const q = query.trim().replace(/[%_]/g, '')
  if (q.length < 1) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('display_name', `%${q}%`)
    .order('display_name', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Profile[]
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
  const { error } = await supabase
    .from('expenses')
    .update({ description: trimmed, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
  if (error) throw error
}

/**
 * Full expense edit: updates the parent expense row and replaces any custom
 * splits with the new ones. Splits are deleted then re-inserted because
 * Supabase doesn't expose client-side multi-statement transactions.
 *
 * Receipt semantics:
 *   - `receiptUrl: undefined`  → leave existing receipt untouched
 *   - `receiptUrl: null`        → clear the receipt
 *   - `receiptUrl: 'https://…'` → replace with new URL
 *
 * Splits semantics:
 *   - `splits: undefined`       → keep existing splits as-is (no-op on splits)
 *   - `splits: {}` or empty     → clear custom splits (fall back to equal split)
 *   - `splits: { wallet: cents… }` → must sum to `amountCents`, replaces all
 */
export async function updateExpense(
  expenseId: string,
  input: {
    groupId: string
    payerWallet: string
    amountCents: number
    description: string
    splits?: Record<string, number>
    /** undefined = don't touch; null = clear; string = new URL */
    receiptUrl?: string | null
    emoji?: string | null
    /** Wallet of the user performing the edit (for notifications). */
    actorWallet: string
  },
): Promise<Expense> {
  const trimmedDesc = input.description.trim()
  if (!trimmedDesc) throw new Error('Description cannot be empty')
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  // Validate split totals BEFORE any DB writes so we don't end up in a partial state.
  if (input.splits && Object.keys(input.splits).length > 0) {
    const sum = Object.values(input.splits).reduce((a, b) => a + b, 0)
    if (sum !== input.amountCents) {
      throw new Error(
        `Split shares (${sum}\u00a2) must equal expense amount (${input.amountCents}\u00a2).`,
      )
    }
  }

  // Build update payload — only include receipt_url if explicitly set/cleared.
  const updatePayload: Record<string, unknown> = {
    payer_wallet: input.payerWallet,
    amount_cents: input.amountCents,
    description: trimmedDesc,
    emoji: input.emoji ?? null,
    updated_at: new Date().toISOString(),
  }
  if (input.receiptUrl !== undefined) {
    updatePayload.receipt_url = input.receiptUrl
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updatePayload)
    .eq('id', expenseId)
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to update expense')

  // Replace splits if the caller passed `splits` (even an empty object means "clear").
  if (input.splits !== undefined) {
    const { error: delErr } = await supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', expenseId)
    if (delErr) throw delErr

    if (Object.keys(input.splits).length > 0) {
      const rows = Object.entries(input.splits).map(([wallet, share_cents]) => ({
        expense_id: expenseId,
        wallet,
        share_cents,
      }))
      const { error: insErr } = await supabase.from('expense_splits').insert(rows)
      if (insErr) throw insErr
    }
  }

  // Best-effort notify other group members of the edit
  const usd = (input.amountCents / 100).toFixed(2)
  notifyGroup({
    groupId: input.groupId,
    actorWallet: input.actorWallet,
    kind: 'expense_edited',
    title: `${input.emoji ? input.emoji + ' ' : ''}Edited: $${usd}`,
    body: trimmedDesc,
    link: `/groups/${input.groupId}`,
  })

  return data as Expense
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

/* ---------- Comments on expenses ---------- */

export type ExpenseComment = {
  id: string
  expense_id: string
  author_wallet: string
  body: string
  created_at: string
}

export async function listComments(expenseId: string): Promise<ExpenseComment[]> {
  const { data, error } = await supabase
    .from('expense_comments')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExpenseComment[]
}

export async function addComment(input: {
  expenseId: string
  authorWallet: string
  body: string
}): Promise<ExpenseComment> {
  const trimmed = input.body.trim()
  if (!trimmed) throw new Error('Comment cannot be empty')
  if (trimmed.length > 500) throw new Error('Comment is too long (max 500 chars)')
  const { data, error } = await supabase
    .from('expense_comments')
    .insert({
      expense_id: input.expenseId,
      author_wallet: input.authorWallet,
      body: trimmed,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to add comment')

  // Notify the expense payer (if it's not the commenter themselves) — best-effort
  try {
    const { data: exp } = await supabase
      .from('expenses')
      .select('payer_wallet, group_id, description')
      .eq('id', input.expenseId)
      .single()
    if (exp && exp.payer_wallet && exp.payer_wallet !== input.authorWallet) {
      await createNotification({
        recipientWallet: exp.payer_wallet,
        groupId: exp.group_id,
        kind: 'comment',
        title: 'New comment on your expense',
        body: `"${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}" — on ${exp.description}`,
        link: `/groups/${exp.group_id}`,
      })
    }
  } catch (notifErr) {
    console.error('comment notification failed', notifErr)
  }

  return data as ExpenseComment
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('expense_comments').delete().eq('id', commentId)
  if (error) throw error
}

export async function countCommentsForGroup(groupId: string): Promise<Record<string, number>> {
  // Returns a map of expense_id -> comment_count for all expenses in the group.
  const { data, error } = await supabase
    .from('expenses')
    .select('id, expense_comments(id)')
    .eq('group_id', groupId)
  if (error) throw error
  const out: Record<string, number> = {}
  for (const row of (data as { id: string; expense_comments: { id: string }[] | null }[]) ?? []) {
    out[row.id] = row.expense_comments?.length ?? 0
  }
  return out
}

/* ---------- Notifications ---------- */

export type Notification = {
  id: string
  recipient_wallet: string
  group_id: string | null
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function listNotifications(wallet: string, limit = 30): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Notification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(wallet: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_wallet', wallet)
    .is('read_at', null)
  if (error) throw error
}

export async function createNotification(input: {
  recipientWallet: string
  groupId?: string | null
  kind: string
  title: string
  body?: string | null
  link?: string | null
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    recipient_wallet: input.recipientWallet,
    group_id: input.groupId ?? null,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  })
  if (error) throw error
}

/**
 * Fan out a notification to every group member except the actor.
 * Best-effort: failures are logged but don't throw.
 */
export async function notifyGroup(input: {
  groupId: string
  actorWallet: string
  kind: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  try {
    const members = await listMembers(input.groupId)
    const recipients = members.map((m) => m.wallet).filter((w) => w !== input.actorWallet)
    if (recipients.length === 0) return
    const rows = recipients.map((r) => ({
      recipient_wallet: r,
      group_id: input.groupId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    }))
    const { error } = await supabase.from('notifications').insert(rows)
    if (error) console.error('notifyGroup insert failed', error)
  } catch (err) {
    console.error('notifyGroup failed', err)
  }
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

/* ---------- Recurring expenses ---------- */

export type RecurringFrequency = 'weekly' | 'monthly'

export type RecurringExpense = {
  id: string
  group_id: string
  payer_wallet: string
  amount_cents: number
  description: string
  emoji: string | null
  frequency: RecurringFrequency
  next_run_at: string
  splits: Record<string, number> | null
  created_at: string
}

export async function listRecurring(groupId: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('group_id', groupId)
    .order('next_run_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RecurringExpense[]
}

export async function listDueRecurring(groupId: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('group_id', groupId)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RecurringExpense[]
}

export async function createRecurring(input: {
  groupId: string
  payerWallet: string
  amountCents: number
  description: string
  emoji?: string | null
  frequency: RecurringFrequency
  /** First run timestamp (ISO). If omitted, uses now + frequency. */
  nextRunAt?: string
  splits?: Record<string, number> | null
}): Promise<RecurringExpense> {
  const next = input.nextRunAt ?? advanceDate(new Date().toISOString(), input.frequency)
  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert({
      group_id: input.groupId,
      payer_wallet: input.payerWallet,
      amount_cents: input.amountCents,
      description: input.description,
      emoji: input.emoji ?? null,
      frequency: input.frequency,
      next_run_at: next,
      splits: input.splits ?? null,
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Failed to create recurring')
  return data as RecurringExpense
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
  if (error) throw error
}

/** Advance an ISO date string by 1 frequency unit. */
function advanceDate(iso: string, freq: RecurringFrequency): string {
  const d = new Date(iso)
  if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

/**
 * Materialize all currently-due recurring expenses for a group:
 * 1. Insert each as a real expense (+ splits if any)
 * 2. Advance the template's next_run_at by one frequency
 *
 * Returns the count of materialized expenses.
 */
export async function runDueRecurring(groupId: string): Promise<number> {
  const due = await listDueRecurring(groupId)
  if (due.length === 0) return 0

  let count = 0
  for (const r of due) {
    try {
      await addExpense({
        groupId: r.group_id,
        payerWallet: r.payer_wallet,
        amountCents: r.amount_cents,
        description: r.description,
        emoji: r.emoji,
        splits: r.splits ?? undefined,
      })
      const newNext = advanceDate(r.next_run_at, r.frequency)
      await supabase
        .from('recurring_expenses')
        .update({ next_run_at: newNext })
        .eq('id', r.id)
      count++
    } catch (err) {
      console.error(`runDueRecurring: failed for ${r.id}`, err)
    }
  }
  return count
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
