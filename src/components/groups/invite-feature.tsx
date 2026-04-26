'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getGroupByInvite,
  joinGroupByInvite,
  listMembers,
  type Group,
  type GroupMember,
} from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'
import { WalletButton } from '@/components/solana/solana-provider'
import { FadeUp, APPLE_SPRING } from '@/components/motion'

export function InviteFeature({ inviteCode }: { inviteCode: string }) {
  const router = useRouter()
  const { publicKey, connected } = useWallet()
  const { resolveName, loadProfiles, myProfile } = useProfiles()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getGroupByInvite(inviteCode)
      .then(async (g) => {
        if (cancelled) return
        if (!g) {
          setNotFound(true)
          return
        }
        setGroup(g)
        const m = await listMembers(g.id)
        if (cancelled) return
        setMembers(m)
        loadProfiles(m.map((mem) => mem.wallet)).catch(() => undefined)
      })
      .catch((err) => {
        console.error('Failed to load invite', err)
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [inviteCode, loadProfiles])

  const myWallet = publicKey?.toBase58()
  const alreadyMember = !!myWallet && members.some((m) => m.wallet === myWallet)

  async function handleJoin() {
    if (!myWallet) {
      toast.error('Connect your wallet first')
      return
    }
    if (!group) return
    try {
      setJoining(true)
      await joinGroupByInvite(inviteCode, myWallet)
      toast.success(`Joined "${group.name}"`)
      router.push(`/groups/${group.id}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to join')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="font-mono-tight text-sm text-muted-foreground">Loading invite…</p>
        </div>
      </div>
    )
  }

  if (notFound || !group) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <FadeUp className="mx-auto max-w-md px-6 py-24 text-center">
          <h2 className="font-display text-4xl">Invite link expired</h2>
          <p className="mt-3 text-muted-foreground">
            This invite is invalid or the group has been deleted.
          </p>
          <motion.div
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            transition={APPLE_SPRING}
            className="mt-8 inline-block"
          >
            <Button asChild className="rounded-full bg-foreground text-background hover:opacity-90 px-5">
              <a href="/groups">Go to your groups</a>
            </Button>
          </motion.div>
        </FadeUp>
      </div>
    )
  }

  return (
    <div className="solit-grid min-h-[calc(100dvh-56px)]">
      <FadeUp className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-2xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-8 text-center shadow-xl shadow-black/5">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-5 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
            You're invited to join
          </p>
          <h1 className="mt-1 font-display text-5xl tracking-tight">{group.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? '' : 's'} already in this group
          </p>

          {/* Member preview */}
          <ul className="mt-6 flex flex-wrap justify-center gap-1.5">
            {members.slice(0, 8).map((m) => (
              <li
                key={m.wallet}
                className="rounded-full border border-foreground/15 bg-background/70 px-3 py-1 text-xs font-mono-tight text-foreground/80"
              >
                {resolveName(m.wallet)}
              </li>
            ))}
            {members.length > 8 && (
              <li className="rounded-full px-3 py-1 text-xs font-mono-tight text-muted-foreground">
                +{members.length - 8} more
              </li>
            )}
          </ul>

          {/* Action area */}
          <div className="mt-8">
            {!connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Connect your wallet to join.</p>
                <div className="flex justify-center">
                  <WalletButton />
                </div>
              </div>
            ) : alreadyMember ? (
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} transition={APPLE_SPRING}>
                <Button
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="rounded-full bg-foreground text-background hover:opacity-90 px-6"
                >
                  Open group
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} transition={APPLE_SPRING}>
                  <Button
                    onClick={handleJoin}
                    disabled={joining}
                    className="rounded-full bg-foreground text-background hover:opacity-90 px-6"
                  >
                    {joining ? 'Joining…' : `Join as ${myProfile?.display_name ?? 'me'}`}
                    {!joining && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </motion.div>
                {!myProfile && (
                  <p className="font-mono-tight text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Tip: set your name in the header so friends can recognize you
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </FadeUp>
    </div>
  )
}
