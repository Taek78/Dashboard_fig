import { describe, expect, it, vi } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";

/* Clients sur la base de test, chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { customersDb } = await import("@/data/customers.db");

describe("customersDb", () => {
  it("getCustomers trie par nom et applique la recherche", async () => {
    const all = await customersDb.getCustomers();
    expect(all).toHaveLength(customersFixtures.length);
    for (let i = 1; i < all.length; i += 1) {
      expect(
        all[i - 1]!.fullName.localeCompare(all[i]!.fullName, "fr"),
      ).toBeLessThanOrEqual(0);
    }
    const found = await customersDb.getCustomers({ query: "rocher" });
    expect(found.map((c) => c.id)).toEqual(["cli-0003"]);
  });

  it("getCustomers sépare particuliers et membres d'une communauté", async () => {
    const individuals = await customersDb.getCustomers({
      membership: "individual",
    });
    const members = await customersDb.getCustomers({ membership: "community" });
    expect(individuals.every((c) => c.community === null)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((c) => c.community !== null)).toBe(true);
    expect(individuals.length + members.length).toBe(customersFixtures.length);
    const one = await customersDb.getCustomers({ communityId: "com-0001" });
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((c) => c.community?.id === "com-0001")).toBe(true);
  });

  it("getCustomer relit le client et ses notes, ou null", async () => {
    expect(await customersDb.getCustomer("cli-0005")).toEqual(
      customersFixtures.find((c) => c.id === "cli-0005"),
    );
    expect(await customersDb.getCustomer("cli-9999")).toBeNull();
  });

  it("addNote ajoute une note avec un id généré, visible ensuite ; null pour un client inconnu", async () => {
    const created = await customersDb.addNote("cli-0002", {
      text: "Test",
      authorName: "Utilisateur démo",
      createdAt: "2026-09-13T10:00:00.000Z",
    });
    expect(created).toMatchObject({
      text: "Test",
      authorName: "Utilisateur démo",
      createdAt: "2026-09-13T10:00:00.000Z",
    });
    expect(created?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (await customersDb.getCustomer("cli-0002"))?.notes.map((n) => n.text),
    ).toEqual(["Test"]);
    expect(
      await customersDb.addNote("cli-9999", {
        text: "x",
        authorName: "x",
        createdAt: "2026-09-13T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});
