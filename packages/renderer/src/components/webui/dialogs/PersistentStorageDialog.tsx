import { AlertTriangle } from 'lucide-react'
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

function PersistentStorageModal({
  onResolve
}: {
  onResolve: (userApproved: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onResolve(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{i18n('Storage Permission Required')}</DialogTitle>
          <DialogDescription>
            {i18n('This app needs persistent storage to save your conversations')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-warning/20 bg-warning/10 p-4">
            <div className="shrink-0 text-warning">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{i18n('Why is this needed?')}</p>
              <p className="text-muted-foreground">
                {i18n(
                  'Without persistent storage, your browser may delete saved conversations when it needs disk space. Granting this permission ensures your chat history is preserved.'
                )}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">{i18n('What this means:')}</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>{i18n('Your conversations will be saved locally in your browser')}</li>
              <li>{i18n('Data will not be deleted automatically to free up space')}</li>
              <li>{i18n('You can still manually clear data at any time')}</li>
              <li>{i18n('No data is sent to external servers')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onResolve(false)}>
            {i18n('Continue Anyway')}
          </Button>
          <Button type="button" onClick={() => onResolve(true)}>
            {i18n('Grant Permission')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export class PersistentStorageDialog {
  static async request(): Promise<boolean> {
    if (navigator.storage?.persisted) {
      const alreadyPersisted = await navigator.storage.persisted()
      if (alreadyPersisted) {
        console.log('✓ Persistent storage already granted')
        return true
      }
    }

    const userApproved = await new Promise<boolean>((resolve) => {
      let settled = false

      const close = mountDialog((destroy) => (
        <PersistentStorageModal
          onResolve={(approved) => {
            if (settled) return
            settled = true
            destroy()
            resolve(approved)
          }}
        />
      ))

      void close
    })

    if (!userApproved) {
      console.warn('⚠ User declined persistent storage - sessions may be lost')
      return false
    }

    if (!navigator.storage?.persist) {
      console.warn('⚠ Persistent storage API not available')
      return false
    }

    try {
      const granted = await navigator.storage.persist()
      if (granted) {
        console.log('✓ Persistent storage granted - sessions will be preserved')
      } else {
        console.warn('⚠ Browser denied persistent storage - sessions may be lost under storage pressure')
      }
      return granted
    } catch (error) {
      console.error('Failed to request persistent storage:', error)
      return false
    }
  }
}
