'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Plus, Repeat, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  deleteRecurring,
  listRecurring,
  runDueRecurring,
  type GroupMember,
  type RecurringExpense,
} from '@/lib/groups'
import { formatCents } from '@/lib/solana/usdc'
import { useProfiles } from '@/components/profile/profile-context'
import { friendlyError, logError } from '@/lib/errors'
import { RecurringDialog } from '@/components/groups/recurring-dialog'
import { APPLE_SPRING } from '@/components/motion'

type Props = {
  groupId: string
  members: GroupMember[]
  /** Called after a recurring is created, deleted, or runs are materialized. */
  onChanged: () => void
}

export function RecurringPanel({ groupId, members, onChanged }: Props) {
  const { resolveName } = useProfiles()
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const now = Date.now()
  const dueCount = items.filter((r) => new Date(r.next_run_at).getTime() <= now).length

  async function refresh() {
    setLoading(true)
    try {
      const rows = await listRecurring(groupId)
      setItems(rows)
    } catch (err) {
      logError('listRecurring', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  async function handleRunDue() {
    try {
      setRunning(true)
      const count = await runDueRecurring(groupId)
      if (count === 0) {
        toast.message('Nothing was due to run.')
      } else {
        toast.success(`Materialized ${count} recurring expense${count === 1 ? '' : 's'}`)
        onChanged()
        await refresh()
      }
    } catch (err) {
      logError('runDueRecurring', err)
      toast.error(friendlyError(err, 'Failed to run recurring'))
    } finally {
      setRunning(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring template? Already-created expenses stay.')) return
    try {
      await deleteRecurring(id)
      setItems((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      logError('deleteRecurring', err)
      toast.error(friendlyError(err, 'Failed to delete'))
    }
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl">Recurring</h2>
          {items.length > 0 && (
            <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
              {items.length} active
            </span>
          )}
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} transition={APPLE_SPRING}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreateOpen(true)}
            className="rounded-full border border-foreground/15 hover:bg-foreground/5"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {dueCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {dueCount} recurring expense{dueCount === 1 ? '' : 's'} due
                </p>
                <p className="font-mono-tight text-[11px] text-muted-foreground mt-0.5">
                  Run to add them to the activity feed
                </p>
              </div>
              <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} transition={APPLE_SPRING}>
                <Button
                  size="sm"
                  onClick={handleRunDue}
                  disabled={running}
                  className="rounded-full bg-foreground text-background hover:opacity-90 px-4 shrink-0"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  {running ? 'Running…' : 'Run now'}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <p className="font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recurring expenses yet. Add rent, subscriptions, or anything that repeats.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const due = new Date(r.next_run_at).getTime() <= now
            const payerName =
              members.find((m) => m.wallet === r.payer_wallet)?.display_name ||
              resolveName(r.payer_wallet)
            return (
              <li
                key={r.id}
                className={`group flex items-center justify-between rounded-lg border px-3 py-2.5 gap-3 ${
                  due
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-foreground/10 bg-background/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-2">
                    {r.emoji && (
                      <span className="text-base leading-none shrink-0" aria-hidden>
                        {r.emoji}
                      </span>
                    )}
                    <span className="truncate">{r.description}</span>
                  </p>
                  <p className="mt-0.5 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                    {r.frequency} · paid by {payerName} · next{' '}
                    {new Date(r.next_run_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono-tight tabular-nums text-sm shrink-0">
                  {formatCents(r.amount_cents)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-600 shrink-0"
                  title="Delete recurring"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <RecurringDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        groupId={groupId}
        members={members}
        onCreated={() => {
          refresh()
          onChanged()
        }}
      />
    </div>
  )
}
