'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { redirect } from 'next/navigation'
import { FadeUp } from '@/components/motion'

export default function AccountListFeature() {
  const { publicKey } = useWallet()

  if (publicKey) {
    return redirect(`/account/${publicKey.toString()}`)
  }

  return (
    <div className="solit-grid min-h-[calc(100dvh-56px)]">
      <FadeUp className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-mono-tight text-xs uppercase tracking-wider text-muted-foreground">Account</p>
        <h1 className="mt-1 font-display text-5xl">Connect your wallet</h1>
        <p className="mt-3 text-muted-foreground">
          Sign in with a Solana wallet to view your balance and recent activity.
        </p>
        <div className="mt-8 flex justify-center">
          <WalletButton />
        </div>
      </FadeUp>
    </div>
  )
}
