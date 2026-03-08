import { useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ProviderKeyInputView } from '@renderer/components/webui/ProviderKeyInputView'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { mountDialog } from './dialogHost'

function ApiKeyPromptModal({
  provider,
  onResolve
}: {
  provider: string
  onResolve: (success: boolean) => void
}): React.JSX.Element {
  const resolvedRef = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const hasKey = Boolean(await getAppStorage().providerKeys.get(provider))
      if (!hasKey || resolvedRef.current) return

      resolvedRef.current = true
      onResolve(true)
    }, 500)

    return () => {
      window.clearInterval(timer)
    }
  }, [onResolve, provider])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !resolvedRef.current) {
          resolvedRef.current = true
          onResolve(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{i18n('API Key Required')}</DialogTitle>
        </DialogHeader>
        <ProviderKeyInputView provider={provider} />
      </DialogContent>
    </Dialog>
  )
}

export class ApiKeyPromptDialog {
  static async prompt(provider: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false

      mountDialog((destroy) => (
        <ApiKeyPromptModal
          provider={provider}
          onResolve={(success) => {
            if (settled) return
            settled = true
            destroy()
            resolve(success)
          }}
        />
      ))
    })
  }
}
