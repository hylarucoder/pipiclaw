import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { renderAsync } from 'docx-preview'
import { Download, FileText, X } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
import { Button } from '@renderer/components/ui/button'
import type { Attachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'

type FileType = 'image' | 'pdf' | 'docx' | 'pptx' | 'excel' | 'text'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

function detectFileType(attachment: Attachment): FileType {
  if (attachment.type === 'image') return 'image'
  if (attachment.mimeType === 'application/pdf') return 'pdf'
  if (attachment.mimeType?.includes('wordprocessingml')) return 'docx'
  if (
    attachment.mimeType?.includes('presentationml') ||
    attachment.fileName.toLowerCase().endsWith('.pptx')
  ) {
    return 'pptx'
  }
  if (
    attachment.mimeType?.includes('spreadsheetml') ||
    attachment.mimeType?.includes('ms-excel') ||
    attachment.fileName.toLowerCase().endsWith('.xlsx') ||
    attachment.fileName.toLowerCase().endsWith('.xls')
  ) {
    return 'excel'
  }
  return 'text'
}

function getFileTypeLabel(fileType: FileType): string {
  if (fileType === 'pdf') return i18n('PDF')
  if (fileType === 'docx') return i18n('Document')
  if (fileType === 'pptx') return i18n('Presentation')
  if (fileType === 'excel') return i18n('Spreadsheet')
  return i18n('Text')
}

function renderExcelSheet(worksheet: XLSX.WorkSheet, sheetName: string): HTMLElement {
  const sheetDiv = document.createElement('div')
  const htmlTable = XLSX.utils.sheet_to_html(worksheet, { id: `sheet-${sheetName}` })
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlTable

  const table = tempDiv.querySelector('table')
  if (!table) return sheetDiv

  table.className = 'w-full border-collapse text-foreground'
  table.querySelectorAll('td, th').forEach((cell) => {
    const cellEl = cell as HTMLElement
    cellEl.className = 'border border-border px-3 py-2 text-sm text-left'
  })

  const headerCells = table.querySelectorAll('thead th, tr:first-child td')
  if (headerCells.length > 0) {
    headerCells.forEach((th) => {
      const thEl = th as HTMLElement
      thEl.className =
        'border border-border px-3 py-2 text-sm font-semibold bg-muted text-foreground sticky top-0'
    })
  }

  table.querySelectorAll('tbody tr:nth-child(even)').forEach((row) => {
    ;(row as HTMLElement).className = 'bg-muted/30'
  })

  sheetDiv.appendChild(table)
  return sheetDiv
}

function AttachmentOverlayModal({
  attachment,
  onClose
}: {
  attachment: Attachment
  onClose: () => void
}): React.JSX.Element {
  const [showExtractedText, setShowExtractedText] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileType = useMemo(() => detectFileType(attachment), [attachment])
  const currentLoadingTaskRef = useRef<any>(null)

  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const docxContainerRef = useRef<HTMLDivElement | null>(null)
  const excelContainerRef = useRef<HTMLDivElement | null>(null)
  const pptxContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (currentLoadingTaskRef.current) {
        currentLoadingTaskRef.current.destroy()
        currentLoadingTaskRef.current = null
      }
    }
  }, [onClose])

  useEffect(() => {
    if (showExtractedText || error) return

    const renderPdf = async () => {
      const container = pdfContainerRef.current
      if (!container) return

      let pdf: any = null
      try {
        const arrayBuffer = base64ToArrayBuffer(attachment.content)
        if (currentLoadingTaskRef.current) {
          currentLoadingTaskRef.current.destroy()
        }

        currentLoadingTaskRef.current = pdfjsLib.getDocument({ data: arrayBuffer })
        pdf = await currentLoadingTaskRef.current.promise
        currentLoadingTaskRef.current = null

        container.innerHTML = ''
        const wrapper = document.createElement('div')
        container.appendChild(wrapper)

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum)
          const pageContainer = document.createElement('div')
          pageContainer.className = 'mb-4 last:mb-0'

          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          const viewport = page.getViewport({ scale: 1.5 })
          canvas.height = viewport.height
          canvas.width = viewport.width
          canvas.className = 'mx-auto block h-auto w-full max-w-full rounded border border-border bg-white shadow-sm'

          if (context) {
            context.fillStyle = 'white'
            context.fillRect(0, 0, canvas.width, canvas.height)
          }

          await page.render({ canvasContext: context!, viewport, canvas }).promise
          pageContainer.appendChild(canvas)

          if (pageNum < pdf.numPages) {
            const separator = document.createElement('div')
            separator.className = 'my-4 h-px bg-border'
            pageContainer.appendChild(separator)
          }

          wrapper.appendChild(pageContainer)
        }
      } catch (pdfError: unknown) {
        console.error('Error rendering PDF:', pdfError)
        setError(pdfError instanceof Error ? pdfError.message : i18n('Failed to load PDF'))
      } finally {
        if (pdf) {
          pdf.destroy()
        }
      }
    }

    const renderDocx = async () => {
      const container = docxContainerRef.current
      if (!container) return

      try {
        const arrayBuffer = base64ToArrayBuffer(attachment.content)
        container.innerHTML = ''

        const wrapper = document.createElement('div')
        wrapper.className = 'docx-wrapper-custom'
        container.appendChild(wrapper)

        await renderAsync(arrayBuffer, wrapper as HTMLElement, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true
        })

        const style = document.createElement('style')
        style.textContent = `
          .docx-overlay-container {
            padding: 0;
          }
          .docx-overlay-container .docx-wrapper-custom {
            max-width: 100%;
            overflow-x: auto;
          }
          .docx-overlay-container .docx-wrapper {
            max-width: 100% !important;
            margin: 0 !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .docx-overlay-container .docx-wrapper > section.docx {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 2em !important;
            background: white !important;
            color: black !important;
            max-width: 100% !important;
            width: 100% !important;
            min-width: 0 !important;
            overflow-x: auto !important;
          }
          .docx-overlay-container table {
            max-width: 100% !important;
            width: auto !important;
            overflow-x: auto !important;
            display: block !important;
          }
          .docx-overlay-container img {
            max-width: 100% !important;
            height: auto !important;
          }
          .docx-overlay-container p,
          .docx-overlay-container span,
          .docx-overlay-container div {
            max-width: 100% !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          .docx-overlay-container .docx-page-break {
            display: none !important;
          }
        `
        container.appendChild(style)
      } catch (docxError: unknown) {
        console.error('Error rendering DOCX:', docxError)
        setError(docxError instanceof Error ? docxError.message : i18n('Failed to load document'))
      }
    }

    const renderExcel = async () => {
      const container = excelContainerRef.current
      if (!container) return

      try {
        const arrayBuffer = base64ToArrayBuffer(attachment.content)
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })

        container.innerHTML = ''
        const wrapper = document.createElement('div')
        wrapper.className = 'flex h-full flex-col overflow-auto'
        container.appendChild(wrapper)

        if (workbook.SheetNames.length > 1) {
          const tabContainer = document.createElement('div')
          tabContainer.className = 'sticky top-0 z-10 mb-4 flex gap-2 border-b border-border bg-card'
          const sheetContents: HTMLElement[] = []

          workbook.SheetNames.forEach((sheetName, index) => {
            const tab = document.createElement('button')
            tab.textContent = sheetName
            tab.className =
              index === 0
                ? 'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary'
                : 'px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-b-2 hover:border-border hover:text-foreground'

            const sheetDiv = document.createElement('div')
            sheetDiv.style.display = index === 0 ? 'flex' : 'none'
            sheetDiv.className = 'flex-1 overflow-auto'
            sheetDiv.appendChild(renderExcelSheet(workbook.Sheets[sheetName], sheetName))
            sheetContents.push(sheetDiv)

            tab.onclick = () => {
              tabContainer.querySelectorAll('button').forEach((btn, btnIndex) => {
                btn.className =
                  btnIndex === index
                    ? 'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary'
                    : 'px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-b-2 hover:border-border hover:text-foreground'
              })
              sheetContents.forEach((content, contentIndex) => {
                content.style.display = contentIndex === index ? 'flex' : 'none'
              })
            }

            tabContainer.appendChild(tab)
          })

          wrapper.appendChild(tabContainer)
          sheetContents.forEach((content) => wrapper.appendChild(content))
          return
        }

        const sheetName = workbook.SheetNames[0]
        wrapper.appendChild(renderExcelSheet(workbook.Sheets[sheetName], sheetName))
      } catch (excelError: unknown) {
        console.error('Error rendering Excel:', excelError)
        setError(excelError instanceof Error ? excelError.message : i18n('Failed to load spreadsheet'))
      }
    }

    const renderPptx = async () => {
      const container = pptxContainerRef.current
      if (!container) return

      try {
        container.innerHTML = ''
        const wrapper = document.createElement('div')
        wrapper.className = 'overflow-auto p-6'

        const pre = document.createElement('pre')
        pre.className = 'whitespace-pre-wrap font-mono text-sm text-foreground'
        pre.textContent = attachment.extractedText || i18n('No text content available')

        wrapper.appendChild(pre)
        container.appendChild(wrapper)
      } catch (pptxError: unknown) {
        console.error('Error rendering extracted text:', pptxError)
        setError(pptxError instanceof Error ? pptxError.message : i18n('Failed to display text content'))
      }
    }

    if (fileType === 'pdf') {
      void renderPdf()
    } else if (fileType === 'docx') {
      void renderDocx()
    } else if (fileType === 'excel') {
      void renderExcel()
    } else if (fileType === 'pptx') {
      void renderPptx()
    }
  }, [attachment, error, fileType, showExtractedText])

  const handleDownload = () => {
    const byteCharacters = atob(attachment.content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: attachment.mimeType })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = attachment.fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const hasExtractedText = Boolean(attachment.extractedText)
  const showToggle =
    fileType !== 'image' && fileType !== 'text' && fileType !== 'pptx' && hasExtractedText

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="border-b border-border bg-background/95 backdrop-blur" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm font-medium text-foreground">{attachment.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            {showToggle ? (
              <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                <Button
                  variant={showExtractedText ? 'ghost' : 'secondary'}
                  size="xs"
                  onClick={() => {
                    setShowExtractedText(false)
                    setError(null)
                  }}
                >
                  {getFileTypeLabel(fileType)}
                </Button>
                <Button
                  variant={showExtractedText ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => {
                    setShowExtractedText(true)
                    setError(null)
                  }}
                >
                  <FileText className="size-3" />
                  {i18n('Text')}
                </Button>
              </div>
            ) : null}
            <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
              <Download className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="max-w-2xl rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            <div className="mb-1 font-medium">{i18n('Error loading file')}</div>
            <div className="text-sm opacity-90">{error}</div>
          </div>
        ) : showExtractedText && fileType !== 'image' ? (
          <div className="h-full w-full max-w-4xl overflow-auto border border-border bg-card p-6 text-foreground">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {attachment.extractedText || i18n('No text content available')}
            </pre>
          </div>
        ) : fileType === 'image' ? (
          <img
            src={`data:${attachment.mimeType};base64,${attachment.content}`}
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            alt={attachment.fileName}
          />
        ) : fileType === 'pdf' ? (
          <div
            ref={pdfContainerRef}
            className="h-full w-full max-w-[1000px] overflow-auto border border-border bg-card text-foreground shadow-lg"
          />
        ) : fileType === 'docx' ? (
          <div
            ref={docxContainerRef}
            className="docx-overlay-container h-full w-full max-w-[1000px] overflow-auto border border-border bg-card text-foreground shadow-lg"
          />
        ) : fileType === 'excel' ? (
          <div
            ref={excelContainerRef}
            className="h-full w-full overflow-auto bg-card text-foreground"
          />
        ) : fileType === 'pptx' ? (
          <div
            ref={pptxContainerRef}
            className="h-full w-full max-w-[1000px] overflow-auto border border-border bg-card text-foreground shadow-lg"
          />
        ) : (
          <div className="h-full w-full max-w-4xl overflow-auto border border-border bg-card p-6 text-foreground">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {attachment.extractedText || i18n('No content available')}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export class AttachmentOverlay {
  static open(attachment: Attachment, onCloseCallback?: () => void): void {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const close = () => {
      root.unmount()
      host.remove()
      onCloseCallback?.()
    }

    root.render(<AttachmentOverlayModal attachment={attachment} onClose={close} />)
  }
}
