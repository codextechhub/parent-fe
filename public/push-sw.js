/**
 * Push notifications for the parent app, loaded into the generated service
 * worker (`workbox.importScripts` in `pwa.config.ts`), scoped to `/parent/`.
 *
 * The backend sends `{title, body, tag, url, notification_id, child?}`. For a
 * parent's notice, released result or confirmed payment, `url` is the screen
 * in this app (`/parent/notices/<id>`, `/parent/results?child=<id>`,
 * `/parent/fees?child=<id>`) and `child` names the child it is about. Both are
 * kept on the notification so a tap opens that screen.
 *
 * The `url` is followed only when it is a `/parent/` path. Otherwise the tap
 * opens the screen for the push's `tag`, with `?child=` when a child is named:
 *
 *   billing.payment_received     → /parent/fees
 *   notices.published_parent     → /parent/notices
 *   gradebook.report_card_ready  → /parent/results
 *   anything else                → /parent/
 *
 * Push text never carries a mark or an amount; the backend's templates keep
 * figures out, and this worker shows the server's words as sent.
 */

const APP_ROOT = "/parent/";

const SCREEN_FOR_TAG = {
  "billing.payment_received": "fees",
  "notices.published_parent": "notices",
  "notices.published": "notices",
  "gradebook.report_card_ready": "results",
  "gradebook.result_released": "results",
};

function screenFor(data) {
  const screen = SCREEN_FOR_TAG[data && data.tag] || "";
  // The server's `url` is only trusted when it names a /parent/ path.
  const serverUrl = typeof (data && data.url) === "string" ? data.url : "";
  if (serverUrl.startsWith("/parent/")) return serverUrl;
  const child = data && Number.isInteger(data.child) ? data.child : null;
  return APP_ROOT + screen + (screen && child !== null ? "?child=" + child : "");
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
        url: typeof data.url === "string" ? data.url : "",
        child: Number.isInteger(data.child) ? data.child : null,
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
