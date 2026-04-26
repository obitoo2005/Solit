'use client'

import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'
import { listGroupsForUser, type Group } from '@/lib/groups'
import { CreateGroupDialog } from '@/components/groups/create-group-dialog'
import { WalletButton } from '@/components/solana/solana-provider'
import { StaggerGroup, StaggerItem, FadeUp, APPLE_SPRING, APPLE_EASE, fadeUp } from '@/components/motion'

export function GroupsFeature() {
  const { publicKey, connected } = useWallet()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!publicKey) {
      setGroups([])
      return
    }
    let cancelled = false
    setLoading(true)
    listGroupsForUser(publicKey.toBase58())
      .then((data) => {
        if (!cancelled) setGroups(data)
      })
      .catch((err) => console.error('Failed to load groups', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [publicKey])

  if (!connected) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <FadeUp className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15 bg-background/70">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-6 font-display text-4xl">Connect your wallet</h2>
          <p className="mt-3 text-muted-foreground">
            Sign in with a Solana wallet to view your groups and settle expenses in USDC.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton />
          </div>
        </FadeUp>
      </div>
    )
  }

  return (
    <div className="solit-grid min-h-[calc(100dvh-56px)]">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <FadeUp className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground">
              {groups.length} group{groups.length === 1 ? '' : 's'}
            </p>
            <h1 className="mt-1 font-display text-5xl sm:text-6xl tracking-tight">Your groups</h1>
            <p className="mt-2 text-muted-foreground">Trips, dinners, rent, anything you share.</p>
          </div>
          <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} transition={APPLE_SPRING}>
            <Button
              onClick={() => setCreateOpen(true)}
              className="rounded-full bg-foreground text-background hover:opacity-90 px-5"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New group
            </Button>
          </motion.div>
        </FadeUp>

        <div className="mt-10">
          {loading ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: APPLE_EASE }}
              className="font-mono-tight text-sm text-muted-foreground"
            >
              Loading…
            </motion.p>
          ) : groups.length === 0 ? (
            <FadeUp delay={0.15} className="rounded-2xl border border-dashed border-foreground/20 bg-background/50 p-16 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-5 font-display text-2xl">No groups yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first group to start splitting expenses.
              </p>
              <motion.div
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.02 }}
                transition={APPLE_SPRING}
                className="mt-6 inline-block"
              >
                <Button
                  className="rounded-full bg-foreground text-background hover:opacity-90 px-5"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Create a group
                </Button>
              </motion.div>
            </FadeUp>
          ) : (
            <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" delay={0.05} gap={0.06}>
              {groups.map((group) => (
                <StaggerItem key={group.id} variants={fadeUp}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={APPLE_SPRING}
                  >
                    <Link
                      href={`/groups/${group.id}`}
                      className="group block rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-5 transition-colors hover:border-foreground/40 hover:bg-background"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-2xl leading-tight">{group.name}</h3>
                        <span className="mt-1 font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          Open →
                        </span>
                      </div>
                      <p className="mt-3 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                        Created {new Date(group.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </div>

        <CreateGroupDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(group) => {
            setGroups((prev) => [group, ...prev])
            setCreateOpen(false)
          }}
        />
      </div>
    </div>
  )
}
