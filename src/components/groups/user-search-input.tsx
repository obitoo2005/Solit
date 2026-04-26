'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchProfiles, type Profile } from '@/lib/groups'

type Props = {
  /** Called when the user picks a profile from the dropdown. */
  onPick: (profile: Profile) => void
  /** Wallets that should be filtered out of results (e.g. existing members). */
  excludeWallets?: string[]
  placeholder?: string
}

/**
 * Autocomplete input that searches Solit profiles by display name and lets
 * the user pick one. Designed to sit alongside a paste-wallet textarea so
 * power users can still drop raw addresses in.
 */
export function UserSearchInput({
  onPick,
  excludeWallets = [],
  placeholder = 'Search Solit users by name…',
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Debounced lookup
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const profiles = await searchProfiles(trimmed, 8)
        const filtered = profiles.filter((p) => !excludeWallets.includes(p.wallet))
        setResults(filtered)
        setOpen(true)
      } catch (err) {
        console.error('searchProfiles', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, excludeWallets])

  // Click outside to close the dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handlePick(p: Profile) {
    onPick(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border border-foreground/15 bg-background pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (results.length > 0 || loading || query.trim().length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-foreground/15 bg-background shadow-lg overflow-hidden">
          {loading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No Solit users found. Paste their wallet address below instead.
            </p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {results.map((p) => (
                <li key={p.wallet}>
                  <button
                    type="button"
                    onClick={() => handlePick(p)}
                    className="w-full text-left px-3 py-2 hover:bg-foreground/5 flex items-center gap-3"
                  >
                    <span className="font-medium truncate">{p.display_name || 'Unnamed'}</span>
                    <span className="font-mono-tight text-[10px] text-muted-foreground ml-auto shrink-0">
                      {p.wallet.slice(0, 4)}…{p.wallet.slice(-4)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
