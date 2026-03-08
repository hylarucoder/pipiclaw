import { defineConfig } from 'tsdown'

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true
  },
  entry: [
    'src/index.ts',
    {
      'config/*': ['src/config/*.ts'],
      'rpc/*': ['src/rpc/*.ts', '!src/rpc/*.test.ts']
    }
  ],
  dts: true,
  format: ['esm', 'cjs'],
  outDir: 'dist',
  platform: 'neutral',
  sourcemap: true,
  unbundle: true
})
