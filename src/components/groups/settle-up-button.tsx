'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { buildUsdcTransferTx, centsToUsdcBaseUnits, formatCents } from '@/lib/solana/usdc'
import { recordSettlement, type GroupMember } from '@/lib/groups'
import { APPLE_SPRING } from '@/components/motion'
import { useProfiles } from '@/components/profile/profile-context'

type Props = {
  groupId: string
  members: GroupMember[]
  transfer: { from: string; to: string; amountCents: number }
  myWallet: string | undefined
  onSettled: () => void
}

export function SettleUpButton({ groupId, members, transfer, myWallet, onSettled }: Props) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const { cluster } = useCluster()
  const { resolveName } = useProfiles()
  const [submitting, setSubmitting] = useState(false)

  const isMine = transfer.from === myWallet
  const fromName = members.find((m) => m.wallet === transfer.from)?.display_name || resolveName(transfer.from)
  const toName = members.find((m) => m.wallet === transfer.to)?.display_name || resolveName(transfer.to)

  async function handleSettle() {
    if (!publicKey) {
      toast.error('Connect your wallet first')
      return
    }
    if (!isMine) {
      toast.error('Only the debtor can trigger this settlement.')
      return
    }

    try {
      setSubmitting(true)
      const tx = await buildUsdcTransferTx({
        connection,
        fromWallet: publicKey,
        toWallet: new PublicKey(transfer.to),
        amountBaseUnits: centsToUsdcBaseUnits(transfer.amountCents),
        cluster: cluster.network ?? 'devnet',
      })

      toast.message('Approve the transaction in your wallet...')
      const sig = await sendTransaction(tx, connection)
      toast.message('Confirming transaction...')
      await connection.confirmTransaction(sig, 'confirmed')

      await recordSettlement({
        groupId,
        fromWallet: transfer.from,
        toWallet: transfer.to,
        amountCents: transfer.amountCents,
        txSignature: sig,
      })

      toast.success(`Settled ${formatCents(transfer.amountCents)} to ${toName}`)
      onSettled()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Settlement failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -1 }}
      className="rounded-lg border border-foreground/10 bg-background/50 p-3 flex items-center justify-between gap-3"
    >
      <div className="text-sm min-w-0">
        <p className="truncate">
          <span className="font-medium">{fromName}</span>
          <span className="text-muted-foreground"> owes </span>
          <span className="font-medium">{toName}</span>
        </p>
        <p className="mt-0.5 font-mono-tight tabular-nums text-base">{formatCents(transfer.amountCents)}</p>
      </div>
      {isMine ? (
        <motion.div
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.04 }}
          transition={APPLE_SPRING}
          className="shrink-0"
        >
          <Button
            size="sm"
            onClick={handleSettle}
            disabled={submitting}
            className="rounded-full bg-foreground text-background hover:opacity-90 px-4"
          >
            {submitting ? 'Sending…' : 'Settle in USDC'}
          </Button>
        </motion.div>
      ) : (
        <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          awaiting payer
        </span>
      )}
    </motion.li>
  )
}
