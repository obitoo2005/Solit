'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Fixed bottom-right floating utility: theme toggle only.
 * Cluster switcher is available via the mobile menu.
 *
 * The trigger is intentionally ghost-styled (no border, no inner background)
 * so it sits flush inside the floating pill instead of looking like a
 * button-inside-a-button.
 */
export function FloatingControls() {
  const { setTheme } = useTheme()

  return (
    <div className="hidden md:flex fixed bottom-5 right-5 z-40 items-center rounded-full border border-foreground/10 bg-background/85 backdrop-blur-md shadow-lg shadow-black/5">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Toggle theme"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:text-foreground hover:bg-foreground/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
