# Workforce QA Report

Date: 2026-06-17

Canonical app path: `C:\Users\User\Documents\Codex\projects\workforce`

Original app path: `C:\Users\User\.claude\workforce`

Local URL: `http://localhost:3000`

## Current Focus

- First make the app usable and testable.
- Do not redesign yet.
- When reaching design changes, pause and ask for detailed direction.
- The selected design references are in yesterday's Codex folders and should be used later.

## Build / Runtime

- Build passes successfully with Next.js.
- `localhost:3000` was restarted cleanly during the first repair pass.
- `/login` returns 200.
- FIXED: Added missing `app/error.tsx` and `app/global-error.tsx` so Next no longer shows `missing required error components`.
- FIXED: Build passes after owner/API/More fixes.
- FIXED: `Something went wrong` after owner bootstrap was caused by service client still hitting `users` RLS recursion. `createServiceClient` now uses `@supabase/supabase-js` with service role directly.
- FIXED/PENDING QA: SQL fix for `permission denied for table users` was run successfully in Supabase SQL Editor. Server restarted with clean logs.
- QA PASS: Build passes from the persistent project folder.
- NOTE: Git CLI is not currently available in PATH, so GitHub sync script was created but not executed.
- QA PASS: Dev server is now running from the persistent project folder on `http://localhost:3000`.
- QA PASS: `/login` returns 200 from the persistent project folder.
- QA PASS: `/more` redirects to `/login` while signed out, as expected.
- QA PASS: GitHub sync was initialized successfully. Branch `main` now tracks `workforce/main`.

## Owner Drawer / Auth

- Owner drawer opens from the top-right Owner area.
- Logging in with an existing Supabase Auth user eventually works after refresh.
- After refresh the user reaches the dashboard.
- The app shows an owner session.
- FIXED: Drawer now bootstraps the app owner profile after connect.
- FIXED: On failure it stays open and shows an error.
- FIXED: After successful login, password is cleared.
- FIXED: Connected owner state shows connected session/email feedback.
- FIXED: Added visible success/failure feedback.
- QA PASS: Disconnect owner signs out and returns user to the Login screen. This behavior is desired.
- FIXED/PARTIAL: App now auto-creates a `public.users` owner profile for a signed-in Supabase Auth user when needed.
- QA PASS: After DB fix and fresh login, the account appears as owner in Settings and in the top-right owner panel.
- ROLE NOTE: User says the account should ultimately be Technical Admin, not Owner. Defer role model/permissions decision to a later pass.

## Dashboard

- Dashboard opens after refresh.
- Empty state shown when no sites exist.
- Right attention panel shows owner attention items.
- Top pinned bar needs design/function changes later.

## Sites

- Navigation to Sites works.
- Add site flow opens prompts for Thai name and English name.
- FIXED/PENDING QA: Add site now uses `/api/sites` with verified owner context and service-side insert.
- FIXED: Toast duration increased.
- QA PASS: Add site works; created site appears in list.
- QA PASS: Clicking the site opens the site detail page.
- NEW REQUIREMENT: Site detail is missing an add/upload site photo button.
- NEW REQUIREMENT: Site photo should later also appear/flow for field manager usage.

## Workers

- Navigation to Workers works.
- Add worker modal opens.
- FIXED/PENDING QA: Add worker now uses `/api/workers` with verified owner context and service-side insert.
- QA PASS: Add worker works.
- QA PASS: Worker was automatically assigned to the only existing site.
- OPEN QUESTION/REQUIREMENT: Owner module should allow assigning/reassigning worker to another existing site when more than one site exists.

## Suppliers

- Navigation to Suppliers works.
- Add supplier modal opens.
- FIXED/PENDING QA: Add supplier now uses `/api/suppliers` with verified owner context and service-side insert.
- QA PASS: Add supplier works.
- NEW REQUIREMENT: Receipt capture should support both taking a photo and uploading an existing image.
- NEW REQUIREMENT: Receipt flow should eventually OCR/scan receipt image, detect supplier if existing, detect amount, and leave owner to optionally add description and confirm.
- FUTURE INTELLIGENCE: Receipt scanner should improve after a learning period.

## Calendar

- Calendar screen opens.
- Right-side daily tasks/messages panel looks good.
- Date is prepared and correct.
- NEW REQUIREMENT: Add a button to add a task/meeting.
- NEW REQUIREMENT: Add a separate today's upcoming tasks panel to the pinned top bar.
- NEW REQUIREMENT: The top bar tasks panel should show date, month, and the next three upcoming tasks.
- NOTE: The right-side Calendar panel should stay in the Calendar screen and continue showing tasks for the date selected in the calendar.

## Top Pinned Bar / SystemBar Future Changes

- Panels in the pinned top bar must either be symmetric in size or arranged in a visually balanced order.
- Remove Workday panel from the pinned top bar.
- Workday can appear in the dashboard instead.
- Remove Daily reset panel; it is not relevant for day-to-day use.
- Add weather panel for Koh Phangan, Thailand.
- Weather panel requirements:
  - Reliable forecast source for Koh Phangan.
  - Daily general weather in a visual weight similar to the time panel.
  - Daily average temperature.
  - Daily weather icon/state: sun, hot sun, clouds, rain, wind, etc.
  - Timeline marker advances through the day.
  - Timeline shows rain probability, cloudiness, temperature changes, and similar hourly signals.
  - Purpose: see whether the day is approaching rain risk.
  - Panel opens as a drawer with weekly forecast.
- Add today's upcoming tasks panel in the pinned top bar near the weather panel.
- The Calendar right panel remains separate and date-selection driven.

## Reports

- QA PASS: Reports screen opens.
- QA PASS: No error observed.
- QA PASS: Shows empty/zero state: 0 reports ready to send.

## Finance

- QA PASS: Finance screen opens.
- QA PASS: No error observed.
- QA PASS: Initial view looks good.

## Settings

- Settings screen opens.
- First settings section opens.
- Default workday/settings values are displayed.
- Users & team section opens without crashing.
- FIXED/PENDING QA: Settings now uses verified owner profile context and should show the current owner as an app user.
- ROLE NOTE: Current user should later become Technical Admin rather than Owner.

## More

- FIXED/PENDING QA: Created `/more` page with links to Settings, Calendar, and Reports.
- QA PASS: More page opens and no longer 404.
- NEW DIRECTION: More should become Technical Admin area.
- NEW REQUIREMENT: Technical Admin area should include code-gated "engine room" access.
- NEW REQUIREMENT: Engine room should provide access to code, edit/view tools, error inspection, and either chat/help with Codex inside or at least copy buttons for issue/context snippets that can be sent to Codex.

## Design

- Current design is not the requested selected design.
- Left sidebar should remain colored, but current color/logo/design are not the chosen ones.
- Pause before design work and ask for detailed instructions.
- Use selected design references from yesterday's folder.

## Next Implementation Priorities

- Persistent project handoff/context strategy for future Codex sessions.
- Technical Admin role model.
- Site photo upload.
- Worker reassignment to site.
- Receipt photo upload + OCR/scanning workflow.
- Calendar task/meeting creation.
- Weather + upcoming tasks top bar redesign.
- More as Technical Admin engine room.
