# Supabase Notes

Updated: 2026-06-17

## Current State

- The app uses Supabase Auth for login.
- The app also requires matching rows in `public.users`.
- Current server context creates/reads the app user profile for authenticated users.
- Service-side API routes are used for critical app inserts after owner context is verified.

## Important Migration

`supabase/migrations/004_fix_users_rls_and_grants.sql`

This migration fixes:

- `users` policy recursion.
- missing table grants.
- `get_owner_id()` behavior.
- owner profile access policies.

The user ran the SQL in Supabase SQL Editor on 2026-06-17 and reported success.

## Do Not Commit Secrets

Do not paste real values from `.env.local` into docs, chat, commits, or logs.

Use `.env.local.example` as the public reference.
