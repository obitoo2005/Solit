'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { buildBulkUsdcTransferTx, centsToUsdcBaseUnits, formatCents } from '@/lib/solana/usdc'
import { recordSettlement } from '@/lib/groups'
import { APPLE_SPRING } from '@/components/motion'

type Transfer = { from: string; to: string; amountCents: number }

type Props = {
  groupId: string
  myWallet: string | undefined
  myDebts: Transfer[]
  onSettled: () => void
}

export function SettleAllButton({ groupId, myWallet, myDebts, onSettled }: Props) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const { cluster } = useCluster()
  const [submitting, setSubmitting] = useState(false)

  // Only show when the user owes 2+ different people
  if (myDebts.length < 2 || !myWallet) return null

  const totalCents = myDebts.reduce((sum, t) => sum + t.amountCents, 0)

  async function handleSettleAll() {
    if (!publicKey) {
      toast.error('Connect your wallet first')
      return
    }
    try {
      setSubmitting(true)
      const tx = await buildBulkUsdcTransferTx({
        connection,
        fromWallet: publicKey,
        transfers: myDebts.map((t) => ({
          toWallet: new PublicKey(t.to),
          amountBaseUnits: centsToUsdcBaseUnits(t.amountCents),
        })),
        cluster: cluster.network ?? 'devnet',
      })

      toast.message(`Approve the bundled transaction (${myDebts.length} transfers)…`)
      const sig = await sendTransaction(tx, connection)
      toast.message('Confirming onchain…')
      await connection.confirmTransaction(sig, 'confirmed')

      // Record each settlement individually so the activity feed has clear rows.
      // All point at the same tx_signature — useful for Solscan dedupe and proof.
      await Promise.all(
        myDebts.map((t) =>
          recordSettlement({
            groupId,
            fromWallet: t.from,
            toWallet: t.to,
            amountCents: t.amountCents,
            txSignature: sig,
          }),
        ),
      )

      toast.success(`Settled ${formatCents(totalCents)} across ${myDebts.length} people in one tx`)
      onSettled()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Bulk settlement failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="rounded-lg border border-foreground/15 bg-foreground/[0.03] p-3 mb-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
            Bundle settlement
          </p>
          <p className="text-sm font-medium mt-0.5">
            Settle all {myDebts.length} debts in one tx
          </p>
          <p className="font-mono-tight tabular-nums text-base">{formatCents(totalCents)}</p>
        </div>
        <motion.div
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.04 }}
          transition={APPLE_SPRING}
          className="shrink-0"
        >
          <Button
            size="sm"
            onClick={handleSettleAll}
            disabled={submitting}
            className="rounded-full bg-foreground text-background hover:opacity-90 px-4"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {submitting ? 'Sending…' : 'Settle all'}
          </Button>
        </motion.div>
      </div>
      <p className="mt-2 font-mono-tight text-[10px] text-muted-foreground">
        One signature · one onchain transaction · all transfers atomic
      </p>
    </motion.div>
  )
}
