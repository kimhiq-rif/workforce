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

export type EnablePushResult = "granted" | "denied" | "unsupported";

// Triggers the native permission prompt. MUST be called from a user gesture
// (e.g. a button click) — iOS requires this and only inside an installed PWA.
export function enablePush(): Promise<EnablePushResult> {
  if (!ONESIGNAL_APP_ID) return Promise.resolve("unsupported");
  return new Promise((resolve) => {
    oneSignal(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        resolve(OneSignal.Notifications.permission ? "granted" : "denied");
      } catch {
        resolve("unsupported");
      }
    });
  });
}
