'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { ArrowLeft, Settings, Share2, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  getGroup,
  listMembers,
  listExpenses,
  listSettlements,
  listExpenseSplits,
  computeBalances,
  computeSettlementPlan,
  groupSplits,
  leaveGroup,
  countCommentsForGroup,
  type Group,
  type GroupMember,
  type Expense,
  type Settlement,
  type ExpenseSplit,
} from '@/lib/groups'
import { AddExpenseDialog } from '@/components/groups/add-expense-dialog'
import { SettleUpButton } from '@/components/groups/settle-up-button'
import { SettleAllButton } from '@/components/groups/settle-all-button'
import { ExpenseList } from '@/components/groups/expense-list'
import { RecurringPanel } from '@/components/groups/recurring-panel'
import { confirm } from '@/lib/confirm'
import { BalancesPanel } from '@/components/groups/balances-panel'
import { GroupSettingsDialog } from '@/components/groups/group-settings-dialog'
import { WalletButton } from '@/components/solana/solana-provider'
import { useProfiles } from '@/components/profile/profile-context'
import { APPLE_SPRING } from '@/components/motion'

export function GroupDetailFeature({ groupId }: { groupId: string }) {
  const router = useRouter()
  const { publicKey, connected } = useWallet()
  const { loadProfiles } = useProfiles()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [splits, setSplits] = useState<ExpenseSplit[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [g, m, e, s, sp, cc] = await Promise.all([
        getGroup(groupId),
        listMembers(groupId),
        listExpenses(groupId),
        listSettlements(groupId),
        listExpenseSplits(groupId),
        countCommentsForGroup(groupId).catch(() => ({}) as Record<string, number>),
      ])
      setGroup(g)
      setMembers(m)
      setExpenses(e)
      setSettlements(s)
      setSplits(sp)
      setCommentCounts(cc)
      // Eagerly resolve display names for everyone the page might mention
      const wallets = new Set<string>()
      m.forEach((member) => wallets.add(member.wallet))
      e.forEach((exp) => wallets.add(exp.payer_wallet))
      s.forEach((settle) => {
        wallets.add(settle.from_wallet)
        wallets.add(settle.to_wallet)
      })
      loadProfiles(Array.from(wallets)).catch(() => undefined)
    } catch (err) {
      console.error('Failed to load group', err)
    } finally {
      setLoading(false)
    }
  }, [groupId, loadProfiles])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleLeave() {
    if (!group || !publicKey) return
    const myWalletStr = publicKey.toBase58()
    const myBalance = balances[myWalletStr] ?? 0
    if (Math.abs(myBalance) > 1) {
      const proceed = await confirm({
        title: `Leave "${group.name}"?`,
        description: `You still have an outstanding balance in this group (${
          myBalance > 0 ? 'you are owed' : 'you owe'
        } $${(Math.abs(myBalance) / 100).toFixed(2)}). You can leave anyway, but settle up first if you can.`,
        confirmLabel: 'Leave anyway',
        destructive: true,
      })
      if (!proceed) return
    } else {
      const proceed = await confirm({
        title: `Leave "${group.name}"?`,
        description: 'You can rejoin via the invite link any time.',
        confirmLabel: 'Leave',
        destructive: true,
      })
      if (!proceed) return
    }
    try {
      await leaveGroup(group.id, myWalletStr, group.creator_wallet)
      toast.success('You left the group')
      router.push('/groups')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to leave group')
    }
  }

  async function copyInviteLink() {
    if (!group?.invite_code) {
      toast.error('No invite link yet — try refreshing.')
      return
    }
    const url = `${window.location.origin}/invite/${group.invite_code}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied')
    } catch {
      toast.message(url)
    }
  }

  if (!connected) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h2 className="font-display text-4xl">Connect your wallet</h2>
          <p className="mt-3 text-muted-foreground">
            You need to sign in with a Solana wallet to view this group.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton />
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="font-mono-tight text-sm text-muted-foreground">Loading group…</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <Link href="/groups" className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <p className="mt-6 font-display text-3xl">Group not found.</p>
        </div>
      </div>
    )
  }

  const splitsByExpense = groupSplits(splits)
  const balances = computeBalances(members, expenses, settlements, splitsByExpense)
  const plan = computeSettlementPlan(balances)
  const myWallet = publicKey?.toBase58()
  const myDebts = plan.filter((p) => p.from === myWallet)
  const isCreator = group ? group.creator_wallet === myWallet : false

  return (
    <div className="solit-grid min-h-[calc(100dvh-56px)]">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <Link
          href="/groups"
          className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Groups
        </Link>

        <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground">
              {members.length} member{members.length === 1 ? '' : 's'} · {expenses.length} expense
              {expenses.length === 1 ? '' : 's'}
            </p>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight break-words">
              {group.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} transition={APPLE_SPRING}>
              <Button
                variant="ghost"
                onClick={copyInviteLink}
                className="rounded-full border border-foreground/15 hover:bg-foreground/5"
                title="Copy invite link"
              >
                <Share2 className="h-4 w-4 mr-1.5" /> Invite
              </Button>
            </motion.div>
            {isCreator ? (
              <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} transition={APPLE_SPRING}>
                <Button
                  variant="ghost"
                  onClick={() => setSettingsOpen(true)}
                  className="rounded-full border border-foreground/15 hover:bg-foreground/5"
                  title="Group settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} transition={APPLE_SPRING}>
                <Button
                  variant="ghost"
                  onClick={handleLeave}
                  className="rounded-full border border-foreground/15 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                  title="Leave this group"
                >
                  <LogOut className="h-4 w-4 mr-1.5" /> Leave
                </Button>
              </motion.div>
            )}
            <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} transition={APPLE_SPRING}>
              <Button
                onClick={() => setAddOpen(true)}
                className="rounded-full bg-foreground text-background hover:opacity-90 px-5"
              >
                Add expense
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-5">
            <BalancesPanel balances={balances} members={members} myWallet={myWallet} />
          </div>
          <div className="rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-xl">Settle up</h2>
              <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
                onchain · USDC
              </span>
            </div>
            {plan.length === 0 ? (
              <div className="rounded-lg border border-dashed border-foreground/15 p-6 text-center">
                <p className="text-sm text-muted-foreground">All balances are settled.</p>
              </div>
            ) : (
              <>
                <SettleAllButton
                  groupId={group.id}
                  myWallet={myWallet}
                  myDebts={myDebts}
                  onSettled={refresh}
                />
                <ul className="space-y-2">
                  {plan.map((t, i) => (
                    <SettleUpButton
                      key={i}
                      groupId={group.id}
                      members={members}
                      transfer={t}
                      myWallet={myWallet}
                      onSettled={refresh}
                    />
                  ))}
                </ul>
                {myDebts.length === 0 && (
                  <p className="mt-3 font-mono-tight text-[11px] text-muted-foreground">
                    Nothing for you to settle right now — others owe each other.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-10">
          <RecurringPanel groupId={group.id} members={members} onChanged={refresh} />
        </div>

        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-2xl">Activity</h2>
            <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
              {expenses.length + settlements.length} event{expenses.length + settlements.length === 1 ? '' : 's'}
            </span>
          </div>
          <ExpenseList
            expenses={expenses}
            settlements={settlements}
            members={members}
            myWallet={myWallet}
            commentCounts={commentCounts}
            splitsByExpense={splitsByExpense}
            groupId={group.id}
            onChanged={refresh}
          />
        </div>

        <AddExpenseDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          groupId={group.id}
          members={members}
          onAdded={() => {
            setAddOpen(false)
            refresh()
          }}
        />

        {isCreator && (
          <GroupSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            group={group}
            members={members}
            onChanged={refresh}
          />
        )}
      </div>
    </div>
  )
}
