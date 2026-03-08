# Contributing

## Branch Naming

Use clear branch names:

- `feature/<scope>-<short-desc>`
- `fix/<scope>-<short-desc>`
- `chore/<scope>-<short-desc>`

Examples:

- `feature/settings-model-config`
- `fix/files-preview-limit`

## Commit Messages

Prefer Conventional Commits:

- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`
- `test: ...`

## Pull Request Checklist

Before opening a PR, make sure:

1. `pnpm lint` passes
2. `pnpm typecheck` passes
3. `pnpm test` passes
4. New behavior is covered by tests when practical
5. README/docs are updated if behavior changed

## Scope Discipline

- Keep each PR focused on one topic
- Avoid unrelated refactors in the same PR
- Preserve existing UX patterns unless change is intentional and explained
