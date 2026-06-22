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
          // Reuse the service worker that next-pwa already registers at "/".
          // worker/index.js importScripts the OneSignal SW SDK into it.
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "sw.js",
          allowLocalhostAsSecureOrigin: true,
        });
      }
      // external_id = users.id (profile id) so /api/push can target a specific
      // user; owner_id tag lets it fan out to all of an owner's devices.
      try {
        await OneSignal.login(userId);
        if (ownerId) await OneSignal.User.addTag("owner_id", ownerId);
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
