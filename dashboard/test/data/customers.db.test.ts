import { describe, expect, it, vi } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import { signupStats } from "@/domain/customers/referral";

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

  it("getCustomer relit le client, ses notes, ses autorisations, son parrain, ou null", async () => {
    expect(await customersDb.getCustomer("cli-0005")).toEqual(
      customersFixtures.find((c) => c.id === "cli-0005"),
    );
    const theo = await customersDb.getCustomer("cli-0002");
    expect(theo?.referredBy).toEqual({
      id: "cli-0001",
      fullName: "Amel Benali",
    });
    expect(theo?.referralCode).toBe("Marchand#0002");
    expect(theo?.consents).toEqual({
      offers: true,
      orderStatus: true,
      marketing: false,
      updatedAt: theo?.createdAt,
    });
    expect(await customersDb.getCustomer("cli-9999")).toBeNull();
  });

  it("getCustomerReferrals liste les filleuls du plus ancien au plus récent, vide sinon", async () => {
    const expected = customersFixtures
      .filter((c) => c.referredBy?.id === "cli-0001")
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ id: c.id, fullName: c.fullName, createdAt: c.createdAt }));
    expect(expected).toHaveLength(2);
    expect(await customersDb.getCustomerReferrals("cli-0001")).toEqual(
      expected,
    );
    // cli-0007 (Samuel) : personne n'a saisi son code.
    expect(customersFixtures.some((c) => c.referredBy?.id === "cli-0007")).toBe(
      false,
    );
    expect(await customersDb.getCustomerReferrals("cli-0007")).toEqual([]);
    expect(await customersDb.getCustomerReferrals("cli-9999")).toEqual([]);
  });

  it("getSignupStats compte inscrits et parrainés de la période comme la règle pure", async () => {
    for (const range of [
      { from: "2026-01-01", to: "2026-12-31" },
      { from: "2025-01-01", to: "2025-12-31" },
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2024-01-01", to: "2026-12-31" },
      { from: "2030-01-01", to: "2030-12-31" },
    ]) {
      expect(
        await customersDb.getSignupStats(range),
        JSON.stringify(range),
      ).toEqual(signupStats(customersFixtures, range));
    }
    const all = await customersDb.getSignupStats({
      from: "2024-01-01",
      to: "2026-12-31",
    });
    expect(all.signups).toBe(customersFixtures.length);
    expect(all.referred).toBeGreaterThan(0);
    expect(all.referred).toBeLessThan(all.signups);
  });

  it("la base refuse un code de parrainage mal formé, en double, ou un client qui se parraine lui-même", async () => {
    const { customers } = await import("@/db/schema");
    const { testDb } = await import("../support/test-database");
    const base = {
      fullName: "Test Contrainte",
      email: "contrainte@example.invalid",
      phone: "06 39 98 99 99",
      city: "Paris",
      postalCode: "75001",
    };
    /**
     * Nom de la contrainte PostgreSQL qui a refusé l'écriture, sinon null ;
     * chaque essai dans sa sous-transaction, pour ne pas abandonner celle du test.
     */
    const refusedBy = async (
      row: Partial<typeof customers.$inferInsert> & { id: string },
    ) => {
      try {
        await testDb().transaction((tx) =>
          tx.insert(customers).values({ ...base, ...row }),
        );
        return null;
      } catch (error) {
        const cause = (error as { cause?: { constraint_name?: string } }).cause;
        return cause?.constraint_name ?? "erreur sans contrainte";
      }
    };
    expect(
      await refusedBy({ id: "cli-test-1", referralCode: "Contrainte#12" }),
    ).toBe("customers_referral_code_format");
    expect(
      await refusedBy({ id: "cli-test-2", referralCode: "Benali#0001" }),
    ).toBe("customers_referral_code_idx");
    expect(
      await refusedBy({ id: "cli-test-3", referredById: "cli-test-3" }),
    ).toBe("customers_not_own_referrer");
    expect(
      await refusedBy({ id: "cli-test-4", referralCode: "Contrainte#0042" }),
    ).toBeNull();
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
