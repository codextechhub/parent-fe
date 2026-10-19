/**
 * The parent app's service-worker push handler (`public/push-sw.js`), run
 * against a fake worker.
 *
 * Patricia's push for Grace's released result opens Results with Grace
 * showing, and a notice opens that notice: the screen and the child the school
 * named are kept from the moment the push arrives to the tap. The server's
 * `url` is followed only when it names a `/parent/` path; otherwise the tap
 * opens the screen for the push's tag, and anything unknown opens the app root.
 */
import { describe, expect, it, vi } from "vitest";

import source from "../../public/push-sw.js?raw";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(windows: Array<{ url: string; postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>) {
  const listeners: Record<string, Listener> = {};
  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: {
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async (_address: string) => null),
    },
  };
  new Function("self", source)(self);
  return { self, listeners };
}

async function fire(listener: Listener, event: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  listener({
    ...event,
    waitUntil: (work: Promise<unknown>) => {
      pending = work;
    },
  });
  await pending;
}

const PAYMENT_PUSH = {
  title: "Payment confirmed",
  body: "Your payment was confirmed. Open the app for your receipt.",
  tag: "billing.payment_received",
  url: "/", // not the parent app's, so the tap falls back to the tag
  notification_id: "900",
};

const NOTICE_PUSH = {
  title: "A new notice for Tunde: Permission slips for the class trip",
  body: "Open the parent app to read it.",
  tag: "notices.published_parent",
  url: "/",
  notification_id: "901",
};

const RESULT_PUSH = {
  title: "Your result is ready",
  body: "Open the app to read it.",
  tag: "gradebook.result_released",
  url: "/",
  notification_id: "902",
};

const GRACE_RESULT_PUSH = {
  title: "Grace's First Term result is ready",
  body: "Open the parent app to read it.",
  tag: "gradebook.report_card_ready",
  url: "/parent/results?child=431",
  child: 431,
  notification_id: "904",
};

const UNKNOWN_PUSH = {
  title: "Hello",
  body: "A new thing happened.",
  tag: "mystery.event",
  url: "/",
  notification_id: "903",
};

describe("push arriving", () => {
  it("shows what the school sent, with the parent-app badge and icon", async () => {
    const { self, listeners } = loadWorker([]);
    await fire(listeners.push, { data: { json: () => PAYMENT_PUSH } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Payment confirmed",
      expect.objectContaining({
        body: "Your payment was confirmed. Open the app for your receipt.",
        tag: "billing.payment_received",
        renotify: true,
        icon: "/parent/icons/icon-192.png",
        badge: "/parent/icons/badge-96.png",
        data: { tag: "billing.payment_received", notificationId: "900", url: "/", child: null },
      }),
    );
  });

  it("keeps the screen and the child the school named, for the tap", async () => {
    const { self, listeners } = loadWorker([]);
    await fire(listeners.push, { data: { json: () => GRACE_RESULT_PUSH } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Grace's First Term result is ready",
      expect.objectContaining({
        data: {
          tag: "gradebook.report_card_ready", notificationId: "904",
          url: "/parent/results?child=431", child: 431,
        },
      }),
    );
  });

  it("falls back to a default title when the payload is empty", async () => {
    const { self, listeners } = loadWorker([]);
    await fire(listeners.push, { data: { json: () => ({}) } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Your school",
      expect.objectContaining({ renotify: false }),
    );
  });
});

describe("a push that arrives and is then tapped", () => {
  async function arriveThenTap(payload: Record<string, unknown>, windows: unknown[]) {
    const { self, listeners } = loadWorker(windows as never);
    await fire(listeners.push, { data: { json: () => payload } });
    const [, options] = self.registration.showNotification.mock.calls[0] as unknown as [string, { data: unknown }];
    await fire(listeners.notificationclick, { notification: { data: options.data, close: vi.fn() } });
    return self;
  }

  it("opens the child's results the school named, in a new window", async () => {
    const self = await arriveThenTap(GRACE_RESULT_PUSH, []);
    expect(self.clients.openWindow).toHaveBeenCalledWith("/parent/results?child=431");
  });

  it("opens the notice the school named in the open app", async () => {
    const open = [{ url: "http://lagoon-view.localhost:5176/parent/", postMessage: vi.fn(), focus: vi.fn(async () => undefined) }];
    await arriveThenTap({ ...NOTICE_PUSH, url: "/parent/notices/42" }, open);
    expect(open[0].postMessage).toHaveBeenCalledWith({ type: "xvs-parent-push-open", path: "/parent/notices/42" });
  });

  it("names the child from the push when the url is not the parent app's", async () => {
    const self = await arriveThenTap({ ...PAYMENT_PUSH, child: 424 }, []);
    expect(self.clients.openWindow).toHaveBeenCalledWith("/parent/fees?child=424");
  });
});

describe("notification tap routes by tag inside /parent/", () => {
  const windows = () =>
    [
      {
        url: "http://lagoon-view.localhost:5176/parent/notices",
        postMessage: vi.fn(),
        focus: vi.fn(async () => undefined),
      },
    ] as const;

  async function tap(payload: Record<string, unknown>, open: ReturnType<typeof windows>) {
    const { self, listeners } = loadWorker(open as never);
    await fire(listeners.notificationclick, {
      notification: {
        data: { tag: payload.tag || "", notificationId: payload.notification_id || "" },
        close: vi.fn(),
      },
    });
    return self;
  }

  it("payment confirmed opens Fees", async () => {
    const open = windows();
    await tap(PAYMENT_PUSH, open);
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/fees",
    });
    expect(open[0].focus).toHaveBeenCalled();
  });

  it("notice for parent opens Notices", async () => {
    const open = windows();
    await tap(NOTICE_PUSH, open);
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/notices",
    });
  });

  it("released result opens Results", async () => {
    const open = windows();
    await tap(RESULT_PUSH, open);
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/results",
    });
  });

  it("unknown tag opens the app root (never outside /parent/)", async () => {
    const open = windows();
    await tap(UNKNOWN_PUSH, open);
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/",
    });
  });

  it("opens a new window when no parent-fe window is open", async () => {
    const self = await tap(PAYMENT_PUSH, [] as never);
    expect(self.clients.openWindow).toHaveBeenCalledWith("/parent/fees");
  });

  it("ignores a server-provided url that is not /parent/*", async () => {
    const open = windows();
    const payload = { ...PAYMENT_PUSH, url: "/student/fees" } as const;
    const { self, listeners } = loadWorker(open as never);
    await fire(listeners.notificationclick, {
      notification: {
        data: { tag: payload.tag, notificationId: payload.notification_id, url: payload.url },
        close: vi.fn(),
      },
    });
    void self;
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/fees",
    });
  });

  it("respects a server-provided url when it DOES start with /parent/", async () => {
    const open = windows();
    const payload = { ...PAYMENT_PUSH, url: "/parent/fees/receipts/42" } as const;
    const { listeners } = loadWorker(open as never);
    await fire(listeners.notificationclick, {
      notification: {
        data: { tag: payload.tag, notificationId: payload.notification_id, url: payload.url },
        close: vi.fn(),
      },
    });
    expect(open[0].postMessage).toHaveBeenCalledWith({
      type: "xvs-parent-push-open",
      path: "/parent/fees/receipts/42",
    });
  });
});
