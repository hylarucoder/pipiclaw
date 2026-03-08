import { defineConfig } from 'tsdown'

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true
  },
  entry: ['src/index.ts'],
  dts: true,
  fixedExtension: false,
  format: ['esm', 'cjs'],
  outDir: 'dist',
  platform: 'node',
  sourcemap: true,
  unbundle: true
})
