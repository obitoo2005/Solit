'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCents } from '@/lib/solana/usdc'
import {
  type Expense,
  type Settlement,
  type GroupMember,
  updateExpenseDescription,
  deleteExpense,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'

type Props = {
  expenses: Expense[]
  settlements: Settlement[]
  members: GroupMember[]
  myWallet?: string
  onChanged?: () => void
}

type Activity =
  | { kind: 'expense'; data: Expense }
  | { kind: 'settlement'; data: Settlement }

export function ExpenseList({ expenses, settlements, members, myWallet, onChanged }: Props) {
  const { resolveName } = useProfiles()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [busy, setBusy] = useState(false)

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
    if (!window.confirm('Delete this expense? This will also remove its custom splits.')) return
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
          return (
            <li key={`e-${e.id}`} className="group flex items-center justify-between px-5 py-3.5 gap-3">
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
                    <p className="font-medium truncate">{e.description}</p>
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
                  <span className="font-mono-tight tabular-nums text-sm">{formatCents(e.amount_cents)}</span>
                </div>
              )}
            </li>
          )
        }
        const s = item.data
        return (
          <li key={`s-${s.id}`} className="flex items-center justify-between px-5 py-3.5 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div>
              <p className="text-sm">
                <span className="font-mono-tight text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mr-2">
                  Settled
                </span>
                <span className="font-medium">
                  {memberNames.get(s.from_wallet) ?? resolveName(s.from_wallet)} → {memberNames.get(s.to_wallet) ?? resolveName(s.to_wallet)}
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
            <span className="font-mono-tight tabular-nums text-sm text-emerald-700 dark:text-emerald-400">
              {formatCents(s.amount_cents)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
