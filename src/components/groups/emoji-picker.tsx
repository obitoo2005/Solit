'use client'

import { useState } from 'react'

/**
 * Tiny emoji picker — a curated set of common expense categories.
 * Click a chip to select; click again to clear.
 * Keeps things calm: no full-on emoji-mart bundle.
 */

const PRESET_EMOJIS = [
  '🍔', '🍕', '🍣', '☕', '🍺', '🍷',
  '🛒', '🚕', '✈️', '🏨', '🎬', '🎟️',
  '🏠', '💡', '🚗', '⛽', '🎁', '💊',
  '🏋️', '✂️', '🐕', '👕', '📚', '🛠️',
] as const

type Props = {
  value: string | null
  onChange: (emoji: string | null) => void
  disabled?: boolean
}

export function EmojiPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-foreground/15 bg-background hover:border-foreground/40 text-lg leading-none transition-colors"
          title={value ? 'Change emoji' : 'Add emoji'}
        >
          {value || '➕'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="font-mono-tight text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-lg border border-foreground/10 bg-background p-2 grid grid-cols-8 gap-1">
          {PRESET_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onChange(e)
                setOpen(false)
              }}
              disabled={disabled}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-md text-lg leading-none transition-colors ${
                value === e
                  ? 'bg-foreground/10 ring-1 ring-foreground/30'
                  : 'hover:bg-foreground/5'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
