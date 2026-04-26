'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createRecurring,
  type GroupMember,
  type RecurringFrequency,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'
import { friendlyError, logError } from '@/lib/errors'
import { EmojiPicker } from '@/components/groups/emoji-picker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  members: GroupMember[]
  onCreated: () => void
}

export function RecurringDialog({ open, onOpenChange, groupId, members, onCreated }: Props) {
  const { publicKey } = useWallet()
  const { resolveName } = useProfiles()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerWallet, setPayerWallet] = useState<string>('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescription('')
    setAmount('')
    setEmoji(null)
    setFrequency('monthly')
    setSubmitting(false)
    const myWallet = publicKey?.toBase58()
    if (myWallet && members.some((m) => m.wallet === myWallet)) {
      setPayerWallet(myWallet)
    } else if (members.length > 0) {
      setPayerWallet(members[0].wallet)
    }
  }, [open, publicKey, members])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payerWallet) {
      toast.error('Pick a payer')
      return
    }
    const trimmed = description.trim()
    if (!trimmed) {
      toast.error('Add a description')
      return
    }
    const dollars = parseFloat(amount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    const cents = Math.round(dollars * 100)

    try {
      setSubmitting(true)
      await createRecurring({
        groupId,
        payerWallet,
        amountCents: cents,
        description: trimmed,
        emoji,
        frequency,
      })
      toast.success(`Recurring expense saved — runs ${frequency}`)
      onCreated()
      onOpenChange(false)
    } catch (err) {
      logError('createRecurring', err)
      toast.error(friendlyError(err, 'Failed to create recurring'))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">New recurring expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-desc">What is it?</Label>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  id="rec-desc"
                  placeholder="Rent, Netflix, gym..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
              </div>
              <EmojiPicker value={emoji} onChange={setEmoji} disabled={submitting} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-payer">Paid by</Label>
            <select
              id="rec-payer"
              value={payerWallet}
              onChange={(e) => setPayerWallet(e.target.value)}
              className="flex h-9 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              {members.map((m) => {
                const myWallet = publicKey?.toBase58()
                const label = m.display_name || resolveName(m.wallet)
                return (
                  <option key={m.wallet} value={m.wallet}>
                    {label}
                    {m.wallet === myWallet ? ' (you)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-amount">Amount (USD)</Label>
            <Input
              id="rec-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono-tight text-[11px] uppercase tracking-wider">Frequency</Label>
            <div className="inline-flex rounded-full border border-foreground/15 p-0.5 bg-background/70">
              {(['weekly', 'monthly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    frequency === f
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="font-mono-tight text-[11px] text-muted-foreground">
              First run will be {frequency === 'weekly' ? 'in 7 days' : 'in 1 month'} from today.
              You can run it manually any time after that.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-foreground text-background hover:opacity-90 px-5"
            >
              {submitting ? 'Saving…' : 'Save recurring'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
