import React from 'react'

export function AppFooter() {
  return (
    <footer className="border-t border-foreground/10 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-xs font-mono-tight text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background font-display text-[11px]">
            S
          </span>
          <span>Solit · Settle on Solana</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Built on Solana · USDC settlement</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
