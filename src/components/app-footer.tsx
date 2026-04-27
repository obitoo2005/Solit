import React from 'react'
import Image from 'next/image'

export function AppFooter() {
  return (
    <footer className="border-t border-foreground/10 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-xs font-mono-tight text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-foreground/10">
            <Image src="/logo.png" alt="Solit" width={20} height={20} className="h-4 w-4 object-contain" />
          </span>
          <span>Solit · Settle on Solana</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Built by Abdul Haseeb · Located in Faisalabad 🇵🇰</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
