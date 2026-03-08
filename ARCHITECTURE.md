# Architecture Overview

## Current State

This repository ships as an Electron desktop application, while the repo structure has already been split into monorepo-style package boundaries.

## System Of Record

Read these in order when you need the repo truth instead of historical context:

- `docs/PLANS.md`: active/completed execution plan index
- `docs/exec-plans/active/migrate-to-monorepo.md`: migration target, phases, and package boundary intent
- `ARCHITECTURE.md`: current runtime/package map
- `docs/design-docs/core-beliefs.md`: agent-friendly repo rules and cleanup expectations
- `docs/runbooks/README.md`: operational checklists and repeatable manual workflows

Production code currently lives under:

- `apps/desktop/src/main`
- `apps/desktop/src/preload`
- `packages/renderer`
- `packages/shared`
- `packages/agent-core`

Monorepo workspace skeletons already exist under:

- `apps/desktop`
- `packages/shared`
- `packages/agent-core`
- `packages/renderer`

The migration plan is tracked in `docs/exec-plans/active/migrate-to-monorepo.md`.

## Current Single Sources

- `packages/renderer/src/features/webui` is the only active webui feature source.
- The deleted package-root webui directory must not be recreated.
- The previous legacy webui bridge has been removed and must not be recreated.

## Runtime Boundaries

### Main Process (`apps/desktop/src/main`)

Responsibilities:

- Owns filesystem access
- Implements IPC handlers
- Persists and validates application settings
- Resolves active model config for runtime use

### Preload (`apps/desktop/src/preload`)

Responsibilities:

- Exposes typed, minimal APIs through `window.api`
- Validates IPC input/output with shared Zod schemas

### Renderer (`packages/renderer`)

Responsibilities:

- UI rendering and user interaction
- Calls preload APIs only (never Node APIs directly)
- Uses shared types for request/response contracts

## Target Package Boundaries

### `apps/desktop`

Responsibilities:

- Electron lifecycle and shell
- IPC registration and preload bridge wiring
- Platform adapters for filesystem, notes, shell, and native capabilities

### `packages/shared`

Responsibilities:

- RPC schemas
- Shared types and event payloads
- Provider/model metadata and other cross-runtime contracts

### `packages/agent-core`

Responsibilities:

- Agent session lifecycle
- Streaming orchestration
- Tool registry and runtime contracts
- Memory/context assembly

Constraints:

- Must not depend on Electron
- Must not depend on React
- Must not depend on DOM globals

### `packages/renderer`

Responsibilities:

- React pages and components
- UI stores and interaction state
- Browser-side adapters that render agent events

Constraints:

- Must not access Node APIs directly
- Must consume platform capabilities through preload/shared contracts

## Mechanical Guardrails

Current machine-checkable guardrails live in:

- `pnpm lint`: Oxlint rules, including package-level import restrictions
- `pnpm run check:boundaries`: AST-based dependency boundary checks
- `pnpm run guard:webui-source`: prevents reintroducing the deleted package-root webui path
- `pnpm run guard:no-legacy-webui`: prevents reintroducing deleted legacy webui directories/import paths
- `pnpm run typecheck:monorepo`: composes boundary checks with monorepo TS validation

## Settings Data Flow

1. Renderer calls `window.api.settings.*`
2. Preload validates payload and forwards to main via IPC
3. Main merges/validates settings and writes `settings.json`
4. Main returns canonical settings object
5. Renderer updates local UI state

## Notes File Flow

1. Renderer requests file list/read/search using configured `notesRootDir`
2. Main validates path safety (`resolveSafeNotesPath`)
3. Main reads filesystem and returns structured payload
4. Renderer renders tree/preview with mode-aware components

## Model Config Flow

1. User edits provider/model/key in Settings page
2. Settings are persisted in `settings.json`
3. `settings:resolve-active-model` returns current runtime-ready model summary
4. Business services can consume resolver output from main-side utilities
