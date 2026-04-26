'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/button'
import { Menu, X, User } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'
import { WalletButton } from '@/components/solana/solana-provider'
import { useProfiles } from '@/components/profile/profile-context'
import { ProfileDialog } from '@/components/profile/profile-dialog'
import { NotificationsBell } from '@/components/notifications/notifications-bell'

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { connected } = useWallet()
  const { myProfile, needsOnboarding } = useProfiles()

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setShowMenu(false)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open so the page underneath
  // doesn't continue to scroll behind it.
  useEffect(() => {
    if (!showMenu) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showMenu])

  const profileChip = connected ? (
    <button
      onClick={() => setProfileOpen(true)}
      className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono-tight transition ${
        needsOnboarding
          ? 'border-amber-500/40 bg-amber-50/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 animate-pulse'
          : 'border-foreground/15 bg-background/70 text-foreground/80 hover:border-foreground/40'
      }`}
      title={myProfile?.display_name ? 'Edit your name' : 'Set your name'}
    >
      <User className="h-3 w-3" />
      {myProfile?.display_name ?? 'Set your name'}
    </button>
  ) : null

  return (
    <header className="relative z-50 border-b border-foreground/10 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
        {/* Brand */}
        <Link className="flex items-center gap-2.5" href="/">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background font-display text-lg">
            S
          </span>
          <span className="font-display text-2xl leading-none">Solit</span>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
          {links.map(({ label, path }) => (
            <Link
              key={path}
              href={path}
              className={`text-sm transition hover:text-foreground ${
                isActive(path) ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="hidden md:flex items-center gap-2">
          <NotificationsBell />
          {profileChip}
          <WalletButton />
        </div>

        {/* Mobile menu trigger */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowMenu(!showMenu)}>
          {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {showMenu && (
          <div
            className="md:hidden fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto bg-background border-t border-foreground/10"
          >
            <div className="flex flex-col p-5 gap-5">
              <ul className="flex flex-col gap-1">
                {links.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`block rounded-lg px-3 py-3 text-base transition ${
                        isActive(path)
                          ? 'bg-foreground/5 text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-foreground/5'
                      }`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              {connected && (
                <button
                  onClick={() => {
                    setProfileOpen(true)
                    setShowMenu(false)
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm transition ${
                    needsOnboarding
                      ? 'border border-amber-500/40 bg-amber-50/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
                      : 'border border-foreground/10 bg-background hover:bg-foreground/5 text-foreground/80'
                  }`}
                >
                  <User className="h-4 w-4" />
                  {myProfile?.display_name ?? 'Set your name'}
                </button>
              )}

              <div className="flex flex-col gap-3 pt-4 border-t border-foreground/10">
                <WalletButton />
                <ClusterUiSelect />
                <ThemeSelect />
              </div>
            </div>
          </div>
        )}
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  )
}
