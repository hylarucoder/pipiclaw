# Chat Manual Smoke Checklist

## Purpose

Validate the renderer webui feature (`packages/renderer/src/features/webui`) in real UI flow after dependency migration.

## Preconditions

1. Build and tests already pass:
   - `pnpm run typecheck`
   - `pnpm run test`
   - `pnpm run build`
2. At least one provider has valid API key in Settings page.
3. Run app:
   - local dev: `pnpm run dev`
   - or preview build: `pnpm run start`

## Smoke Steps

1. Open app and navigate to Draw page (`/draw`).
2. Confirm right panel shows chat area and no permanent error overlay.
3. Open Settings, set active model provider + API key, save.
4. Return Draw page and send message: `hello`.
5. Wait for assistant response to finish.
6. Refresh app window (or restart app), revisit Draw page.
7. Send second message and verify response still works.
8. Switch provider (e.g. `openai` -> `anthropic`), save, send message again.
9. Clear API key for active provider, retry sending one message.
10. Restore API key, send message again.

## Expected Results

1. Chat panel initializes without crashing.
2. Message send/receive works under configured provider.
3. After restart, chat panel can still initialize and continue sending.
4. Provider switch applies correctly for subsequent turns.
5. Missing API key path shows clear error and does not crash app.
6. After restoring API key, flow recovers without app restart.

## Failure Triage

1. Build-time import failure:
   - check `packages/renderer/src/features/webui` exists and is tracked.
   - check dependencies in `package.json` (`docx-preview`, `@lmstudio/sdk`, `xlsx`, `jszip`, `ollama`, `pdfjs-dist`, `lucide`).
2. Panel initialization error:
   - inspect renderer console for `PiWebChatPanel` startup error.
   - verify settings IPC returns valid settings payload.
3. Send fails with provider/model:
   - confirm API key not empty.
   - confirm selected model id matches provider capability.
4. Runtime crashes after provider switch:
   - retry with default model from provider config.
   - check renderer alias/shim wiring in `packages/renderer/vite.config.ts` and `packages/renderer/src/lib/piAiBrowserShim.ts`.
