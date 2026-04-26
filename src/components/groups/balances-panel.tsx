'use client'

import { formatCents } from '@/lib/solana/usdc'
import type { GroupMember } from '@/lib/groups'
import { useProfiles } from '@/components/profile/profile-context'

type Props = {
  balances: Record<string, number>
  members: GroupMember[]
  myWallet: string | undefined
}

export function BalancesPanel({ balances, members, myWallet }: Props) {
  const { resolveName } = useProfiles()
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl">Balances</h2>
        <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
          net per member
        </span>
      </div>
      <ul className="divide-y divide-foreground/10">
        {members.map((m) => {
          const balance = balances[m.wallet] ?? 0
          const isYou = m.wallet === myWallet
          const label = m.display_name || resolveName(m.wallet)
          return (
            <li key={m.wallet} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{label}</span>
                {isYou && (
                  <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
                    you
                  </span>
                )}
              </div>
              <span
                className={`font-mono-tight tabular-nums text-sm ${
                  balance > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : balance < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground'
                }`}
              >
                {balance > 0 ? '+' : ''}
                {formatCents(balance)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 font-mono-tight text-[11px] text-muted-foreground">
        Positive = you&apos;re owed · Negative = you owe
      </p>
    </div>
  )
}
