import { describe, expect, it, vi } from "vitest";
import { securityEvents } from "@/db/schema";

/*
 * Lecture du journal de sécurité sur la base de test, chaque test dans une
 * transaction annulée.
 *
 * L'exigence principale est la PARITÉ : la recherche, les familles et la
 * période sont faites en SQL, et doivent rendre exactement ce que rend la
 * règle pure sur les mêmes lignes. Sans cela, l'écran mentirait à qui enquête,
 * et c'est le seul écran dont on attend qu'il dise toute la vérité.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { securityLogDb } = await import("@/data/security-log.db");
const { matchesSecurityFilters, sortSecurityEvents } =
  await import("@/domain/security/rules");
const { SECURITY_FAMILIES } = await import("@/domain/security/events");
import type { SecurityEventRecord } from "@/domain/security/types";
import type { SecurityFilters } from "@/domain/security/types";

/*
 * Un jeu d'événements écrit à la main, qui couvre ce qui distingue les cas :
 * plusieurs familles, deux jours, une adresse IP commune à trois lignes, un
 * détail nul, un accent (la recherche doit l'ignorer), un type inconnu.
 */
const SEEDED: SecurityEventRecord[] = [
  {
    id: "sec-1",
    at: "2026-09-16T08:00:00.000Z",
    type: "login_failure",
    details: { email: "zaki@fig-demo.invalid", ip: "203.0.113.4" },
  },
  {
    id: "sec-2",
    at: "2026-09-16T09:30:00.000Z",
    type: "login_success",
    details: { email: "amel@fig-demo.invalid", ip: "203.0.113.4" },
  },
  {
    id: "sec-3",
    at: "2026-09-17T10:00:00.000Z",
    type: "account_created",
    details: { userId: "usr-0001", targetId: "usr-0009", role: "lecture" },
  },
  {
    id: "sec-4",
    at: "2026-09-17T11:00:00.000Z",
    type: "customer_exported",
    details: { userId: "usr-0001", customerId: "cli-0001" },
  },
  {
    id: "sec-5",
    at: "2026-09-17T11:00:00.000Z",
    type: "order_staff_assigned",
    details: {
      userId: "usr-0002",
      orderId: "cmd-1",
      role: "driver",
      staffId: null,
    },
  },
  {
    id: "sec-6",
    at: "2026-09-18T07:15:00.000Z",
    type: "api_rate_limited",
    details: { subject: "session", ip: "203.0.113.4" },
  },
  {
    id: "sec-7",
    at: "2026-09-18T08:00:00.000Z",
    type: "staff_updated",
    details: { userId: "usr-0002", staffId: "stf-1", kind: "préparateur" },
  },
  {
    id: "sec-8",
    at: "2026-09-18T08:30:00.000Z",
    type: "venu_du_futur",
    details: { note: "type écrit par une version plus récente" },
  },
];

async function seed() {
  // La table est vidée : le seed de la base de test n'en écrit pas, mais une
  // exécution précédente a pu en laisser hors transaction.
  await testDb().delete(securityEvents);
  await testDb()
    .insert(securityEvents)
    .values(
      SEEDED.map((event) => ({
        id: event.id,
        at: new Date(event.at),
        type: event.type,
        details: event.details,
      })),
    );
}

/** Ce que la règle pure rend, dans l'ordre de l'écran. */
function expected(filters: SecurityFilters): string[] {
  return sortSecurityEvents(
    SEEDED.filter((event) => matchesSecurityFilters(event, filters)),
  ).map((event) => event.id);
}

async function actual(filters: SecurityFilters): Promise<string[]> {
  const page = await securityLogDb.getSecurityEventsPage(filters, 1);
  return page.items.map((item) => item.id);
}

describe("securityLogDb : parité avec les règles pures", () => {
  it("rend le journal entier, du plus récent au plus ancien", async () => {
    await seed();
    expect(await actual({})).toEqual(expected({}));
    // L'ordre est bien décroissant, identifiant en départage à instant égal.
    expect(await actual({})).toEqual([
      "sec-8",
      "sec-7",
      "sec-6",
      "sec-5",
      "sec-4",
      "sec-3",
      "sec-2",
      "sec-1",
    ]);
  });

  it("cherche dans le type et les valeurs des détails, sans casse ni accent", async () => {
    await seed();
    for (const query of [
      "203.0.113.4",
      "ZAKI",
      "cli-0001",
      "login_failure",
      "preparateur",
      "PRÉPARATEUR",
      "usr-0001",
      "introuvable",
    ]) {
      expect(await actual({ query })).toEqual(expected({ query }));
    }
    // Ce que ces recherches trouvent, en clair.
    expect(await actual({ query: "203.0.113.4" })).toEqual([
      "sec-6",
      "sec-2",
      "sec-1",
    ]);
    expect(await actual({ query: "preparateur" })).toEqual(["sec-7"]);
    expect(await actual({ query: "introuvable" })).toEqual([]);
  });

  it("ne cherche pas dans les CLÉS des détails, qui ne sont pas des données", async () => {
    await seed();
    // « email » est un nom de champ : le chercher ne doit rien rapporter,
    // sans quoi la moitié du journal remonterait sur un mot technique.
    expect(await actual({ query: "email" })).toEqual(
      expected({ query: "email" }),
    );
    expect(await actual({ query: "email" })).toEqual([]);
  });

  it("filtre par familles, qui s'additionnent", async () => {
    await seed();
    for (const families of [
      ["connexion"] as const,
      ["clients"] as const,
      ["connexion", "clients"] as const,
      ["application", "personnel"] as const,
      SECURITY_FAMILIES,
    ]) {
      const filters = { families: [...families] };
      expect(await actual(filters)).toEqual(expected(filters));
    }
    expect(await actual({ families: ["connexion"] })).toEqual([
      "sec-2",
      "sec-1",
    ]);
    expect(await actual({ families: ["connexion", "clients"] })).toEqual([
      "sec-4",
      "sec-2",
      "sec-1",
    ]);
    // Un type inconnu n'appartient à aucune famille connue : il n'est rendu
    // que sans filtre de famille, jamais par erreur dans une famille cochée.
    expect(await actual({ families: [...SECURITY_FAMILIES] })).not.toContain(
      "sec-8",
    );
  });

  it("filtre par période sur le jour de Paris, bornes comprises", async () => {
    await seed();
    for (const period of [
      { from: "2026-09-17", to: "2026-09-17" },
      { from: "2026-09-16", to: "2026-09-17" },
      { from: "2026-09-18" },
      { to: "2026-09-16" },
    ]) {
      expect(await actual(period)).toEqual(expected(period));
    }
    expect(await actual({ from: "2026-09-17", to: "2026-09-17" })).toEqual([
      "sec-5",
      "sec-4",
      "sec-3",
    ]);
  });

  it("combine recherche, familles et période comme la règle pure", async () => {
    await seed();
    const filters: SecurityFilters = {
      query: "203.0.113.4",
      families: ["connexion"],
      from: "2026-09-16",
      to: "2026-09-16",
    };
    expect(await actual(filters)).toEqual(expected(filters));
    expect(await actual(filters)).toEqual(["sec-2", "sec-1"]);
  });

  it("découpe en pages, compte le total, et ramène un numéro hors bornes", async () => {
    await seed();
    const first = await securityLogDb.getSecurityEventsPage({}, 1, 3);
    expect(first.total).toBe(SEEDED.length);
    expect(first.pageCount).toBe(3);
    expect(first.items.map((e) => e.id)).toEqual(["sec-8", "sec-7", "sec-6"]);

    const second = await securityLogDb.getSecurityEventsPage({}, 2, 3);
    expect(second.items.map((e) => e.id)).toEqual(["sec-5", "sec-4", "sec-3"]);

    // Page demandée au-delà de la dernière : la dernière, pas une page vide.
    const beyond = await securityLogDb.getSecurityEventsPage({}, 99, 3);
    expect(beyond.page).toBe(3);
    expect(beyond.items.map((e) => e.id)).toEqual(["sec-2", "sec-1"]);

    expect(await securityLogDb.countSecurityEvents({})).toBe(SEEDED.length);
    expect(
      await securityLogDb.countSecurityEvents({ families: ["connexion"] }),
    ).toBe(2);
  });

  it("dit depuis quand le journal couvre", async () => {
    await seed();
    expect(await securityLogDb.oldestSecurityEventAt()).toBe(
      "2026-09-16T08:00:00.000Z",
    );
    await testDb().delete(securityEvents);
    expect(await securityLogDb.oldestSecurityEventAt()).toBeNull();
  });

  it("rend les détails tels qu'ils ont été écrits, valeurs nulles comprises", async () => {
    await seed();
    const page = await securityLogDb.getSecurityEventsPage(
      { query: "cmd-1" },
      1,
    );
    expect(page.items[0]?.details).toEqual({
      userId: "usr-0002",
      orderId: "cmd-1",
      role: "driver",
      staffId: null,
    });
  });
});
