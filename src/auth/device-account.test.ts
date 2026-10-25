import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetAccountForTests,
  clearAccount,
  getAccount,
  setAccount,
  useAccountStorage,
  type AccountStorage,
} from "./device-account";

beforeEach(() => _resetAccountForTests());

describe("the device account", () => {
  it("survives a reload: a fresh read finds what sign-in stored", async () => {
    await setAccount("a-patricia");
    // A reload forgets the in-memory copy but not the browser's storage.
    useAccountStorage({
      read: async () => localStorage.getItem(Object.keys(localStorage)[0]),
      write: async () => {},
      remove: async () => {},
    });
    expect(await getAccount()).toBe("a-patricia");
  });

  it("is gone after clearing", async () => {
    await setAccount("a-patricia");
    await clearAccount();
    expect(await getAccount()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("is seen at once by the next call, before the storage has finished writing", async () => {
    let finish: () => void = () => {};
    const slow: AccountStorage = {
      read: async () => null,
      write: () => new Promise<void>((resolve) => (finish = resolve)),
      remove: async () => {},
    };
    useAccountStorage(slow);
    const writing = setAccount("a-patricia");
    expect(await getAccount()).toBe("a-patricia");
    finish();
    await writing;
  });

  it("reads storage that throws as nobody signed in", async () => {
    const broken = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(await getAccount()).toBeNull();
    broken.mockRestore();
  });
});
