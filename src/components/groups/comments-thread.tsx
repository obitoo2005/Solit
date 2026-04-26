'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Trash2, Send } from 'lucide-react'
import {
  addComment,
  deleteComment,
  listComments,
  type ExpenseComment,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'
import { friendlyError, logError } from '@/lib/errors'
import { confirm as confirmDialog } from '@/lib/confirm'

type Props = {
  expenseId: string
  myWallet: string | undefined
  /** Pre-fetched comments. Pass null to fetch on mount. */
  initialComments?: ExpenseComment[] | null
  onCountChange?: (count: number) => void
}

export function CommentsThread({ expenseId, myWallet, initialComments, onCountChange }: Props) {
  const { resolveName } = useProfiles()
  const [comments, setComments] = useState<ExpenseComment[]>(initialComments ?? [])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(initialComments == null)
  const [submitting, setSubmitting] = useState(false)

  // Stash latest onCountChange in a ref so we can call it without re-firing the
  // load effect every time the parent re-renders with a fresh inline callback.
  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => {
    onCountChangeRef.current = onCountChange
  }, [onCountChange])

  // Re-fetch only when the expense actually changes. initialComments is only
  // honored on mount; if the parent already pre-fetched, skip.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialComments != null) return
    let cancelled = false
    setLoading(true)
    listComments(expenseId)
      .then((rows) => {
        if (!cancelled) {
          setComments(rows)
          onCountChangeRef.current?.(rows.length)
        }
      })
      .catch((err) => logError('listComments', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [expenseId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!myWallet) {
      toast.error('Connect your wallet first')
      return
    }
    const body = draft.trim()
    if (!body) return
    try {
      setSubmitting(true)
      const created = await addComment({ expenseId, authorWallet: myWallet, body })
      setComments((prev) => {
        const next = [...prev, created]
        onCountChange?.(next.length)
        return next
      })
      setDraft('')
    } catch (err) {
      logError('addComment', err)
      toast.error(friendlyError(err, 'Failed to add comment'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(c: ExpenseComment) {
    if (c.author_wallet !== myWallet) return
    const ok = await confirmDialog({
      title: 'Delete this comment?',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteComment(c.id)
      setComments((prev) => {
        const next = prev.filter((x) => x.id !== c.id)
        onCountChange?.(next.length)
        return next
      })
    } catch (err) {
      logError('deleteComment', err)
      toast.error(friendlyError(err, 'Failed to delete comment'))
    }
  }

  return (
    <div className="px-5 pb-4 pt-1 bg-foreground/[0.02] border-t border-foreground/5">
      {loading ? (
        <p className="font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
          Loading comments…
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const author = resolveName(c.author_wallet)
              const isMine = c.author_wallet === myWallet
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group flex items-start gap-2 text-sm"
                >
                  <span className="font-medium shrink-0">{author}</span>
                  <span className="text-foreground/90 flex-1 min-w-0 break-words">{c.body}</span>
                  <span className="font-mono-tight text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-600 shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
          {comments.length === 0 && (
            <p className="font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
              No comments yet
            </p>
          )}
        </ul>
      )}

      {myWallet && (
        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="rounded-md p-2 text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-40 transition-colors"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  )
}
