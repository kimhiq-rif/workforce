// Custom service worker additions — merged by next-pwa into sw.js
// Push notifications are handled by the OneSignal service worker SDK, imported
// below. OneSignal registers its own `push` / `notificationclick` listeners,
// so we must NOT add our own here — two handlers would double-fire, and the old
// VAPID JSON payload shape no longer matches OneSignal's format.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
