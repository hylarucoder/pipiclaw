const PATCH_FLAG = '__pipiclaw_custom_elements_define_patch__'

type PatchedRegistry = CustomElementRegistry & {
  [PATCH_FLAG]?: boolean
}

function installCustomElementsHmrPatch(): void {
  if (!import.meta.env.DEV) return

  const registry = customElements as PatchedRegistry
  if (registry[PATCH_FLAG]) return

  const originalDefine = registry.define.bind(registry)
  registry.define = ((name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
    const existing = registry.get(name)
    if (existing) {
      // During HMR, modules are re-evaluated and custom element names are re-registered.
      // Ignore duplicate registration to keep hot reload functional.
      return
    }
    originalDefine(name, ctor, options)
  }) as CustomElementRegistry['define']

  registry[PATCH_FLAG] = true
}

installCustomElementsHmrPatch()

