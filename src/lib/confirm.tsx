'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Imperative confirm dialog matching Solit's editorial aesthetic.
 *
 * Usage:
 *   const ok = await confirm({ title: 'Delete?', confirmLabel: 'Delete', destructive: true })
 *   if (!ok) return
 *
 * Mount <ConfirmDialogHost /> exactly once at the app root.
 */

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type Internal = ConfirmOptions & { resolve: (v: boolean) => void }

// Module-level bridge between the imperative `confirm()` and the React host.
let pushRequest: ((req: Internal) => void) | null = null

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!pushRequest) {
      // Host not mounted — fall back to the browser confirm so calls still work.
      // eslint-disable-next-line no-alert
      resolve(window.confirm(opts.title))
      return
    }
    pushRequest({ ...opts, resolve })
  })
}

export function ConfirmDialogHost() {
  const [request, setRequest] = useState<Internal | null>(null)

  useEffect(() => {
    pushRequest = (req) => setRequest(req)
    return () => {
      pushRequest = null
    }
  }, [])

  function close(result: boolean) {
    if (request) request.resolve(result)
    setRequest(null)
  }

  const open = request != null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{request?.title}</DialogTitle>
          {request?.description && (
            <DialogDescription className="text-muted-foreground">
              {request.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => close(false)}
            className="rounded-full"
          >
            {request?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={() => close(true)}
            className={
              request?.destructive
                ? 'rounded-full bg-rose-600 text-white hover:bg-rose-700 px-5'
                : 'rounded-full bg-foreground text-background hover:opacity-90 px-5'
            }
            autoFocus
          >
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
