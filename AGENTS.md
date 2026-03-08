# Repository Guidelines

1. 回复尽量用中文
2. 尽量不要写兼容代码，除非我显式要求

## Project Structure & Module Organization
- 当前生产代码主要位于：
  - `apps/desktop/src/main`: Electron main process logic
  - `apps/desktop/src/preload`: secure bridge APIs exposed to renderer via `window.api`
  - `packages/renderer/src`: React UI pages, components, stores, utilities
  - `packages/renderer/src/features/webui`: webui feature implementation，也是当前唯一 webui feature 真源
  - `packages/shared/src`: cross-process schemas and shared contracts
  - `packages/agent-core/src`: agent runtime core
- 当前 monorepo 边界：
  - `apps/desktop`: Electron desktop shell
  - `packages/shared`: shared schemas/contracts/config
  - `packages/agent-core`: agent runtime core
  - `packages/renderer`: renderer package
- `e2e`: Playwright end-to-end tests.
- `docs`: Architecture notes, runbooks, and implementation plans.
- `resources`: Packaged app assets (for example app icons).

## First Read

- 执行计划入口：`docs/PLANS.md`
- 当前主迁移计划：`docs/exec-plans/active/migrate-to-monorepo.md`
- 当前架构总览：`ARCHITECTURE.md`
- agent-friendly 仓库守则：`docs/design-docs/core-beliefs.md`
- 日常操作手册：`docs/runbooks/README.md`
- 如果目录结构和文档冲突，以 `docs/exec-plans/active/*` 和实际代码为准，不要猜

## Build, Test, and Development Commands
- `pnpm install`: Install dependencies.
- `pnpm dev`: Run Electron + Vite in local development mode.
- `pnpm start`: Preview built app.
- `pnpm lint`: Run Oxc lint checks with `.oxlintrc.json`.
- `pnpm typecheck`: Run TypeScript checks for both node and web configs.
- `pnpm typecheck:monorepo`: Check workspace package references and monorepo boundaries.
- `pnpm run check:boundaries`: Enforce package dependency boundaries (`renderer -> !desktop`, `agent-core -> !react/electron/dom`).
- `pnpm run guard:webui-source`: Block reintroduction of the deleted package-root webui path in active code/docs entrypoints.
- `pnpm run guard:no-legacy-webui`: Block reintroduction of deleted legacy webui directories/import paths in active code/docs entrypoints.
- `pnpm format:ox`: Check Oxc formatting with `.oxfmtrc.json`.
- `pnpm format:ox:write`: Apply Oxc formatting.
- `pnpm test`: Run unit/integration tests with Vitest.
- `pnpm test:e2e`: Build app and run Playwright smoke/e2e tests.
- `pnpm build`: Typecheck and build distributable app bundles.

## Coding Style & Naming Conventions
- Use TypeScript throughout; keep runtime boundaries clear (renderer -> preload -> main).
- Formatting is enforced by Prettier (`.prettierrc.yaml`): 2-space indent, single quotes, no semicolons, `printWidth: 100`.
- Linting uses Oxlint with TypeScript/React/import/Vitest/node plugins (`.oxlintrc.json`).
- File naming:
  - React components/pages: `PascalCase.tsx` (for example `ChatPage.tsx`).
  - Utilities/stores/modules: `camelCase.ts` (for example `modelResolver.ts`).
  - Tests: `*.test.ts(x)` under `src/**`; e2e specs use `*.spec.ts` in `e2e/`.

## Testing Guidelines
- Unit/integration: Vitest (`vitest.config.ts`), include pattern `src/**/*.test.ts` and `src/**/*.test.tsx`.
- E2E: Playwright (`playwright.config.ts`) from `e2e/`, currently single-worker, non-parallel.
- Before opening a PR, run: `pnpm lint && pnpm typecheck && pnpm run typecheck:monorepo && pnpm test`.
- Add or update tests for behavior changes, especially IPC flows, store logic, and page-level interactions.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (observed in history): `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Keep commits focused and atomic; avoid mixing unrelated refactors.
- Branch naming convention: `feature/<scope>-<short-desc>`, `fix/<scope>-<short-desc>`, `chore/<scope>-<short-desc>`.
- PRs should include: concise summary, linked issue (if available), test evidence, and screenshots/GIFs for UI changes.

## Security & Configuration Tips
- Do not access Node APIs directly from renderer; route privileged operations through preload/main.
- Treat `app.getPath('userData')/settings.json` as user-local state; avoid committing secrets or machine-specific config.

## Monorepo Guardrails

- `packages/shared` 不依赖业务包
- `packages/agent-core` 只允许依赖 `packages/shared`
- `packages/renderer` 允许依赖 `packages/shared`、`packages/agent-core`
- `packages/agent-core` 禁止依赖 React、Electron、DOM API
- 不要重新引入已删除的 legacy webui 目录或任何 legacy webui 生产依赖
- 在迁移完成前，不要把生产逻辑同时保留在 `src/**` 和 `packages/**` 两边长期并存
