# Technical Admin Engine Room

Updated: 2026-06-17

## User Intent

The More tab should become the Technical Admin area.

It should eventually include a code-gated "engine room" for advanced maintenance.

## Desired Capabilities

- Technical Admin login/access code.
- View project status.
- View recent errors.
- Copy issue/context snippets for Codex.
- Copy environment-safe diagnostics without secrets.
- Link to relevant docs:
  - `PROJECT_CONTEXT.md`
  - `docs/QA_REPORT.md`
  - `docs/ROADMAP.md`
  - `docs/SUPABASE_NOTES.md`
- Potential future: in-app chat/help workflow with Codex or a guided handoff flow.

## Safety Rules

- Never expose service role keys or private env values in the UI.
- Avoid destructive admin actions from the app unless they are explicitly designed and guarded.
- Keep error reporting useful but safe.
