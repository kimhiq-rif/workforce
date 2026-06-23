"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Loads the OneSignal Web SDK, initializes it against our existing next-pwa
// service worker (sw.js), and ties the device subscription to the app user so
// the server can target pushes by external_id / owner_id tag.

import Script from "next/script";
import { useEffect } from "react";
import { oneSignal, ONESIGNAL_APP_ID } from "@/lib/onesignal";

let initialized = false;

export function OneSignalInit({
  userId,
  ownerId,
}: {
  userId: string;
  ownerId: string | null;
}) {
  useEffect(() => {
    if (!ONESIGNAL_APP_ID) return;
    oneSignal(async (OneSignal) => {
      if (!initialized) {
        initialized = true;
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          // Use a dedicated OneSignal service worker (public/OneSignalSDKWorker.js)
          // registered at a sub-scope so it doesn't conflict with next-pwa's sw.js
          // at scope "/". Push events are delivered to the subscribing SW regardless
          // of scope, so push works even though this SW doesn't control app pages.
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/onesignal-sw/" },
          allowLocalhostAsSecureOrigin: true,
        });
      }
      // external_id = users.id (profile id) so /api/push can target a specific
      // user; owner_id tag lets it fan out to all of an owner's devices.
      try {
        await OneSignal.login(userId);
        if (ownerId) await OneSignal.User.addTag("owner_id", ownerId);
        // In SDK v16, requestPermission() only grants browser-level permission.
        // optIn() creates the actual PushManager subscription. Call it on every
        // init so returning users who already approved get their push token
        // registered even if they never clicked the Enable Push button again.
        if (OneSignal.Notifications.permission) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch {
        /* non-fatal — subscription still works, just untargeted */
      }
    });
  }, [userId, ownerId]);

  if (!ONESIGNAL_APP_ID) return null;

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}
