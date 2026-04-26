'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { buildBulkUsdcTransferTx, centsToUsdcBaseUnits, formatCents } from '@/lib/solana/usdc'
import { buildBulkSolTransferTx } from '@/lib/solana/sol'
import { centsToLamports, formatSol, getSolUsdPrice } from '@/lib/price'
import { recordSettlement, type SettlementAsset } from '@/lib/groups'
import { APPLE_SPRING } from '@/components/motion'
import { checkSettlePreflight, requestDevnetAirdrop, showPreflightFailure } from '@/lib/preflight'

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
  const [asset, setAsset] = useState<SettlementAsset>('USDC')
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // Lazy-load SOL price when user picks SOL
  useEffect(() => {
    if (asset !== 'SOL' || solPrice != null) return
    let cancelled = false
    setPriceLoading(true)
    getSolUsdPrice()
      .then((p) => {
        if (!cancelled) setSolPrice(p)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) toast.error('Could not load SOL price — falling back to USDC')
        if (!cancelled) setAsset('USDC')
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [asset, solPrice])

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
      let sig: string
      let perTransferBaseUnits: bigint[]

      if (asset === 'SOL') {
        if (!solPrice) {
          toast.error('SOL price not loaded yet')
          return
        }
        perTransferBaseUnits = myDebts.map((t) => centsToLamports(t.amountCents, solPrice))
        const totalLamports = perTransferBaseUnits.reduce((acc, n) => acc + n, 0n)

        // Pre-flight: enough SOL for the bundled total + gas?
        const pre = await checkSettlePreflight({
          connection,
          wallet: publicKey,
          cluster: cluster.network ?? 'devnet',
          asset: 'SOL',
          amountCents: totalCents,
          amountLamports: totalLamports,
          isDevnetLike: (cluster.network ?? 'devnet') !== 'mainnet-beta',
        })
        if (!pre.ok) {
          showPreflightFailure(pre, {
            onSolAirdrop: () =>
              requestDevnetAirdrop({ connection, wallet: publicKey }),
          })
          return
        }

        const tx = await buildBulkSolTransferTx({
          connection,
          fromWallet: publicKey,
          transfers: myDebts.map((t, i) => ({
            toWallet: new PublicKey(t.to),
            amountLamports: perTransferBaseUnits[i],
          })),
        })
        toast.message(`Approve the bundled SOL transfer (${myDebts.length} recipients)…`)
        sig = await sendTransaction(tx, connection)
      } else {
        perTransferBaseUnits = myDebts.map((t) => centsToUsdcBaseUnits(t.amountCents))

        // Pre-flight: enough USDC for the total + a tiny bit of SOL for gas?
        const pre = await checkSettlePreflight({
          connection,
          wallet: publicKey,
          cluster: cluster.network ?? 'devnet',
          asset: 'USDC',
          amountCents: totalCents,
          isDevnetLike: (cluster.network ?? 'devnet') !== 'mainnet-beta',
        })
        if (!pre.ok) {
          showPreflightFailure(pre, {
            onSolAirdrop: () =>
              requestDevnetAirdrop({ connection, wallet: publicKey }),
          })
          return
        }

        const tx = await buildBulkUsdcTransferTx({
          connection,
          fromWallet: publicKey,
          transfers: myDebts.map((t, i) => ({
            toWallet: new PublicKey(t.to),
            amountBaseUnits: perTransferBaseUnits[i],
          })),
          cluster: cluster.network ?? 'devnet',
        })
        toast.message(`Approve the bundled transaction (${myDebts.length} transfers)…`)
        sig = await sendTransaction(tx, connection)
      }

      toast.message('Confirming onchain…')
      await connection.confirmTransaction(sig, 'confirmed')

      // Record each settlement individually so the activity feed has clear rows.
      // All point at the same tx_signature.
      await Promise.all(
        myDebts.map((t, i) =>
          recordSettlement({
            groupId,
            fromWallet: t.from,
            toWallet: t.to,
            amountCents: t.amountCents,
            txSignature: sig,
            asset,
            assetAmountBaseUnits: perTransferBaseUnits[i],
          }),
        ),
      )

      const label =
        asset === 'SOL' && solPrice
          ? `${formatSol(centsToLamports(totalCents, solPrice))} (≈ ${formatCents(totalCents)})`
          : formatCents(totalCents)
      toast.success(`Settled ${label} across ${myDebts.length} people in one tx`)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
            Bundle settlement
          </p>
          <p className="text-sm font-medium mt-0.5">
            Settle all {myDebts.length} debts in one tx
          </p>
          <p className="font-mono-tight tabular-nums text-base">
            {formatCents(totalCents)}
            {asset === 'SOL' && solPrice && (
              <span className="ml-2 text-muted-foreground text-sm">
                ≈ {formatSol(centsToLamports(totalCents, solPrice))}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Asset toggle */}
          <div className="inline-flex rounded-full border border-foreground/15 p-0.5 bg-background/70">
            {(['USDC', 'SOL'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                disabled={submitting}
                className={`rounded-full px-2.5 py-0.5 font-mono-tight text-[10px] uppercase tracking-wider transition ${
                  asset === a
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <motion.div
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.04 }}
            transition={APPLE_SPRING}
          >
            <Button
              size="sm"
              onClick={handleSettleAll}
              disabled={submitting || (asset === 'SOL' && (priceLoading || !solPrice))}
              className="rounded-full bg-foreground text-background hover:opacity-90 px-4"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {submitting
                ? 'Sending…'
                : asset === 'SOL' && priceLoading
                  ? 'Loading…'
                  : 'Settle all'}
            </Button>
          </motion.div>
        </div>
      </div>
      <p className="mt-2 font-mono-tight text-[10px] text-muted-foreground">
        One signature · one onchain transaction · all transfers atomic
      </p>
    </motion.div>
  )
}
