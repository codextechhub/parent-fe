import { beforeEach, describe, expect, it } from "vitest";

import {
  advancePayAllQueue,
  clearPayAllQueue,
  readPayAllQueue,
  savePayAllQueue,
} from "./pay-all-queue";

const STEPS = [
  { child_id: 11, first_name: "Tobi", invoice_ref: 101, number: "IV-1", title: "First Term", amount: 500000 },
  { child_id: 22, first_name: "Somto", invoice_ref: 102, number: "IV-2", title: "First Term", amount: 300000 },
];

beforeEach(() => {
  clearPayAllQueue();
});

describe("pay-all queue (sessionStorage)", () => {
  it("saves and reads a queue", () => {
    savePayAllQueue({ steps: STEPS, index: 0 });
    const queue = readPayAllQueue();
    expect(queue?.steps.length).toBe(2);
    expect(queue?.index).toBe(0);
  });

  it("advances to the next step and returns it", () => {
    savePayAllQueue({ steps: STEPS, index: 0 });
    const next = advancePayAllQueue();
    expect(next?.first_name).toBe("Somto");
    expect(readPayAllQueue()?.index).toBe(1);
  });

  it("clears itself and returns null when every step is done", () => {
    savePayAllQueue({ steps: STEPS, index: 1 });
    const next = advancePayAllQueue();
    expect(next).toBeNull();
    expect(readPayAllQueue()).toBeNull();
  });

  it("survives a reload (sessionStorage keeps it)", () => {
    savePayAllQueue({ steps: STEPS, index: 0 });
    // Simulate a reload: new readPayAllQueue reads the same key.
    const after = readPayAllQueue();
    expect(after?.steps).toEqual(STEPS);
    expect(after?.index).toBe(0);
  });

  it("treats a corrupt payload as no queue", () => {
    window.sessionStorage.setItem("parent-fe:pay-all", "{notjson");
    expect(readPayAllQueue()).toBeNull();
  });
});
