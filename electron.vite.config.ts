import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function createPackageAliases(command: 'build' | 'serve') {
  const packageDir = command === 'build' ? 'dist' : 'src'

  return [
    {
      find: '@pipiclaw/shared',
      replacement: resolve(`packages/shared/${packageDir}`)
    },
    {
      find: '@pipiclaw/agent-core',
      replacement: resolve(`packages/agent-core/${packageDir}`)
    }
  ]
}

export default defineConfig(({ command }) => {
  const packageAliases = createPackageAliases(command)

  return {
    main: {
      build: {
        lib: {
          entry: resolve('apps/desktop/src/main/index.ts')
        }
      },
      resolve: {
        alias: packageAliases
      }
    },
    preload: {
      build: {
        lib: {
          entry: resolve('apps/desktop/src/preload/index.ts')
        }
      },
      resolve: {
        alias: packageAliases
      }
    },
    renderer: {
      root: resolve('packages/renderer'),
      build: {
        rollupOptions: {
          input: resolve('packages/renderer/index.html')
        }
      },
      resolve: {
        alias: [
          ...packageAliases,
          { find: '@renderer', replacement: resolve('packages/renderer/src') }
        ]
      },
      plugins: [react(), tailwindcss()]
    }
  }
})
