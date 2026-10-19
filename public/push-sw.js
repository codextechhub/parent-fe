/**
 * Push notifications for the parent app, loaded into the generated service
 * worker (`workbox.importScripts` in `pwa.config.ts`), scoped to `/parent/`.
 *
 * The backend sends `{title, body, tag, url, notification_id}` for parents.
 * The `url` field is `/` (the backend uses the recipient's device-session
 * app_path, and parents have no device session), so this worker IGNORES the
 * server's url and routes by `tag`:
 *
 *   billing.payment_received   → /parent/fees
 *   notices.published_parent   → /parent/notices  (backend has no PUSH
 *                                 channel for this today; the route is here
 *                                 for the day the backend adds it)
 *   gradebook.result_released  → /parent/results  (sent to the pupil today,
 *                                 not the parent; here for completeness)
 *   anything else              → /parent/
 *
 * Push text never carries a mark or an amount: that is the backend's to
 * enforce. If a payload we open shows a figure, flag it in the parent-fe
 * report; we do not strip server copy here.
 */

const APP_ROOT = "/parent/";

const SCREEN_FOR_TAG = {
  "billing.payment_received": "fees",
  "notices.published_parent": "notices",
  "notices.published": "notices",
  "gradebook.result_released": "results",
};

function screenFor(data) {
  const screen = SCREEN_FOR_TAG[data && data.tag] || "";
  // The server's `url` is only trusted when it names a /parent/ path.
  const serverUrl = typeof (data && data.url) === "string" ? data.url : "";
  if (serverUrl.startsWith("/parent/")) return serverUrl;
  return APP_ROOT + screen;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_err) {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Your school";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: APP_ROOT + "icons/icon-192.png",
      badge: APP_ROOT + "icons/badge-96.png",
      data: {
        tag: data.tag || "",
        notificationId: data.notification_id || "",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = screenFor(data);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).pathname.startsWith(APP_ROOT));
      if (open) {
        open.postMessage({ type: "xvs-parent-push-open", path });
        await open.focus();
        return;
      }
      await self.clients.openWindow(path);
    })(),
  );
});
