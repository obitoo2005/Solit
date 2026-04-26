'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { RefreshCw, AlertCircle, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useCluster } from '../cluster/cluster-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import {
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useRequestAirdrop,
  useTransferSol,
} from './account-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppModal } from '@/components/app-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountBalance({ address }: { address: PublicKey }) {
  const query = useGetBalance({ address })

  return (
    <h1
      className="text-5xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => {
        query.refetch()
        toast.message('Refreshing balance…')
      }}
      title="Click to refresh"
    >
      {query.data != null ? <BalanceSol balance={query.data} /> : '…'} SOL
    </h1>
  )
}

export function AccountChecker() {
  const { publicKey } = useWallet()
  if (!publicKey) {
    return null
  }
  return <AccountBalanceCheck address={publicKey} />
}

export function AccountBalanceCheck({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  const mutation = useRequestAirdrop({ address })
  const query = useGetBalance({ address })
  const dismissKey = `solit:account-banner-dismissed:${cluster.name}:${address.toBase58()}`
  const [dismissed, setDismissed] = useState(false)

  // Hydrate dismissed flag from sessionStorage once on mount / when key changes.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey) === '1')
    } catch {
      // sessionStorage may be unavailable (private mode, etc.)
    }
  }, [dismissKey])

  function handleDismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(dismissKey, '1')
    } catch {
      // ignore
    }
  }

  if (query.isLoading || dismissed) {
    return null
  }
  if (query.isError || !query.data) {
    const isMainnet = cluster.network?.includes('mainnet')
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-200 leading-snug">
              Connected to <strong>{cluster.name}</strong> — this wallet has no balance on this cluster yet.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {!isMainnet && (
              <Button
                variant="outline"
                size="sm"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation
                    .mutateAsync(1)
                    .catch((err) => console.log(err))
                }
              >
                {mutation.isPending ? 'Requesting…' : 'Request Airdrop'}
              </Button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-900/70 hover:bg-amber-500/10 dark:text-amber-200/70 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function AccountButtons({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  return (
    <div>
      <div className="space-x-2">
        {cluster.network?.includes('mainnet') ? null : <ModalAirdrop address={address} />}
        <ModalSend address={address} />
        <ModalReceive address={address} />
      </div>
    </div>
  )
}

export function AccountTokens({ address }: { address: PublicKey }) {
  const [showAll, setShowAll] = useState(false)
  const query = useGetTokenAccounts({ address })
  const client = useQueryClient()
  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <div className="space-y-2">
      <div className="justify-between">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Token Accounts</h2>
          <div className="space-x-2">
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={async () => {
                await query.refetch()
                await client.invalidateQueries({
                  queryKey: ['getTokenAccountBalance'],
                })
                toast.success('Token accounts refreshed')
              }}
              title="Refresh token accounts"
            >
              <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </div>
      {query.isError && <pre className="alert alert-error">Error: {query.error?.message.toString()}</pre>}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No token accounts found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Public Key</TableHead>
                  <TableHead>Mint</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map(({ account, pubkey }) => (
                  <TableRow key={pubkey.toString()}>
                    <TableCell>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink label={ellipsify(pubkey.toString())} path={`account/${pubkey.toString()}`} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink
                            label={ellipsify(account.data.parsed.info.mint)}
                            path={`account/${account.data.parsed.info.mint.toString()}`}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono">{account.data.parsed.info.tokenAmount.uiAmount}</span>
                    </TableCell>
                  </TableRow>
                ))}

                {(query.data?.length ?? 0) > 5 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

export function AccountTransactions({ address }: { address: PublicKey }) {
  const query = useGetSignatures({ address })
  const [showAll, setShowAll] = useState(false)

  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="space-x-2">
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={async () => {
              await query.refetch()
              toast.success('Transactions refreshed')
            }}
            title="Refresh transactions"
          >
            <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>
      {query.isError && <pre className="alert alert-error">Error: {query.error?.message.toString()}</pre>}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No transactions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signature</TableHead>
                  <TableHead className="text-right">Slot</TableHead>
                  <TableHead>Block Time</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => (
                  <TableRow key={item.signature}>
                    <TableHead className="font-mono">
                      <ExplorerLink path={`tx/${item.signature}`} label={ellipsify(item.signature, 8)} />
                    </TableHead>
                    <TableCell className="font-mono text-right">
                      <ExplorerLink path={`block/${item.slot}`} label={item.slot.toString()} />
                    </TableCell>
                    <TableCell>{new Date((item.blockTime ?? 0) * 1000).toISOString()}</TableCell>
                    <TableCell className="text-right">
                      {item.err ? (
                        <span className="text-red-500" title={item.err.toString()}>
                          Failed
                        </span>
                      ) : (
                        <span className="text-green-500">Success</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(query.data?.length ?? 0) > 5 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

function BalanceSol({ balance }: { balance: number }) {
  return <span>{Math.round((balance / LAMPORTS_PER_SOL) * 100000) / 100000}</span>
}

function ModalReceive({ address }: { address: PublicKey }) {
  return (
    <AppModal title="Receive">
      <p>Receive assets by sending them to your public key:</p>
      <code>{address.toString()}</code>
    </AppModal>
  )
}

function ModalAirdrop({ address }: { address: PublicKey }) {
  const mutation = useRequestAirdrop({ address })
  const [amount, setAmount] = useState('2')

  return (
    <AppModal
      title="Airdrop"
      submitDisabled={!amount || mutation.isPending}
      submitLabel="Request Airdrop"
      submit={() => mutation.mutateAsync(parseFloat(amount))}
    >
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}

function ModalSend({ address }: { address: PublicKey }) {
  const wallet = useWallet()
  const mutation = useTransferSol({ address })
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('1')

  if (!address || !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }

  return (
    <AppModal
      title="Send"
      submitDisabled={!destination || !amount || mutation.isPending}
      submitLabel="Send"
      submit={() => {
        mutation.mutateAsync({
          destination: new PublicKey(destination),
          amount: parseFloat(amount),
        })
      }}
    >
      <Label htmlFor="destination">Destination</Label>
      <Input
        disabled={mutation.isPending}
        id="destination"
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination"
        type="text"
        value={destination}
      />
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}
