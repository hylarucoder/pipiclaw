import type { LucideIcon } from 'lucide-react'
import {
  BookText,
  FolderKanban,
  FolderOpenDot,
  ImagePlus,
  MessageSquare,
  NotebookText,
  Paintbrush2,
  Settings
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

type RailItem = {
  labelKey: string
  icon: LucideIcon
  path: '/notes' | '/files' | '/journal' | '/draw' | '/imagen' | '/kanban' | '/chat'
}

const railItems: RailItem[] = [
  { labelKey: 'notes', icon: NotebookText, path: '/notes' },
  { labelKey: 'files', icon: FolderOpenDot, path: '/files' },
  { labelKey: 'journal', icon: BookText, path: '/journal' },
  { labelKey: 'kanban', icon: FolderKanban, path: '/kanban' },
  { labelKey: 'draw', icon: Paintbrush2, path: '/draw' },
  { labelKey: 'imagen', icon: ImagePlus, path: '/imagen' },
  { labelKey: 'chat', icon: MessageSquare, path: '/chat' }
]

export function NavigationRail(): React.JSX.Element {
  const { t } = useTranslation('navigation')

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col items-center gap-1 p-0.5">
        {railItems.map((item) => {
          const Icon = item.icon
          const label = t(item.labelKey)
          return (
            <NavLink
              key={item.labelKey}
              to={item.path}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex w-full items-center justify-center rounded-md p-1.5 transition-colors',
                  isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted'
                )
              }
            >
              <Icon className="size-4" />
            </NavLink>
          )
        })}
        <NavLink
          to="/settings"
          title={t('settings')}
          className={({ isActive }) =>
            cn(
              'mt-auto flex w-full items-center justify-center rounded-md p-1.5 transition-colors',
              isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted'
            )
          }
        >
          <Settings className="size-4" />
        </NavLink>
      </CardContent>
    </Card>
  )
}
