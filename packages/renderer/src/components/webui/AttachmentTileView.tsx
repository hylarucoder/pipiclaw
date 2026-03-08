import { FileSpreadsheet, FileText, X } from 'lucide-react'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import type { Attachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { AttachmentOverlay } from './dialogs/AttachmentOverlay.js'

export interface AttachmentTileViewProps {
  attachment: Attachment
  onDelete?: () => void
  clickable?: boolean
}

export function AttachmentTileView({
  attachment,
  onDelete,
  clickable = true
}: AttachmentTileViewProps): React.JSX.Element {
  const hasPreview = Boolean(attachment.preview)
  const isImage = attachment.type === 'image'
  const isPdf = attachment.mimeType === 'application/pdf'
  const isExcel =
    attachment.mimeType?.includes('spreadsheetml') ||
    attachment.fileName.toLowerCase().endsWith('.xlsx') ||
    attachment.fileName.toLowerCase().endsWith('.xls')

  const openOverlay = () => {
    if (!clickable) return
    AttachmentOverlay.open(attachment)
  }

  return (
    <div className="group relative inline-block">
      {hasPreview ? (
        <div className="relative">
          <img
            src={`data:${isImage ? attachment.mimeType : 'image/png'};base64,${attachment.preview}`}
            className={`h-16 w-16 rounded-lg border border-input object-cover transition-opacity ${clickable ? 'cursor-pointer hover:opacity-80' : ''}`}
            alt={attachment.fileName}
            title={attachment.fileName}
            onClick={openOverlay}
          />
          {isPdf ? (
            <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-background/90 px-1 py-0.5">
              <div className="text-center text-[10px] font-medium text-muted-foreground">
                {i18n('PDF')}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-input bg-muted p-2 text-muted-foreground transition-opacity ${clickable ? 'cursor-pointer hover:opacity-80' : ''}`}
          onClick={openOverlay}
          title={attachment.fileName}
        >
          {isExcel ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
          <div className="w-full truncate text-center text-[10px]">
            {attachment.fileName.length > 10
              ? `${attachment.fileName.substring(0, 8)}...`
              : attachment.fileName}
          </div>
        </div>
      )}
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-input bg-background text-muted-foreground opacity-100 shadow-sm transition-opacity hover:bg-muted hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          title={i18n('Remove')}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}
