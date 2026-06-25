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
  const isDebug = req.nextUrl.searchParams.get("debug") === "1";

  if (!isDebug) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const { date, minutesSinceMidnight } = bangkokNow();

  // All events today that haven't been notified yet (includes all-day events)
  const { data: events, error: queryError } = await supabase
    .from("calendar_events")
    .select("id, owner_id, title, event_time, reminder_minutes, event_type")
    .eq("event_date", date)
    .eq("push_sent", false)
    .eq("is_done", false);

  console.log("[cal-cron]", { date, minutesSinceMidnight, found: events?.length, queryError, events });

  if (!events?.length) {
    return NextResponse.json({ ok: true, date, minutesSinceMidnight, checked: 0, sent: 0 });
  }

  const sentIds: string[] = [];

  for (const event of events) {
    const reminderMinutes: number = event.reminder_minutes ?? 15;
    let shouldSend = false;
    let body = "";

    if (event.event_time) {
      // Timed event: send at event_time - reminder_minutes, within 15-min window
      const [h, m] = (event.event_time as string).split(":").map(Number);
      const eventMinutes = h * 60 + m;
      const windowStart = eventMinutes - reminderMinutes;
      const windowEnd = windowStart + 15;
      console.log("[cal-cron] timed event", { id: event.id, title: event.title, eventMinutes, reminderMinutes, windowStart, windowEnd, minutesSinceMidnight, inWindow: minutesSinceMidnight >= windowStart && minutesSinceMidnight < windowEnd });
      if (minutesSinceMidnight >= windowStart && minutesSinceMidnight < windowEnd) {
        shouldSend = true;
        const timeLabel = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        body = `${timeLabel} · in ${reminderMinutes} min`;
      }
    } else {
      // All-day event: send at 08:00 Bangkok time (window 07:45–08:00), only if reminder is set
      console.log("[cal-cron] all-day event", { id: event.id, title: event.title, reminderMinutes, minutesSinceMidnight, inWindow: reminderMinutes > 0 && minutesSinceMidnight >= 465 && minutesSinceMidnight < 480 });
      if (reminderMinutes > 0 && minutesSinceMidnight >= 465 && minutesSinceMidnight < 480) {
        shouldSend = true;
        body = "All-day event today";
      }
    }

    if (shouldSend) {
      const icon = event.event_type === "meeting" ? "🤝" : "📋";

      const pushResult = await sendOneSignalPush({
        externalIds: [event.owner_id],
        title: `${icon} ${event.title}`,
        body,
        url: "/calendar",
        tag: `calendar-${event.id}`,
        iosSound: event.event_type === "meeting" ? "long_low_short_high_unsub.caf" : "default",
      });
      console.log("[cal-cron] push result", { id: event.id, pushResult });

      await supabase
        .from("calendar_events")
        .update({ push_sent: true })
        .eq("id", event.id);

      sentIds.push(event.id);
    }
  }

  return NextResponse.json({ ok: true, date, minutesSinceMidnight, checked: events.length, sent: sentIds.length, sentIds });
}
