'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { formatCents } from '@/lib/solana/usdc'
import { formatSol } from '@/lib/price'
import {
  type Expense,
  type Settlement,
  type GroupMember,
  updateExpenseDescription,
  deleteExpense,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'
import { CommentsThread } from '@/components/groups/comments-thread'
import { confirm } from '@/lib/confirm'

type Props = {
  expenses: Expense[]
  settlements: Settlement[]
  members: GroupMember[]
  myWallet?: string
  /** Map of expense_id -> comment count, for badge display. */
  commentCounts?: Record<string, number>
  onChanged?: () => void
}

type Activity =
  | { kind: 'expense'; data: Expense }
  | { kind: 'settlement'; data: Settlement }

export function ExpenseList({
  expenses,
  settlements,
  members,
  myWallet,
  commentCounts,
  onChanged,
}: Props) {
  const { resolveName } = useProfiles()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})

  const getCommentCount = (expenseId: string): number => {
    if (expenseId in localCounts) return localCounts[expenseId]
    return commentCounts?.[expenseId] ?? 0
  }

  const memberNames = new Map<string, string>()
  for (const m of members) {
    memberNames.set(m.wallet, m.display_name || resolveName(m.wallet))
  }

  async function handleSaveEdit(expenseId: string) {
    if (!editDraft.trim()) {
      toast.error('Description cannot be empty')
      return
    }
    try {
      setBusy(true)
      await updateExpenseDescription(expenseId, editDraft)
      toast.success('Expense updated')
      setEditingId(null)
      onChanged?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(expenseId: string) {
    const ok = await confirm({
      title: 'Delete this expense?',
      description: 'Custom splits attached to it will also be removed. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      setBusy(true)
      await deleteExpense(expenseId)
      toast.success('Expense deleted')
      onChanged?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  const activity: Activity[] = [
    ...expenses.map((e): Activity => ({ kind: 'expense', data: e })),
    ...settlements.map((s): Activity => ({ kind: 'settlement', data: s })),
  ].sort((a, b) => {
    const ta = new Date(a.data.created_at).getTime()
    const tb = new Date(b.data.created_at).getTime()
    return tb - ta
  })

  if (activity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-foreground/15 bg-background/50 p-10 text-center">
        <p className="text-sm text-muted-foreground">No activity yet. Add your first expense above.</p>
      </div>
    )
  }

  return (
    <ul className="rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm divide-y divide-foreground/10 overflow-hidden">
      {activity.map((item) => {
        if (item.kind === 'expense') {
          const e = item.data
          const canEdit = !!myWallet && e.payer_wallet === myWallet
          const isEditing = editingId === e.id
          const commentCount = getCommentCount(e.id)
          const isExpanded = expandedId === e.id
          return (
            <li key={`e-${e.id}`} className="group flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 gap-3">
              {!isEditing && e.receipt_url && (
                <a
                  href={e.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md overflow-hidden border border-foreground/10 bg-background/50 hover:border-foreground/40 transition-colors"
                  title="View receipt"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.receipt_url} alt="Receipt" className="h-10 w-10 object-cover" />
                </a>
              )}
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(ev) => setEditDraft(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') handleSaveEdit(e.id)
                        if (ev.key === 'Escape') setEditingId(null)
                      }}
                      disabled={busy}
                      className="flex-1 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(e.id)}
                      disabled={busy}
                      className="rounded-md p-1 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 disabled:opacity-50"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-medium truncate flex items-center gap-2">
                      {e.emoji && (
                        <span className="text-lg leading-none shrink-0" aria-hidden>
                          {e.emoji}
                        </span>
                      )}
                      <span className="truncate">{e.description}</span>
                    </p>
                    <p className="mt-0.5 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                      Paid by {memberNames.get(e.payer_wallet) ?? resolveName(e.payer_wallet)} ·{' '}
                      {new Date(e.created_at).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(e.id)
                          setEditDraft(e.description)
                        }}
                        disabled={busy}
                        className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        title="Edit description"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        disabled={busy}
                        className="rounded-md p-1 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        title="Delete expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
                      isExpanded || commentCount > 0
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={isExpanded ? 'Hide comments' : 'Show comments'}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {commentCount > 0 && (
                      <span className="font-mono-tight tabular-nums text-[11px]">{commentCount}</span>
                    )}
                  </button>
                  <span className="font-mono-tight tabular-nums text-sm">{formatCents(e.amount_cents)}</span>
                </div>
              )}
            </div>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="thread"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <CommentsThread
                    expenseId={e.id}
                    myWallet={myWallet}
                    onCountChange={(n) => setLocalCounts((prev) => ({ ...prev, [e.id]: n }))}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </li>
          )
        }
        const s = item.data
        const isSol = s.asset === 'SOL'
        const onchainAmountLabel =
          isSol && s.asset_amount_base_units
            ? formatSol(BigInt(s.asset_amount_base_units))
            : null

        return (
          <li
            key={`s-${s.id}`}
            className="flex items-center justify-between px-5 py-3.5 bg-emerald-50/40 dark:bg-emerald-950/20"
          >
            <div className="min-w-0">
              <p className="text-sm flex items-center gap-2 flex-wrap">
                <span className="font-mono-tight text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Settled
                </span>
                <span
                  className={`font-mono-tight text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${
                    isSol
                      ? 'bg-violet-500/10 border border-violet-500/30 text-violet-700 dark:text-violet-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {s.asset || 'USDC'}
                </span>
                <span className="font-medium truncate">
                  {memberNames.get(s.from_wallet) ?? resolveName(s.from_wallet)} →{' '}
                  {memberNames.get(s.to_wallet) ?? resolveName(s.to_wallet)}
                </span>
              </p>
              <p className="mt-0.5 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                <a
                  href={`https://solscan.io/tx/${s.tx_signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  Solscan ↗
                </a>
                {' · '}
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono-tight tabular-nums text-sm text-emerald-700 dark:text-emerald-400 block">
                {onchainAmountLabel ?? formatCents(s.amount_cents)}
              </span>
              {onchainAmountLabel && (
                <span className="font-mono-tight text-[10px] text-muted-foreground">
                  ≈ {formatCents(s.amount_cents)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
