# Workforce Project Context

Updated: 2026-06-17

## Canonical workspace

This folder is the persistent Codex workspace for the app:

`C:\Users\User\Documents\Codex\projects\workforce`

The older working copy was:

`C:\Users\User\.claude\workforce`

Use the persistent Codex workspace as the source of truth for future Codex work unless the user explicitly says otherwise.

## Product summary

Workforce is a Next.js + Supabase app for site/workforce management in Thailand, focused around owners, field managers, sites, workers, suppliers, receipts, reports, finance, calendar tasks, and daily operational visibility.

The user is currently prioritizing functional stability and testability. Do not redesign the app yet unless explicitly instructed.

## Current priority

1. Keep the app running.
2. Fix functional bugs discovered during QA.
3. Keep the QA report updated without deleting old findings.
4. Mark findings as fixed, pending QA, QA pass, or deferred.
5. Only after the functional pass, stop and ask the user for detailed design instructions.

## Important constraints

- Do not remove the QA history from `docs/QA_REPORT.md`.
- Do not expose secrets from `.env.local` in chat, docs, commits, or logs.
- Do not delete the old `.claude\workforce` folder.
- Prefer editing this persistent project folder, then sync to Git/GitHub when available.
- The user expects permanent context to live inside this project so future sessions do not start from zero.

## Known environment notes

- `npm` and `git` may not be available in PATH.
- Builds can be run through the bundled Codex Node runtime if needed:

```powershell
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\next\dist\bin\next' build
```

## Supabase/auth notes

- Supabase Auth alone is not enough for the app.
- The app also expects a matching `public.users` row.
- Current implementation bootstraps/reads the current Auth user through app/server context.
- RLS recursion and grants issues were fixed with migration `supabase/migrations/004_fix_users_rls_and_grants.sql`.

## Design notes

The current visual design is not final. The user said the left sidebar should remain colored, but the current color/logo/design are not the chosen design. Selected design references are in earlier Codex folders and should be reviewed later.

Pause before design work and ask for detailed instructions.
