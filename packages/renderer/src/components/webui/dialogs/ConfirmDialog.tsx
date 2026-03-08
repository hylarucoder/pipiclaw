import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { mountDialog } from './dialogHost'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

function ConfirmDialogModal({
  options,
  onResolve
}: {
  options: ConfirmDialogOptions
  onResolve: (confirmed: boolean) => void
}): React.JSX.Element {
  const title = options.title || i18n('Confirm')
  const confirmLabel = options.confirmLabel || i18n('Confirm')
  const cancelLabel = options.cancelLabel || i18n('Cancel')

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onResolve(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{options.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onResolve(false)
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={options.destructive ? 'destructive' : 'default'}
            onClick={() => {
              onResolve(true)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export class ConfirmDialog {
  static async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false

      const close = mountDialog((destroy) => (
        <ConfirmDialogModal
          options={options}
          onResolve={(confirmed) => {
            if (settled) return
            settled = true
            destroy()
            resolve(confirmed)
          }}
        />
      ))

      void close
    })
  }
}
