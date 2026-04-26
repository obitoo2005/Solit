'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ExplorerLink } from '../cluster/cluster-ui'
import { AccountBalance, AccountButtons, AccountTokens, AccountTransactions } from './account-ui'
import { ellipsify } from '@/lib/utils'
import { useProfiles } from '@/components/profile/profile-context'
import { FadeUp } from '@/components/motion'

export default function AccountDetailFeature() {
  const params = useParams()
  const { resolveName } = useProfiles()

  const address = useMemo(() => {
    if (!params.address) return
    try {
      return new PublicKey(params.address)
    } catch (e) {
      console.log(`Invalid public key`, e)
    }
  }, [params])

  if (!address) {
    return (
      <div className="solit-grid min-h-[calc(100dvh-56px)]">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="font-mono-tight text-sm text-muted-foreground">Invalid account address.</p>
        </div>
      </div>
    )
  }

  const addr = address.toString()
  const displayName = resolveName(addr)

  return (
    <div className="solit-grid min-h-[calc(100dvh-56px)]">
      <FadeUp className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <p className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground">Account</p>
        <h1 className="mt-1 font-display text-5xl sm:text-6xl tracking-tight">{displayName}</h1>
        <div className="mt-2 font-mono-tight text-xs text-muted-foreground">
          <ExplorerLink path={`account/${addr}`} label={ellipsify(addr)} />
        </div>

        <div className="mt-8 rounded-2xl border border-foreground/10 bg-background/70 backdrop-blur-sm p-6">
          <p className="font-mono-tight text-[11px] uppercase tracking-wider text-muted-foreground">SOL balance</p>
          <div className="mt-2 font-display text-4xl">
            <AccountBalance address={address} />
          </div>
          <div className="mt-4">
            <AccountButtons address={address} />
          </div>
        </div>

        <div className="mt-10 space-y-10">
          <AccountTokens address={address} />
          <AccountTransactions address={address} />
        </div>
      </FadeUp>
    </div>
  )
}
