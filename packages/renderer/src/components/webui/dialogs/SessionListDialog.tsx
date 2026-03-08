import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import type { SessionMetadata } from '@renderer/features/webui/storage/types.js'
import { formatUsage } from '@renderer/features/webui/utils/format.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { ConfirmDialog } from './ConfirmDialog'
import { mountDialog } from './dialogHost'

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return i18n('Today')
  if (days === 1) return i18n('Yesterday')
  if (days < 7) return i18n('{days} days ago').replace('{days}', days.toString())
  return date.toLocaleDateString()
}

function SessionListModal({
  onSelect,
  onDelete,
  onClose
}: {
  onSelect: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const deletedSessionsRef = useRef<Set<string>>(new Set())
  const closedViaSelectionRef = useRef(false)

  const loadSessions = async () => {
    setLoading(true)
    try {
      const storage = getAppStorage()
      setSessions(await storage.sessions.getAllMetadata())
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  const closeWithNotify = () => {
    if (!closedViaSelectionRef.current && onDelete && deletedSessionsRef.current.size > 0) {
      for (const sessionId of deletedSessionsRef.current) {
        onDelete(sessionId)
      }
    }
    onClose()
  }

  const handleDelete = async (sessionId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    const confirmed = await ConfirmDialog.confirm({
      title: 'Delete session',
      message: i18n('Delete this session?'),
      confirmLabel: i18n('Delete'),
      destructive: true
    })

    if (!confirmed) return

    try {
      await getAppStorage().sessions.deleteSession(sessionId)
      deletedSessionsRef.current.add(sessionId)
      await loadSessions()
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeWithNotify()
        }
      }}
    >
      <DialogContent className="sm:max-h-[90vh] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{i18n('Sessions')}</DialogTitle>
          <DialogDescription>{i18n('Load a previous conversation')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {loading ? <div className="py-8 text-center text-muted-foreground">{i18n('Loading...')}</div> : null}

          {!loading && sessions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{i18n('No sessions yet')}</div>
          ) : null}

          {!loading
            ? sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary/50"
                  onClick={() => {
                    closedViaSelectionRef.current = true
                    onSelect(session.id)
                    onClose()
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{session.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(session.lastModified)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {session.messageCount} {i18n('messages')} · {formatUsage(session.usage)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive transition-colors hover:bg-destructive/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    title={i18n('Delete')}
                    onClick={(event) => {
                      void handleDelete(session.id, event)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </button>
              ))
            : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export class SessionListDialog {
  static async open(onSelect: (sessionId: string) => void, onDelete?: (sessionId: string) => void): Promise<void> {
    mountDialog((destroy) => (
      <SessionListModal onSelect={onSelect} onDelete={onDelete} onClose={destroy} />
    ))
  }
}
