import { castDraft, type Draft } from 'immer'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export interface KanbanEntity {
  id: string
}

export interface KanbanProjectState<TEntity, TStatus extends string> {
  byId: Record<string, TEntity>
  orderByStatus: Record<TStatus, string[]>
  loading: boolean
  activeId: string | null
  lastOverId: string | null
}

export interface KanbanStoreState<TEntity, TStatus extends string> {
  projects: Record<string, KanbanProjectState<TEntity, TStatus>>
  ensure: (
    projectId: string,
    initializer?: () => Partial<KanbanProjectState<TEntity, TStatus>>
  ) => void
  reset: (projectId: string) => void
  setLoading: (projectId: string, loading: boolean) => void
  applyLoaded: (projectId: string, items: TEntity[], opts?: { replaceOrder?: boolean }) => void
  applyStatusLocal: (projectId: string, itemId: string, newStatus: TStatus) => void
  moveWithinStatus: (projectId: string, status: TStatus, activeId: string, overId: string) => void
  moveToStatus: (
    projectId: string,
    activeId: string,
    targetStatus: TStatus,
    overId?: string | null
  ) => void
  setActiveId: (projectId: string, id: string | null) => void
  setLastOverId: (projectId: string, id: string | null) => void
}

export interface CreateKanbanStoreOptions<TEntity extends KanbanEntity, TStatus extends string> {
  statuses: readonly TStatus[]
  getStatus: (entity: TEntity) => TStatus
  setStatus: (entity: TEntity, status: TStatus) => void
}

export type KanbanStoreResult<TEntity extends KanbanEntity, TStatus extends string> = {
  useStore: UseBoundStore<StoreApi<KanbanStoreState<TEntity, TStatus>>>
  defaultProjectState: () => KanbanProjectState<TEntity, TStatus>
  EMPTY_ITEMS: TEntity[]
  selectItems: (
    projectId: string | undefined
  ) => (state: KanbanStoreState<TEntity, TStatus>) => TEntity[]
  selectLoading: (
    projectId: string | undefined
  ) => (state: KanbanStoreState<TEntity, TStatus>) => boolean
  selectActiveId: (
    projectId: string | undefined
  ) => (state: KanbanStoreState<TEntity, TStatus>) => string | null
}

function createEmptyOrderByStatus<TStatus extends string>(
  statuses: readonly TStatus[]
): Record<TStatus, string[]> {
  const result = {} as Record<TStatus, string[]>
  for (const status of statuses) {
    result[status] = []
  }
  return result
}

function flattenItems<TEntity, TStatus extends string>(
  byId: Record<string, TEntity>,
  orderByStatus: Record<TStatus, string[]>,
  statuses: readonly TStatus[]
): TEntity[] {
  const out: TEntity[] = []
  for (const status of statuses) {
    const ids = orderByStatus[status]
    for (const id of ids) {
      const item = byId[id]
      if (item) out.push(item)
    }
  }
  return out
}

export function createKanbanStore<TEntity extends KanbanEntity, TStatus extends string>(
  options: CreateKanbanStoreOptions<TEntity, TStatus>
): KanbanStoreResult<TEntity, TStatus> {
  const { statuses, getStatus, setStatus } = options

  const EMPTY_ITEMS: TEntity[] = []

  const defaultProjectState = (): KanbanProjectState<TEntity, TStatus> => ({
    byId: {},
    orderByStatus: createEmptyOrderByStatus(statuses),
    loading: true,
    activeId: null,
    lastOverId: null
  })

  const itemsSelectorCache = new Map<string, (state: KanbanStoreState<TEntity, TStatus>) => TEntity[]>()
  const loadingSelectorCache = new Map<
    string,
    (state: KanbanStoreState<TEntity, TStatus>) => boolean
  >()
  const activeIdSelectorCache = new Map<
    string,
    (state: KanbanStoreState<TEntity, TStatus>) => string | null
  >()

  const itemsResultCache = new Map<
    string,
    { byId: Record<string, TEntity>; orderByStatus: Record<TStatus, string[]>; result: TEntity[] }
  >()

  const useStore = create<KanbanStoreState<TEntity, TStatus>>()(
    subscribeWithSelector(
      immer((set, get) => {
        type DraftState = Draft<KanbanStoreState<TEntity, TStatus>>

        return {
          projects: {},

          ensure: (projectId, initializer) => {
            const current = get().projects[projectId]
            if (current && !initializer) return

            set((state: DraftState) => {
              const existing = state.projects[projectId]
              if (existing) {
                if (!initializer) return
                const patch = initializer() ?? {}
                Object.assign(existing, patch)
                return
              }
              state.projects[projectId] = castDraft({
                ...defaultProjectState(),
                ...initializer?.()
              })
            })
          },

          reset: (projectId) =>
            set((state: DraftState) => {
              delete state.projects[projectId]
            }),

          setLoading: (projectId, loading) => {
            const project = get().projects[projectId]
            if (!project || project.loading === loading) return

            set((state: DraftState) => {
              const target = state.projects[projectId]
              if (!target) return
              target.loading = loading
            })
          },

          applyLoaded: (projectId, items, opts) => {
            const currentProject = get().projects[projectId]
            if (items.length === 0 && currentProject && Object.keys(currentProject.byId).length === 0) {
              return
            }

            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return

              const replaceOrder = opts?.replaceOrder ?? false
              const loadedById: Record<string, TEntity> = {}
              for (const item of items) {
                loadedById[item.id] = item
              }

              project.byId = castDraft(loadedById)

              const nextOrder = createEmptyOrderByStatus(statuses)
              if (replaceOrder) {
                for (const item of items) {
                  nextOrder[getStatus(item)].push(item.id)
                }
              } else {
                const orderByStatus = project.orderByStatus as Record<TStatus, string[]>
                for (const status of statuses) {
                  const prevIds = orderByStatus[status] ?? []
                  for (const id of prevIds) {
                    const item = loadedById[id]
                    if (item && getStatus(item) === status) {
                      nextOrder[status].push(id)
                    }
                  }
                }

                for (const item of items) {
                  const ids = nextOrder[getStatus(item)]
                  if (!ids.includes(item.id)) ids.push(item.id)
                }
              }

              const orderByStatus = project.orderByStatus as Record<TStatus, string[]>
              for (const status of statuses) {
                orderByStatus[status] = nextOrder[status]
              }
            })
          },

          applyStatusLocal: (projectId, itemId, newStatus) =>
            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return

              const item = project.byId[itemId] as TEntity | undefined
              if (!item || getStatus(item) === newStatus) return

              const orderByStatus = project.orderByStatus as Record<TStatus, string[]>
              for (const status of statuses) {
                const ids = orderByStatus[status]
                const idx = ids.indexOf(itemId)
                if (idx >= 0) ids.splice(idx, 1)
              }

              setStatus(item, newStatus)
              orderByStatus[newStatus].push(itemId)
            }),

          moveWithinStatus: (projectId, status, activeId, overId) =>
            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return

              const orderByStatus = project.orderByStatus as Record<TStatus, string[]>
              const ids = orderByStatus[status]
              const from = ids.indexOf(activeId)
              const to = ids.indexOf(overId)
              if (from < 0 || to < 0 || from === to) return

              const [moved] = ids.splice(from, 1)
              ids.splice(to, 0, moved)
            }),

          moveToStatus: (projectId, activeId, targetStatus, overId) =>
            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return

              const item = project.byId[activeId] as TEntity | undefined
              if (!item) return

              const orderByStatus = project.orderByStatus as Record<TStatus, string[]>
              for (const status of statuses) {
                const ids = orderByStatus[status]
                const idx = ids.indexOf(activeId)
                if (idx >= 0) ids.splice(idx, 1)
              }

              setStatus(item, targetStatus)
              const targetIds = orderByStatus[targetStatus]
              if (!overId) {
                targetIds.push(activeId)
                return
              }

              const overIndex = targetIds.indexOf(overId)
              if (overIndex >= 0) {
                targetIds.splice(overIndex, 0, activeId)
              } else {
                targetIds.push(activeId)
              }
            }),

          setActiveId: (projectId, id) =>
            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return
              project.activeId = id
            }),

          setLastOverId: (projectId, id) =>
            set((state: DraftState) => {
              const project = state.projects[projectId]
              if (!project) return
              project.lastOverId = id
            })
        }
      })
    )
  ) as UseBoundStore<StoreApi<KanbanStoreState<TEntity, TStatus>>>

  const selectItems = (
    projectId: string | undefined
  ): ((state: KanbanStoreState<TEntity, TStatus>) => TEntity[]) => {
    if (!projectId) return () => EMPTY_ITEMS

    let cached = itemsSelectorCache.get(projectId)
    if (!cached) {
      cached = (state: KanbanStoreState<TEntity, TStatus>): TEntity[] => {
        const project = state.projects[projectId]
        if (!project) return EMPTY_ITEMS

        const cacheEntry = itemsResultCache.get(projectId)
        if (
          cacheEntry &&
          cacheEntry.byId === project.byId &&
          cacheEntry.orderByStatus === project.orderByStatus
        ) {
          return cacheEntry.result
        }

        const result = flattenItems(project.byId, project.orderByStatus, statuses)
        itemsResultCache.set(projectId, {
          byId: project.byId,
          orderByStatus: project.orderByStatus,
          result
        })
        return result
      }
      itemsSelectorCache.set(projectId, cached)
    }

    return cached
  }

  const selectLoading = (
    projectId: string | undefined
  ): ((state: KanbanStoreState<TEntity, TStatus>) => boolean) => {
    if (!projectId) return () => true

    let cached = loadingSelectorCache.get(projectId)
    if (!cached) {
      cached = (state: KanbanStoreState<TEntity, TStatus>): boolean =>
        state.projects[projectId]?.loading ?? true
      loadingSelectorCache.set(projectId, cached)
    }

    return cached
  }

  const selectActiveId = (
    projectId: string | undefined
  ): ((state: KanbanStoreState<TEntity, TStatus>) => string | null) => {
    if (!projectId) return () => null

    let cached = activeIdSelectorCache.get(projectId)
    if (!cached) {
      cached = (state: KanbanStoreState<TEntity, TStatus>): string | null =>
        state.projects[projectId]?.activeId ?? null
      activeIdSelectorCache.set(projectId, cached)
    }

    return cached
  }

  return {
    useStore,
    defaultProjectState,
    EMPTY_ITEMS,
    selectItems,
    selectLoading,
    selectActiveId
  }
}
