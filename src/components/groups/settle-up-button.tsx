'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { buildUsdcTransferTx, centsToUsdcBaseUnits, formatCents } from '@/lib/solana/usdc'
import { buildSolTransferTx } from '@/lib/solana/sol'
import { centsToLamports, formatSol, getSolUsdPrice } from '@/lib/price'
import { recordSettlement, type GroupMember, type SettlementAsset } from '@/lib/groups'
import { APPLE_SPRING } from '@/components/motion'
import { useProfiles } from '@/components/profile/profile-context'
import { checkSettlePreflight, requestDevnetAirdrop, showPreflightFailure } from '@/lib/preflight'

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
  const [asset, setAsset] = useState<SettlementAsset>('USDC')
  const [solPrice, setSolPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  const isMine = transfer.from === myWallet
  const fromName = members.find((m) => m.wallet === transfer.from)?.display_name || resolveName(transfer.from)
  const toName = members.find((m) => m.wallet === transfer.to)?.display_name || resolveName(transfer.to)

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
      let sig: string
      let assetAmountBaseUnits: bigint

      if (asset === 'SOL') {
        if (!solPrice) {
          toast.error('SOL price not loaded yet')
          return
        }
        assetAmountBaseUnits = centsToLamports(transfer.amountCents, solPrice)

        // Pre-flight: do we have enough SOL for the amount + gas?
        const pre = await checkSettlePreflight({
          connection,
          wallet: publicKey,
          cluster: cluster.network ?? 'devnet',
          asset: 'SOL',
          amountCents: transfer.amountCents,
          amountLamports: assetAmountBaseUnits,
          isDevnetLike: (cluster.network ?? 'devnet') !== 'mainnet-beta',
        })
        if (!pre.ok) {
          showPreflightFailure(pre, {
            onSolAirdrop: () =>
              requestDevnetAirdrop({ connection, wallet: publicKey }),
          })
          return
        }

        const tx = await buildSolTransferTx({
          connection,
          fromWallet: publicKey,
          toWallet: new PublicKey(transfer.to),
          amountLamports: assetAmountBaseUnits,
        })
        toast.message('Approve the SOL transfer in your wallet…')
        sig = await sendTransaction(tx, connection)
      } else {
        assetAmountBaseUnits = centsToUsdcBaseUnits(transfer.amountCents)

        // Pre-flight: USDC for the amount + a tiny bit of SOL for gas?
        const pre = await checkSettlePreflight({
          connection,
          wallet: publicKey,
          cluster: cluster.network ?? 'devnet',
          asset: 'USDC',
          amountCents: transfer.amountCents,
          isDevnetLike: (cluster.network ?? 'devnet') !== 'mainnet-beta',
        })
        if (!pre.ok) {
          showPreflightFailure(pre, {
            onSolAirdrop: () =>
              requestDevnetAirdrop({ connection, wallet: publicKey }),
          })
          return
        }

        const tx = await buildUsdcTransferTx({
          connection,
          fromWallet: publicKey,
          toWallet: new PublicKey(transfer.to),
          amountBaseUnits: assetAmountBaseUnits,
          cluster: cluster.network ?? 'devnet',
        })
        toast.message('Approve the transaction in your wallet…')
        sig = await sendTransaction(tx, connection)
      }

      toast.message('Confirming onchain…')
      await connection.confirmTransaction(sig, 'confirmed')

      await recordSettlement({
        groupId,
        fromWallet: transfer.from,
        toWallet: transfer.to,
        amountCents: transfer.amountCents,
        txSignature: sig,
        asset,
        assetAmountBaseUnits,
      })

      const amountLabel =
        asset === 'SOL'
          ? `${formatSol(assetAmountBaseUnits)} (≈ ${formatCents(transfer.amountCents)})`
          : formatCents(transfer.amountCents)
      toast.success(`Settled ${amountLabel} to ${toName}`)
      onSettled()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Settlement failed'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const solAmountPreview =
    asset === 'SOL' && solPrice
      ? formatSol(centsToLamports(transfer.amountCents, solPrice))
      : null

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -1 }}
      className="rounded-lg border border-foreground/10 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="text-sm min-w-0">
        <p className="truncate">
          <span className="font-medium">{fromName}</span>
          <span className="text-muted-foreground"> owes </span>
          <span className="font-medium">{toName}</span>
        </p>
        <p className="mt-0.5 font-mono-tight tabular-nums text-base">
          {formatCents(transfer.amountCents)}
          {solAmountPreview && (
            <span className="ml-2 text-muted-foreground text-sm">≈ {solAmountPreview}</span>
          )}
        </p>
      </div>

      {isMine ? (
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
              onClick={handleSettle}
              disabled={submitting || (asset === 'SOL' && (priceLoading || !solPrice))}
              className="rounded-full bg-foreground text-background hover:opacity-90 px-4"
            >
              {submitting
                ? 'Sending…'
                : asset === 'SOL' && priceLoading
                  ? 'Loading price…'
                  : `Settle in ${asset}`}
            </Button>
          </motion.div>
        </div>
      ) : (
        <span className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          awaiting payer
        </span>
      )}
    </motion.li>
  )
}
