# pi-web-ui Vendor Migration Plan

## Context
- Goal: move chat UI dependency from external `@mariozechner/pi-web-ui` package to a local vendored copy in this repo.
- Reason: reduce package export/alias fragility, make internal customization easier, and keep model/runtime integration under project control.
- Current date: 2026-02-28.

## Scope
- In scope:
  - Add local vendor directory for `pi-web-ui` artifacts.
  - Switch runtime imports to local vendor path.
  - Keep existing Draw page chat behavior unchanged.
  - Keep build (`typecheck/test/build`) passing.
  - Add sync/runbook docs.
- Out of scope (next iteration):
  - Deep refactor of upstream UI architecture.
  - Full fork of `pi-agent-core`.
  - Feature redesign of chat UX.

## Execution Phases

### Phase 1: Vendor Bootstrap
- [x] Move webui source to `packages/renderer/src/features/webui`.
- [x] Copy GitHub TS source (`packages/web-ui/src`) into vendor directory.
- [x] Copy runnable `dist` artifacts into vendor directory.
- [x] Add `VENDOR_SOURCE.md` with upstream version + source reference.

### Phase 2: Import Cutover
- [x] Remove package-style aliasing and import webui modules directly from renderer feature path.
- [x] Switch `PiWebChatPanel` imports to `packages/renderer/src/features/webui`.
- [x] Remove temporary deep-import type shims no longer needed.

### Phase 3: Runtime Stability
- [x] Keep `@mariozechner/pi-ai` renderer shim active for browser-safe provider subset.
- [x] Prepare manual smoke checklist for UI flow verification (`docs/runbooks/chat-manual-smoke.md`).
- [ ] Verify chat initialization, storage, model resolve, and send flow still work. (manual smoke-test pending)
- [x] Confirm no Node-only dependency build break in renderer (`pnpm run build` passed).

### Phase 4: Validation
- [x] Run `pnpm run typecheck`.
- [x] Run `pnpm run test`.
- [x] Run `pnpm run build`.
- [x] Record warnings and classify as acceptable/non-blocking (`node:fs/os/path` externalization warnings remain non-blocking).

### Phase 5: Cleanup
- [x] Remove unnecessary dependency on `@mariozechner/pi-web-ui` if no longer used.
- [x] Keep `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai` as needed.
- [x] Document future sync procedure from upstream `pi-mono`.

## Risks & Mitigations
- Risk: vendor copy drifts from upstream.
  - Mitigation: keep source metadata + explicit sync steps.
- Risk: renderer bundle size increases.
  - Mitigation: trim imported modules to minimal required set in next iteration.
- Risk: browser/runtime incompatibilities from upstream modules.
  - Mitigation: continue browser shim and strict build verification.

## Definition of Done
- `DrawStudioPage` chat uses local `packages/renderer/src/features/webui` imports.
- `pnpm run typecheck`, `pnpm run test`, `pnpm run build` all pass.
- docs include source provenance and sync runbook.
