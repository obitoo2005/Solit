'use client'

import { useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, UserPlus, UserMinus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  renameGroup,
  deleteGroup,
  addMembers,
  removeMember,
  type Group,
  type GroupMember,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'
import { UserSearchInput } from '@/components/groups/user-search-input'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group
  members: GroupMember[]
  onChanged: () => void
}

export function GroupSettingsDialog({ open, onOpenChange, group, members, onChanged }: Props) {
  const router = useRouter()
  const { resolveName } = useProfiles()
  const [name, setName] = useState(group.name)
  const [newMembers, setNewMembers] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group.name)
      setNewMembers('')
      setConfirmingDelete(false)
    }
  }, [open, group])

  async function handleRename() {
    if (name.trim() === group.name) return
    if (!name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    try {
      setBusy(true)
      await renameGroup(group.id, name)
      toast.success('Group renamed')
      onChanged()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to rename')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMembers() {
    const wallets = newMembers
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (wallets.length === 0) {
      toast.error('Paste one or more wallet addresses')
      return
    }
    for (const w of wallets) {
      try {
        new PublicKey(w)
      } catch {
        toast.error(`Invalid Solana address: ${w}`)
        return
      }
    }
    try {
      setBusy(true)
      await addMembers(group.id, wallets)
      toast.success(`${wallets.length} member${wallets.length === 1 ? '' : 's'} added`)
      setNewMembers('')
      onChanged()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to add members')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(wallet: string) {
    try {
      setBusy(true)
      await removeMember(group.id, wallet)
      toast.success('Member removed')
      onChanged()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    try {
      setBusy(true)
      await deleteGroup(group.id)
      toast.success('Group deleted')
      onOpenChange(false)
      router.push('/groups')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Group settings</DialogTitle>
        </DialogHeader>

        {/* Rename */}
        <div className="space-y-2">
          <Label htmlFor="settings-name" className="font-mono-tight text-[11px] uppercase tracking-wider">
            Name
          </Label>
          <div className="flex gap-2">
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <Button
              onClick={handleRename}
              disabled={busy || name.trim() === group.name}
              className="rounded-full bg-foreground text-background hover:opacity-90 px-4 shrink-0"
            >
              Save
            </Button>
          </div>
        </div>

        {/* Members list */}
        <div className="space-y-2">
          <Label className="font-mono-tight text-[11px] uppercase tracking-wider">
            Members ({members.length})
          </Label>
          <ul className="rounded-lg border border-foreground/10 divide-y divide-foreground/10">
            {members.map((m) => (
              <li key={m.wallet} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{resolveName(m.wallet)}</p>
                  <p className="font-mono-tight text-[10px] text-muted-foreground truncate">{m.wallet}</p>
                </div>
                {m.wallet !== group.creator_wallet && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(m.wallet)}
                    disabled={busy}
                    className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 shrink-0"
                    title="Remove from group"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Add members */}
        <div className="space-y-2">
          <Label htmlFor="add-members" className="font-mono-tight text-[11px] uppercase tracking-wider">
            Add members
          </Label>
          <UserSearchInput
            onPick={(p) => {
              setNewMembers((prev) => {
                const trimmed = prev.trim()
                // Avoid duplicate paste if the wallet is already queued
                if (trimmed.split(/[\s,;\n]+/).includes(p.wallet)) return prev
                return trimmed ? `${trimmed}\n${p.wallet}` : p.wallet
              })
            }}
            excludeWallets={members.map((m) => m.wallet)}
            placeholder="Search Solit users by name…"
          />
          <textarea
            id="add-members"
            className="flex min-h-[80px] w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
            placeholder="…or paste Solana addresses, one per line"
            value={newMembers}
            onChange={(e) => setNewMembers(e.target.value)}
          />
          <Button
            onClick={handleAddMembers}
            disabled={busy || !newMembers.trim()}
            className="rounded-full bg-foreground text-background hover:opacity-90 px-4"
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>

        {/* Danger zone */}
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
          <p className="font-mono-tight text-[11px] uppercase tracking-wider text-rose-700 dark:text-rose-400">
            Danger zone
          </p>
          {!confirmingDelete ? (
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete this group
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <p className="text-sm">
                Permanently delete <span className="font-medium">{group.name}</span>? This removes all expenses
                and settlement history.
              </p>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={busy}
                  className="rounded-full bg-rose-600 text-white hover:bg-rose-700"
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
