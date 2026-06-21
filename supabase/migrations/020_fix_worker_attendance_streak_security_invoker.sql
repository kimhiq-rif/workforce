-- Supabase Security Advisor fix:
-- worker_attendance_streak should run with the querying user's permissions,
-- not the view creator's permissions.

alter view if exists public.worker_attendance_streak
set (security_invoker = true);
