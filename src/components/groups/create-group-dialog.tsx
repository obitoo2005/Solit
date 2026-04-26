'use client'

import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createGroup, type Group } from '@/lib/groups'
import { UserSearchInput } from '@/components/groups/user-search-input'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (group: Group) => void
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const { publicKey } = useWallet()
  const [name, setName] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName('')
    setMemberInput('')
    setSubmitting(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!publicKey) {
      toast.error('Connect your wallet first')
      return
    }
    if (!name.trim()) {
      toast.error('Give the group a name')
      return
    }

    const memberWallets = memberInput
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    for (const w of memberWallets) {
      try {
        new PublicKey(w)
      } catch {
        toast.error(`Invalid Solana address: ${w}`)
        return
      }
    }

    try {
      setSubmitting(true)
      const group = await createGroup({
        name: name.trim(),
        creatorWallet: publicKey.toBase58(),
        memberWallets,
      })
      toast.success(`Group "${group.name}" created`)
      onCreated(group)
      reset()
    } catch (err) {
      console.error(err)
      toast.error('Failed to create group. Check console for details.')
      setSubmitting(false)
    }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Create a group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              placeholder="e.g. Goa trip, Apartment 4B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-wallets">Add members</Label>
            <UserSearchInput
              onPick={(p) => {
                setMemberInput((prev) => {
                  const trimmed = prev.trim()
                  if (trimmed.split(/[\s,;\n]+/).includes(p.wallet)) return prev
                  return trimmed ? `${trimmed}\n${p.wallet}` : p.wallet
                })
              }}
              excludeWallets={publicKey ? [publicKey.toBase58()] : []}
              placeholder="Search Solit users by name…"
            />
            <textarea
              id="member-wallets"
              className="flex min-h-[80px] w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="…or paste Solana addresses, one per line"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
            />
            <p className="text-xs text-neutral-500">Optional — you'll be added automatically. You can add more later.</p>
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
              {submitting ? 'Creating…' : 'Create group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
