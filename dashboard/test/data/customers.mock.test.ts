import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMERS_MOCK_LATENCY_MS,
  customersMock,
  resetCustomersMock,
} from "@/data/customers.mock";
import { customersFixtures } from "@/domain/customers/fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  resetCustomersMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(CUSTOMERS_MOCK_LATENCY_MS);
  return promise;
}

describe("customersMock", () => {
  it("getCustomers trie par nom et applique la recherche", async () => {
    const all = await settle(customersMock.getCustomers());
    expect(all).toHaveLength(12);
    expect(all[0]?.fullName).toBe("Amel Benali");
    const found = await settle(customersMock.getCustomers("rocher"));
    expect(found.map((c) => c.id)).toEqual(["cli-0003"]);
  });

  it("getCustomer renvoie une copie ou null", async () => {
    const c = await settle(customersMock.getCustomer("cli-0005"));
    expect(c?.notes).toHaveLength(1);
    c!.notes.push({
      id: "x",
      text: "x",
      authorName: "x",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const again = await settle(customersMock.getCustomer("cli-0005"));
    expect(again?.notes).toHaveLength(1);
    expect(await settle(customersMock.getCustomer("cli-9999"))).toBeNull();
  });

  it("addNote ajoute une note avec un id généré, visible ensuite, sans toucher les fixtures", async () => {
    const created = await settle(
      customersMock.addNote("cli-0002", {
        text: "Test",
        authorName: "Utilisateur démo",
        createdAt: "2026-09-13T10:00:00.000Z",
      }),
    );
    expect(created?.id).toBe("note-m-1");
    const c = await settle(customersMock.getCustomer("cli-0002"));
    expect(c?.notes.map((n) => n.text)).toEqual(["Test"]);
    expect(customersFixtures[1]?.notes).toHaveLength(0);
  });

  it("addNote renvoie null pour un client inconnu", async () => {
    expect(
      await settle(
        customersMock.addNote("cli-9999", {
          text: "x",
          authorName: "x",
          createdAt: "2026-09-13T10:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });
});
