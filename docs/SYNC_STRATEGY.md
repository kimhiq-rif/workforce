# Sync Strategy

Updated: 2026-06-17

## Goal

Future Codex sessions should be able to continue work without repeatedly re-uploading files or rebuilding project context.

## Chosen Strategy

Use both:

1. A permanent local Codex project folder.
2. Git/GitHub sync when available.

The permanent folder is:

`C:\Users\User\Documents\Codex\projects\workforce`

As of 2026-06-17, `localhost:3000` is running from this folder.

## How Future Sessions Should Start

1. Open this folder as the project/workspace.
2. Read `PROJECT_CONTEXT.md`.
3. Read `docs/QA_REPORT.md`.
4. Check `git status` if Git is available.
5. Continue from the highest priority open item.

## Git/GitHub Notes

Git CLI availability was checked on 2026-06-17 and Git was not available in PATH.

Git is installed at:

`C:\Program Files\Git\bin\git.exe`

Remote:

`workforce -> https://github.com/kimhiq-rif/workforce.git`

If Git is available, use normal commit/push flow from this folder.

If Git is not available in PATH, install Git or use another Git client, then sync this folder to the repository.

A helper script is available:

```powershell
.\scripts\sync-to-github.ps1 -Message "Describe the update" -Push
```

Run without `-Push` to commit locally only.

## Manual Fallback

If a future session cannot access the project folder directly, provide:

- `PROJECT_CONTEXT.md`
- `docs/QA_REPORT.md`
- current error/screenshot
- current target behavior

That should be enough to restart quickly.
