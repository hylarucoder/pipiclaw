# pi-web-ui Vendor Sync Runbook

## Purpose

Update `packages/renderer/src/features/webui` from upstream `pi-mono/packages/web-ui/src` while keeping this app buildable.

## Steps

1. Clone upstream:
   - `git clone --depth 1 https://github.com/badlogic/pi-mono.git /tmp/pi-mono-vendor-sync`
2. Copy TS source:
   - `rm -rf packages/renderer/src/features/webui`
   - `cp -R /tmp/pi-mono-vendor-sync/packages/web-ui/src packages/renderer/src/features/webui`
3. Refresh provenance and license metadata:
   - update `packages/renderer/src/features/webui/VENDOR_SOURCE.md`
   - record the exact upstream commit hash used for the sync
   - verify upstream license is still MIT and update `THIRD_PARTY_NOTICES.md` if needed
4. Apply local integration patches:
   - re-apply `AgentInterface` query accessor recovery and send fallback.
   - re-apply any app-specific fixes after upstream sync.
5. Verify:
   - `pnpm run typecheck`
   - `pnpm run test`
   - `pnpm run build`

## Acceptance

- Chat page still loads and sends messages.
- `DrawStudioPage` and `ChatPage` use local `packages/renderer/src/features/webui/*` sources via `@renderer/features/webui/*`.
- Build passes without Node-only module resolution failures.
- Vendored source provenance and third-party notices remain up to date.
