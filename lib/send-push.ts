// Copyright © 2026 Workforce. All rights reserved.
// Server-side OneSignal push sender. Single place that talks to the OneSignal
// REST API so routes and crons stay DRY. Targets users by external_id, which
// equals their users.id (set client-side via OneSignal.login).

const ONESIGNAL_API = "https://api.onesignal.com/notifications";

export interface SendPushArgs {
  /** users.id values to target (== OneSignal external_id). */
  externalIds: string[];
  title: string;
  body?: string;
  url?: string;
  /** Collapse key — replaces an earlier push with the same tag. */
  tag?: string;
  /** iOS sound file name (e.g. "default" or custom .caf/.aiff). */
  iosSound?: string;
  /** Android sound file name without extension (e.g. "default"). */
  androidSound?: string;
  /** Delivery priority 1–10; 10 = highest (immediate delivery). */
  priority?: number;
}

export interface SendPushResult {
  ok: boolean;
  sent: number;
  error?: unknown;
}

export async function sendOneSignalPush(args: SendPushArgs): Promise<SendPushResult> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) return { ok: false, sent: 0, error: "not configured" };

  const ids = Array.from(new Set(args.externalIds.filter(Boolean)));
  if (ids.length === 0) return { ok: true, sent: 0 };

  const payload: Record<string, unknown> = {
    app_id: appId,
    target_channel: "push",
    headings: { en: args.title },
    contents: { en: args.body ?? "" },
    url: args.url ?? "/",
    include_aliases: { external_id: ids },
  };
  if (args.tag) payload.web_push_topic = args.tag;
  if (args.iosSound) payload.apns_sound = args.iosSound;
  if (args.androidSound) payload.android_sound = args.androidSound;
  if (args.priority !== undefined) payload.priority = args.priority;

  try {
    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${restKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || (Array.isArray(data?.errors) && data.errors.length)) {
      return { ok: false, sent: 0, error: data?.errors ?? `OneSignal ${res.status}` };
    }
    return { ok: true, sent: data?.recipients ?? 0 };
  } catch (err) {
    return { ok: false, sent: 0, error: err };
  }
}
