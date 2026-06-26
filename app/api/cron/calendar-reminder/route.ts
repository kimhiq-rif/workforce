// Copyright © 2026 Workforce. All rights reserved.
// Cron: every 15 min. Sends push for calendar events whose reminder window
// falls in the current 15-minute slot (event_time - reminder_minutes).
// Uses push_sent flag to prevent duplicate notifications.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

function bangkokNow(): { date: string; minutesSinceMidnight: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map(({ type, value }) => [type, value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesSinceMidnight = Number(parts.hour) * 60 + Number(parts.minute);
  return { date, minutesSinceMidnight };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { date, minutesSinceMidnight } = bangkokNow();

  // Only events today with a specific time that haven't been notified yet
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, owner_id, title, event_time, reminder_minutes, event_type")
    .eq("event_date", date)
    .eq("push_sent", false)
    .eq("is_done", false)
    .not("event_time", "is", null);

  if (!events?.length) {
    console.log(`[calendar-reminder] ${date} ${minutesSinceMidnight}min — no events (push_sent=false)`);
    return NextResponse.json({ ok: true, date, minutesSinceMidnight, checked: 0, sent: 0 });
  }

  console.log(`[calendar-reminder] ${date} ${minutesSinceMidnight}min — checking ${events.length} events`);

  const sentIds: string[] = [];
  const skippedIds: string[] = [];

  for (const event of events) {
    // event_time is stored as "HH:MM:SS"
    const [h, m] = (event.event_time as string).split(":").map(Number);
    const eventMinutes = h * 60 + m;
    const reminderMinutes: number = event.reminder_minutes ?? 15;

    // Reminder window: [eventMinutes - reminderMinutes, eventMinutes - reminderMinutes + 15)
    const windowStart = eventMinutes - reminderMinutes;
    const windowEnd = windowStart + 15;

    console.log(`[calendar-reminder] event "${event.title}" at ${eventMinutes}min, window [${windowStart}-${windowEnd}), now=${minutesSinceMidnight}`);

    if (minutesSinceMidnight >= windowStart && minutesSinceMidnight < windowEnd) {
      const icon = event.event_type === "meeting" ? "🤝" : "📋";
      const timeLabel = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const pushResult = await sendOneSignalPush({
        externalIds: [event.owner_id],
        title: `${icon} ${event.title}`,
        body: `${timeLabel} · in ${reminderMinutes} min`,
        url: "/calendar",
        tag: `calendar-${event.id}`,
        iosSound: "chime.caf",
        androidSound: "chime",
        priority: 10,
      });

      console.log(`[calendar-reminder] sendOneSignalPush result:`, JSON.stringify(pushResult));

      // Mark sent only if delivered to at least 1 subscriber, OR if the event
      // time has already passed (to avoid retrying stale notifications).
      const eventPassed = minutesSinceMidnight >= eventMinutes;
      if (pushResult.sent > 0 || eventPassed) {
        await supabase
          .from("calendar_events")
          .update({ push_sent: true })
          .eq("id", event.id);
      }

      sentIds.push(event.id);
    } else {
      skippedIds.push(event.id);
    }
  }

  console.log(`[calendar-reminder] done — sent=${sentIds.length} skipped=${skippedIds.length}`);
  return NextResponse.json({ ok: true, date, minutesSinceMidnight, checked: events.length, sent: sentIds.length, skipped: skippedIds.length });
}
