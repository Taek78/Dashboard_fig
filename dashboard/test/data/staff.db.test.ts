import { describe, expect, it, vi } from "vitest";
import { communities, staff } from "@/db/schema";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";
import type { StaffInput } from "@/domain/staff/types";

/* Personnel et communautés sur la base de test, chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { staffDb } = await import("@/data/staff.db");
const { communitiesDb } = await import("@/data/communities.db");
const { ordersDb } = await import("@/data/orders.db");

const input: StaffInput = {
  kind: "preparateur",
  firstName: "Nour",
  lastName: "Sassi",
  email: "nour.sassi@fig-demo.invalid",
  phone: "06 39 98 90 50",
  shift: "matin",
  availability: "disponible",
  workDays: ["lun", "mar"],
  startedAt: "2026-09-14",
  notes: null,
  active: true,
  leftAt: null,
};

describe("staffDb", () => {
  it("listStaff trie (actifs d'abord) et filtre par métier", async () => {
    const all = await staffDb.listStaff();
    expect(all).toHaveLength(staffFixtures.length);
    expect(all.at(-1)?.active).toBe(false);
    const drivers = await staffDb.listStaff("livreur");
    expect(drivers.every((m) => m.kind === "livreur")).toBe(true);
    expect(await staffDb.getStaff("stf-0001")).toEqual(staffFixtures[0]);
  });

  it("createStaff attribue un id et refuse un e-mail déjà pris (sans casse)", async () => {
    const created = await staffDb.createStaff(input);
    expect(created).toMatchObject({
      firstName: "Nour",
      workDays: ["lun", "mar"],
    });
    expect(
      await staffDb.createStaff({
        ...input,
        email: "MALIK.DEMBELE@fig-demo.invalid",
      }),
    ).toBe("email_taken");
  });

  it("updateStaff remplace la fiche, garde id et createdAt, détecte le doublon d'e-mail", async () => {
    expect(await staffDb.updateStaff("stf-0005", input)).toMatchObject({
      id: "stf-0005",
      firstName: "Nour",
      createdAt: staffFixtures[4]!.createdAt,
    });
    expect(
      await staffDb.updateStaff("stf-0005", {
        ...input,
        email: "sophie.renard@fig-demo.invalid",
      }),
    ).toBe("email_taken");
    expect(
      await staffDb.updateStaff("stf-9999", {
        ...input,
        email: "personne.inconnue@fig-demo.invalid",
      }),
    ).toBeNull();
  });

  it("enregistre le créneau 24 h/24, l'arrêt maladie et une date de sortie", async () => {
    const created = await staffDb.createStaff({
      ...input,
      shift: "h24",
      availability: "arret_maladie",
    });
    expect(created).toMatchObject({
      shift: "h24",
      availability: "arret_maladie",
      leftAt: null,
    });
    if (created === "email_taken") throw new Error("e-mail déjà pris");
    expect(
      await staffDb.updateStaff(created.id, {
        ...input,
        active: false,
        leftAt: "2026-09-30",
      }),
    ).toMatchObject({ active: false, leftAt: "2026-09-30" });
  });

  it("la base refuse une date de sortie pour une personne présente ou avant son entrée", async () => {
    /**
     * Nom de la contrainte violée, ou null ; chaque essai dans son point de
     * sauvegarde, avec son id et son e-mail (un essai accepté reste écrit).
     */
    let n = 0;
    const refusedBy = async (values: Partial<StaffInput>) => {
      n += 1;
      try {
        await testDb().transaction((tx) =>
          tx.insert(staff).values({
            ...input,
            ...values,
            id: `stf-test-${n}`,
            email: `essai-${n}@fig-demo.invalid`,
          }),
        );
        return null;
      } catch (error) {
        return (
          (error as { cause?: { constraint_name?: string } }).cause
            ?.constraint_name ?? "?"
        );
      }
    };
    expect(await refusedBy({ leftAt: "2026-09-30" })).toBe(
      "staff_left_at_departed",
    );
    expect(await refusedBy({ active: false, leftAt: "2026-09-13" })).toBe(
      "staff_left_at_after_start",
    );
    expect(await refusedBy({ active: false, leftAt: "2026-09-14" })).toBeNull();
    // Départ antérieur à la migration 0019 : parti, sans date.
    expect(await refusedBy({ active: false })).toBeNull();
  });

  it("deleteStaff supprime et libère ses commandes (SET NULL)", async () => {
    expect((await ordersDb.getOrder("cmd-0004"))?.driver?.id).toBe("stf-0001");
    expect(await staffDb.deleteStaff("stf-0001")).toBe(true);
    expect(await staffDb.getStaff("stf-0001")).toBeNull();
    expect(await staffDb.deleteStaff("stf-0001")).toBe(false);
    expect((await ordersDb.getOrder("cmd-0004"))?.driver).toBeNull();
  });
});

describe("communitiesDb", () => {
  it("liste triée et lecture par id", async () => {
    expect((await communitiesDb.listCommunities()).map((c) => c.id)).toEqual([
      "com-0003",
      "com-0001",
      "com-0002",
    ]);
    expect((await communitiesDb.getCommunity("com-0001"))?.name).toBe(
      "Crèche Les Lucioles",
    );
    expect(await communitiesDb.getCommunity("com-9999")).toBeNull();
  });

  it("chaque communauté lue a un type et une visibilité", async () => {
    for (const c of await communitiesDb.listCommunities()) {
      expect(["voisinage", "entreprise", "point_relais"]).toContain(c.kind);
      expect(["public", "private"]).toContain(c.visibility);
    }
  });

  it("la base refuse un type ou une visibilité absents ou vides", async () => {
    const { id, createdAt, ...base } = communitiesFixtures[0]!;
    void id;
    void createdAt;
    /** Code d'erreur Postgres de l'insertion, ou null si elle passe. */
    const refused = async (values: Record<string, unknown>) => {
      try {
        await testDb().transaction((tx) =>
          tx
            .insert(communities)
            .values({ ...base, id: "com-test", ...values } as never),
        );
        return null;
      } catch (error) {
        return (error as { cause?: { code?: string } }).cause?.code ?? "?";
      }
    };
    // 23502 : NOT NULL violé ; 22P02 : valeur hors de l'enum (la chaîne vide comprise).
    expect(await refused({ visibility: undefined })).toBe("23502");
    expect(await refused({ visibility: null })).toBe("23502");
    expect(await refused({ kind: null })).toBe("23502");
    expect(await refused({ visibility: "" })).toBe("22P02");
    expect(await refused({ kind: "" })).toBe("22P02");
    expect(await refused({})).toBeNull();
  });
});
