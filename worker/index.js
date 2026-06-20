// Custom service worker additions — merged by next-pwa into sw.js
// Handles: push notifications, notification click

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const options = {
    body: data.body ?? "",
    tag: data.tag ?? "workforce",
    data: { url: data.url ?? "/" },
    vibrate: [180, 80, 180, 80, 400, 80, 400],
    requireInteraction: data.requireInteraction ?? false,
    silent: false,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title ?? "Workforce", options);
      // Broadcast to all open app windows so they can play the in-app chime
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "WF_PUSH", payload: data }));
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if possible
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
