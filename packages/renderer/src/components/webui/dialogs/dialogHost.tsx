import { createRoot } from 'react-dom/client'

export function mountDialog(render: (close: () => void) => React.JSX.Element): () => void {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)

  const close = () => {
    root.unmount()
    host.remove()
  }

  root.render(render(close))
  return close
}
