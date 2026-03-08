import { defineConfig } from 'tsdown'

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true
  },
  entry: {
    'main/index': 'src/main/index.ts',
    'preload/index': 'src/preload/index.ts'
  },
  format: 'cjs',
  outDir: '../../dist/desktop',
  platform: 'node',
  sourcemap: true,
  tsconfig: './tsconfig.json',
  unbundle: true
})
