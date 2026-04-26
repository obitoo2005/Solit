'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/lib/groups'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

export function NotificationsBell() {
  const { publicKey, connected } = useWallet()
  const wallet = publicKey?.toBase58()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const unread = items.filter((n) => !n.read_at).length

  // Load notifications when wallet connects / changes
  useEffect(() => {
    if (!wallet) {
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    listNotifications(wallet)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((err) => logError('listNotifications', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [wallet])

  // Realtime subscription: live-prepend new notifications + toast them.
  useEffect(() => {
    if (!wallet) return
    const channel = supabase
      .channel(`notifications:${wallet}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_wallet=eq.${wallet}`,
        },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          const n = payload.new
          setItems((prev) => [n, ...prev].slice(0, 30))
          // Show a toast for live arrivals
          toast(n.title, { description: n.body ?? undefined })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [wallet])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function handleMarkAllRead() {
    if (!wallet || unread === 0) return
    try {
      await markAllNotificationsRead(wallet)
      const now = new Date().toISOString()
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    } catch (err) {
      logError('markAllRead', err)
    }
  }

  async function handleItemClick(n: Notification) {
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id)
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
        )
      } catch (err) {
        logError('markRead', err)
      }
    }
    setOpen(false)
  }

  if (!connected || !wallet) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 hover:bg-foreground/5 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-mono-tight tabular-nums text-white px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-xl border border-foreground/15 bg-background shadow-lg z-50"
          >
            <div className="sticky top-0 bg-background flex items-center justify-between px-4 py-2 border-b border-foreground/10">
              <p className="font-display text-base">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-foreground/5">
                {items.map((n) => {
                  const inner = (
                    <div
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.04] transition-colors ${
                        n.read_at ? '' : 'bg-foreground/[0.02]'
                      }`}
                    >
                      {!n.read_at && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        )}
                        <p className="mt-1 font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => handleItemClick(n)}>
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className="block w-full text-left"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
