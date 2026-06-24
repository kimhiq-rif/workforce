// Copyright © 2026 Workforce. All rights reserved.
// Client-side OneSignal helpers. The OneSignalDeferred queue drains once the
// page SDK finishes loading, so callbacks pushed here run as soon as it's ready.
"use client";

export const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

type OneSignalCallback = (OneSignal: any) => void | Promise<void>;

declare global {
  interface Window {
    OneSignalDeferred?: OneSignalCallback[];
  }
}

export function oneSignal(cb: OneSignalCallback) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(cb);
}

// iOS only supports push in standalone (installed PWA) mode.
export function canRequestWebPushOnThisDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !isIos || isStandalone;
}

export type EnablePushResult = "granted" | "denied" | "unsupported";

export async function syncOneSignalUser(
  OneSignal: any,
  userId: string,
  ownerId: string | null
) {
  await OneSignal.login(userId);
  if (ownerId) await OneSignal.User.addTag("owner_id", ownerId);

  // In SDK v16, requestPermission() only grants browser-level permission.
  // optIn() creates the actual PushManager subscription.
  if (OneSignal.Notifications.permission) {
    await OneSignal.User?.PushSubscription?.optIn?.();
  }
}

// Triggers the native permission prompt. MUST be called from a user gesture
// (e.g. a button click) — iOS requires this and only inside an installed PWA.
// We access window.OneSignal directly so the requestPermission() call stays
// in the same synchronous call stack as the click event; going through
// OneSignalDeferred can introduce a macrotask boundary that strips the iOS
// gesture context and causes the permission request to be silently rejected.
export function enablePush(): Promise<EnablePushResult> {
  if (!ONESIGNAL_APP_ID) return Promise.resolve("unsupported");
  if (!canRequestWebPushOnThisDevice()) return Promise.resolve("unsupported");
  const OS = typeof window !== "undefined" ? (window as any).OneSignal : null;
  if (OS) {
    return OS.Notifications.requestPermission()
      .then(async () => {
        if (!OS.Notifications.permission) return "denied" as EnablePushResult;
        await OS.User.PushSubscription.optIn();
        return "granted" as EnablePushResult;
      })
      .catch(() => "unsupported" as EnablePushResult);
  }
  // Fallback: SDK not yet initialised — queue via deferred (non-iOS path).
  return new Promise<EnablePushResult>((resolve) => {
    oneSignal(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.Notifications.permission) {
          await OneSignal.User?.PushSubscription?.optIn?.();
        }
        resolve(OneSignal.Notifications.permission ? "granted" : "denied");
      } catch {
        resolve("unsupported");
      }
    });
  });
}
