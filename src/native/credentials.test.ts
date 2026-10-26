import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  items: new Map<string, string>(),
  calls: [] as string[],
  failGet: false,
}));
vi.mock("@aparajita/capacitor-secure-storage", () => ({
  KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
  SecureStorage: {
    setKeyPrefix: vi.fn(async (prefix: string) => void store.calls.push(`prefix:${prefix}`)),
    setSynchronize: vi.fn(async (sync: boolean) => void store.calls.push(`sync:${sync}`)),
    setDefaultKeychainAccess: vi.fn(async (access: number) => void store.calls.push(`access:${access}`)),
    get: vi.fn(async (key: string) => {
      if (store.failGet) throw new Error("locked");
      return store.items.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: string) => void store.items.set(key, value)),
    remove: vi.fn(async (key: string) => store.items.delete(key)),
  },
}));

import { deleteCredential, getCredential, putCredential } from "./credentials";

beforeEach(() => {
  store.items.clear();
  store.failGet = false;
});

describe("the device credential store", () => {
  it("keeps one credential per device account", async () => {
    await putCredential("acct-tunde", "r-tunde");
    await putCredential("acct-bola", "r-bola");
    expect(await getCredential("acct-tunde")).toBe("r-tunde");
    expect(await getCredential("acct-bola")).toBe("r-bola");
    expect(await getCredential("acct-nobody")).toBeNull();
  });

  it("replaces the credential when it is rotated", async () => {
    await putCredential("acct-tunde", "first");
    await putCredential("acct-tunde", "second");
    expect(await getCredential("acct-tunde")).toBe("second");
  });

  it("forgets one account and leaves the others", async () => {
    await putCredential("acct-tunde", "r-tunde");
    await putCredential("acct-bola", "r-bola");
    await deleteCredential("acct-tunde");
    expect(await getCredential("acct-tunde")).toBeNull();
    expect(await getCredential("acct-bola")).toBe("r-bola");
  });

  it("is set up once: prefixed, off iCloud, this device only", async () => {
    await getCredential("acct-tunde");
    await putCredential("acct-bola", "x");
    expect(store.calls).toEqual(["prefix:xvs.parent.", "sync:false", "access:1"]);
  });

  it("reports an unreadable store as an error, never as a credential that is gone", async () => {
    await putCredential("acct-tunde", "r-tunde");
    store.failGet = true;
    await expect(getCredential("acct-tunde")).rejects.toThrow("locked");
  });
});
