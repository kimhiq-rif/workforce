"use client";

import Script from "next/script";
import { useEffect } from "react";
import { oneSignal, ONESIGNAL_APP_ID, syncOneSignalUser } from "@/lib/onesignal";

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

      try {
        await syncOneSignalUser(OneSignal, userId, ownerId);
      } catch {
        // Non-fatal: the explicit enable button can retry after permission.
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
