'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, X as XIcon } from 'lucide-react'
import { addExpense, uploadReceipt, type GroupMember } from '@/lib/groups'
import { formatCents } from '@/lib/solana/usdc'
import { useProfiles } from '@/components/profile/profile-context'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  members: GroupMember[]
  onAdded: () => void
}

type SplitMode = 'equal' | 'custom'

export function AddExpenseDialog({ open, onOpenChange, groupId, members, onAdded }: Props) {
  const { publicKey } = useWallet()
  const { resolveName } = useProfiles()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerWallet, setPayerWallet] = useState<string>('')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [shares, setShares] = useState<Record<string, string>>({})
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // When dialog re-opens, reset state and default payer to connected wallet
  useEffect(() => {
    if (!open) return
    setShares({})
    setSplitMode('equal')
    setReceiptFile(null)
    setReceiptPreview(null)
    setUploadingReceipt(false)
    const myWallet = publicKey?.toBase58()
    if (myWallet && members.some((m) => m.wallet === myWallet)) {
      setPayerWallet(myWallet)
    } else if (members.length > 0) {
      setPayerWallet(members[0].wallet)
    }
  }, [open, publicKey, members])

  // Generate / clean up local preview URL for the picked receipt file.
  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null)
      return
    }
    const url = URL.createObjectURL(receiptFile)
    setReceiptPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [receiptFile])

  const totalCents = useMemo(() => {
    const dollars = parseFloat(amount)
    return Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0
  }, [amount])

  const customSumCents = useMemo(() => {
    let sum = 0
    for (const m of members) {
      const v = parseFloat(shares[m.wallet] ?? '')
      if (Number.isFinite(v) && v >= 0) sum += Math.round(v * 100)
    }
    return sum
  }, [members, shares])

  const remainderCents = totalCents - customSumCents

  function reset() {
    setDescription('')
    setAmount('')
    setShares({})
    setSplitMode('equal')
    setPayerWallet('')
    setSubmitting(false)
  }

  function fillEqual() {
    if (totalCents <= 0 || members.length === 0) return
    const base = Math.floor(totalCents / members.length)
    const remainder = totalCents - base * members.length
    const next: Record<string, string> = {}
    members.forEach((m, i) => {
      const cents = base + (i < remainder ? 1 : 0)
      next[m.wallet] = (cents / 100).toFixed(2)
    })
    setShares(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!publicKey) {
      toast.error('Connect your wallet first')
      return
    }
    if (!payerWallet) {
      toast.error('Pick who paid')
      return
    }
    const trimmedDesc = description.trim()
    if (!trimmedDesc) {
      toast.error('Add a description')
      return
    }
    if (totalCents <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    let splitsArg: Record<string, number> | undefined
    if (splitMode === 'custom') {
      if (members.length === 0) {
        toast.error('No members to split with')
        return
      }
      const splits: Record<string, number> = {}
      let sum = 0
      for (const m of members) {
        const raw = shares[m.wallet] ?? ''
        const v = parseFloat(raw)
        const cents = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : 0
        if (cents > 0) {
          splits[m.wallet] = cents
          sum += cents
        }
      }
      if (sum !== totalCents) {
        toast.error(
          `Shares total ${formatCents(sum)}, but expense is ${formatCents(totalCents)}. Adjust by ${formatCents(
            totalCents - sum,
          )}.`,
        )
        return
      }
      splitsArg = splits
    }

    try {
      setSubmitting(true)
      let receiptUrl: string | null = null
      if (receiptFile) {
        try {
          setUploadingReceipt(true)
          receiptUrl = await uploadReceipt({ groupId, file: receiptFile })
        } catch (uploadErr) {
          console.error(uploadErr)
          toast.error('Receipt upload failed — saving expense without it.')
        } finally {
          setUploadingReceipt(false)
        }
      }

      await addExpense({
        groupId,
        payerWallet,
        amountCents: totalCents,
        description: trimmedDesc,
        splits: splitsArg,
        receiptUrl,
      })
      toast.success('Expense added')
      reset()
      onAdded()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to add expense')
      setSubmitting(false)
    }
  }

  function handleReceiptPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Receipt must be 5 MB or smaller')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file')
      return
    }
    setReceiptFile(file)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          onOpenChange(o)
          if (!o) reset()
        }
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Add an expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-desc">What was it?</Label>
            <Input
              id="expense-desc"
              placeholder="Dinner, Uber, hotel..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-payer">Paid by</Label>
            <select
              id="expense-payer"
              value={payerWallet}
              onChange={(e) => setPayerWallet(e.target.value)}
              className="flex h-9 w-full rounded-md border border-foreground/15 bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              {members.length === 0 ? (
                <option value="">No members in this group</option>
              ) : (
                members.map((m) => {
                  const myWallet = publicKey?.toBase58()
                  const label = m.display_name || resolveName(m.wallet)
                  return (
                    <option key={m.wallet} value={m.wallet}>
                      {label}
                      {m.wallet === myWallet ? ' (you)' : ''}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (USD)</Label>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Split mode toggle */}
          <div className="space-y-2">
            <Label className="font-mono-tight text-[11px] uppercase tracking-wider">Split</Label>
            <div className="inline-flex rounded-full border border-foreground/15 p-0.5 bg-background/70">
              {(['equal', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSplitMode(mode)
                    if (mode === 'custom' && Object.keys(shares).length === 0) fillEqual()
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    splitMode === mode
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'equal' ? 'Equal' : 'Custom'}
                </button>
              ))}
            </div>
            {splitMode === 'equal' ? (
              <p className="text-xs text-muted-foreground">
                Split equally across {members.length} member{members.length === 1 ? '' : 's'}.
              </p>
            ) : (
              <div className="rounded-lg border border-foreground/10 p-2 space-y-1.5">
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No members in this group yet.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1 pb-1">
                      <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
                        Per member share
                      </span>
                      <button
                        type="button"
                        onClick={fillEqual}
                        className="font-mono-tight text-[10px] uppercase tracking-wider text-foreground/70 hover:text-foreground"
                      >
                        Fill equal
                      </button>
                    </div>
                    {members.map((m) => (
                      <div key={m.wallet} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm">{m.display_name || resolveName(m.wallet)}</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={shares[m.wallet] ?? ''}
                            onChange={(e) =>
                              setShares((prev) => ({ ...prev, [m.wallet]: e.target.value }))
                            }
                            className="pl-5 w-24 text-right tabular-nums"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-1 pt-2 mt-1 border-t border-foreground/10 text-xs">
                      <span className="text-muted-foreground">Total</span>
                      <span
                        className={`font-mono-tight tabular-nums ${
                          totalCents > 0 && remainderCents === 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : remainderCents !== 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatCents(customSumCents)} / {formatCents(totalCents)}
                        {remainderCents !== 0 && totalCents > 0 && (
                          <span className="ml-1.5">
                            ({remainderCents > 0 ? '+' : ''}
                            {formatCents(-remainderCents)} to {remainderCents > 0 ? 'go' : 'cut'})
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Receipt photo */}
          <div className="space-y-2">
            <Label className="font-mono-tight text-[11px] uppercase tracking-wider">Receipt photo</Label>
            {receiptPreview ? (
              <div className="relative rounded-lg overflow-hidden border border-foreground/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="block w-full max-h-56 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  disabled={submitting}
                  className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/80 text-background hover:bg-foreground"
                  title="Remove"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="receipt-input"
                className="flex items-center gap-3 rounded-lg border border-dashed border-foreground/20 bg-background/50 px-3 py-3 text-sm cursor-pointer hover:border-foreground/40 transition-colors"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Add a receipt photo (optional)</span>
                <input
                  id="receipt-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptPick}
                  disabled={submitting}
                  className="sr-only"
                />
              </label>
            )}
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
              {uploadingReceipt
                ? 'Uploading receipt…'
                : submitting
                  ? 'Adding…'
                  : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
