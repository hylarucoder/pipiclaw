# pipiclaw

An Electron application with React and TypeScript.

## Tech Stack

- Electron + electron-vite
- React 19 + React Router
- TypeScript
- Tailwind CSS 4
- Zod (shared IPC schema)

## Project Setup

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm run typecheck:monorepo
pnpm run guard:webui-source
pnpm run guard:no-legacy-webui
pnpm run check:boundaries
pnpm format:ox
pnpm test
pnpm test:e2e
```

### Build

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## Repository Structure

- `apps/desktop/src/main`: Electron main process (IPC handlers, file access, settings storage)
- `apps/desktop/src/preload`: secure bridge APIs exposed to renderer
- `packages/renderer`: React UI
- `packages/agent-core`: agent runtime
- `packages/shared`: cross-process schemas and shared constants

## Settings System

Settings are stored at:

- `app.getPath('userData')/settings.json`

Current settings domains:

- Workspace: notes root path, default route
- Preview: text and asset preview limits
- Models: active provider, API key, base URL, primary/fast model

Settings IPC channels:

- `settings:get`
- `settings:update`
- `settings:reset`
- `settings:resolve-active-model`

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`

## Third-Party Notices

- Vendored and core runtime third-party notices: `THIRD_PARTY_NOTICES.md`
- Vendored `webui` source provenance: `packages/renderer/src/features/webui/VENDOR_SOURCE.md`
