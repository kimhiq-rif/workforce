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
          // sw.js (built by next-pwa) already imports OneSignalSDK.sw.js via
          // worker/index.js, so we reuse it at scope "/" — iOS Safari requires
          // the push-subscribing SW to be at root scope.
          serviceWorkerPath: "sw.js",
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
