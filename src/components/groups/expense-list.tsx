'use client'

import { formatCents } from '@/lib/solana/usdc'
import type { Expense, Settlement, GroupMember } from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'

type Props = {
  expenses: Expense[]
  settlements: Settlement[]
  members: GroupMember[]
}

type Activity =
  | { kind: 'expense'; data: Expense }
  | { kind: 'settlement'; data: Settlement }

export function ExpenseList({ expenses, settlements, members }: Props) {
  const { resolveName } = useProfiles()
  const memberNames = new Map<string, string>()
  for (const m of members) {
    memberNames.set(m.wallet, m.display_name || resolveName(m.wallet))
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
          return (
            <li key={`e-${e.id}`} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="font-medium">{e.description}</p>
                <p className="mt-0.5 font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">
                  Paid by {memberNames.get(e.payer_wallet) ?? resolveName(e.payer_wallet)} ·{' '}
                  {new Date(e.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="font-mono-tight tabular-nums text-sm">{formatCents(e.amount_cents)}</span>
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
