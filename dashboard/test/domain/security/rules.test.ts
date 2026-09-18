import { describe, expect, it } from "vitest";
import {
  hasSecurityFilters,
  matchesSecurityFilters,
  matchesSecurityQuery,
  searchTextOf,
  securityEventView,
  securityFiltersQuery,
  sortSecurityEvents,
} from "@/domain/security/rules";
import { parseSecurityFilters } from "@/domain/security/schemas";
import type { SecurityEventRecord } from "@/domain/security/types";

/*
 * Règles pures du journal : recherche, filtres, ordre, et la lecture tolérante
 * de l'URL. La parité avec le SQL est vérifiée à part, sur la base de test
 * (test/data/security-log.db.test.ts) : ces règles-ci en sont la référence.
 */
const event = (
  id: string,
  at: string,
  type: string,
  details: Record<string, unknown> = {},
): SecurityEventRecord => ({ id, at, type, details });

const refus = event("e1", "2026-09-17T08:00:00.000Z", "login_failure", {
  email: "Zaki@fig-demo.invalid",
  ip: "203.0.113.4",
});
const staff = event("e2", "2026-09-18T09:00:00.000Z", "staff_updated", {
  userId: "usr-2",
  staffId: "stf-1",
  kind: "préparateur",
});
const inconnu = event("e3", "2026-09-18T10:00:00.000Z", "venu_du_futur", {
  note: "autre version",
});

describe("recherche libre", () => {
  it("porte sur le type et les valeurs, pas sur les clés ni les libellés", () => {
    expect(searchTextOf(refus)).toBe(
      "login_failure Zaki@fig-demo.invalid 203.0.113.4",
    );
    // « email » est une clé, « Connexion refusée » un libellé : ni l'un ni
    // l'autre n'est une donnée de l'événement.
    expect(matchesSecurityQuery(refus, "email")).toBe(false);
    expect(matchesSecurityQuery(refus, "Connexion refusée")).toBe(false);
  });

  it("ignore la casse, les accents et les espaces autour", () => {
    expect(matchesSecurityQuery(refus, "ZAKI")).toBe(true);
    expect(matchesSecurityQuery(refus, "  203.0.113.4  ")).toBe(true);
    expect(matchesSecurityQuery(staff, "preparateur")).toBe(true);
    expect(matchesSecurityQuery(staff, "PRÉPARATEUR")).toBe(true);
    expect(matchesSecurityQuery(refus, "amel")).toBe(false);
    // Une recherche vide ne filtre rien.
    expect(matchesSecurityQuery(refus, "   ")).toBe(true);
  });

  it("ignore les valeurs nulles, qui ne sont pas du texte", () => {
    const retrait = event(
      "e4",
      "2026-09-18T11:00:00.000Z",
      "order_staff_assigned",
      {
        userId: "usr-2",
        orderId: "cmd-1",
        role: "driver",
        staffId: null,
      },
    );
    expect(searchTextOf(retrait)).not.toContain("null");
    expect(matchesSecurityQuery(retrait, "cmd-1")).toBe(true);
  });
});

describe("filtres", () => {
  it("cumule recherche, familles et période", () => {
    const filters = {
      query: "zaki",
      families: ["connexion"] as const,
      from: "2026-09-17",
      to: "2026-09-17",
    };
    expect(matchesSecurityFilters(refus, filters)).toBe(true);
    expect(matchesSecurityFilters(refus, { ...filters, query: "amel" })).toBe(
      false,
    );
    expect(
      matchesSecurityFilters(refus, { ...filters, families: ["comptes"] }),
    ).toBe(false);
    expect(
      matchesSecurityFilters(refus, { ...filters, from: "2026-09-18" }),
    ).toBe(false);
  });

  it("n'attribue aucun type inconnu à une famille cochée", () => {
    expect(matchesSecurityFilters(inconnu, {})).toBe(true);
    expect(matchesSecurityFilters(inconnu, { families: ["comptes"] })).toBe(
      false,
    );
    // Il reste affichable, avec son type brut et sans famille.
    const view = securityEventView(inconnu);
    expect(view.label).toBe("venu_du_futur");
    expect(view.family).toBeNull();
  });

  it("compare la période au JOUR de l'événement, bornes comprises", () => {
    expect(matchesSecurityFilters(refus, { from: "2026-09-17" })).toBe(true);
    expect(matchesSecurityFilters(refus, { to: "2026-09-17" })).toBe(true);
    expect(matchesSecurityFilters(refus, { to: "2026-09-16" })).toBe(false);
  });

  it("dit si l'écran est filtré", () => {
    expect(hasSecurityFilters({})).toBe(false);
    expect(hasSecurityFilters({ query: "zaki" })).toBe(true);
    expect(hasSecurityFilters({ families: ["connexion"] })).toBe(true);
    expect(hasSecurityFilters({ from: "2026-09-17" })).toBe(true);
  });
});

describe("ordre", () => {
  it("met le plus récent en tête, l'identifiant départageant à instant égal", () => {
    const a = event("a", "2026-09-18T10:00:00.000Z", "login_success");
    const b = event("b", "2026-09-18T10:00:00.000Z", "login_success");
    const old = event("c", "2026-09-17T10:00:00.000Z", "login_success");
    expect(sortSecurityEvents([old, a, b]).map((e) => e.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    // Copie : la liste reçue n'est pas modifiée.
    const source = [old, a];
    sortSecurityEvents(source);
    expect(source.map((e) => e.id)).toEqual(["c", "a"]);
  });
});

describe("lecture de l'URL et aller-retour", () => {
  it("lit les familles répétées, la recherche et la période", () => {
    expect(
      parseSecurityFilters({
        q: " zaki ",
        famille: ["connexion", "clients"],
        du: "2026-09-17",
        au: "2026-09-18",
      }),
    ).toEqual({
      query: "zaki",
      families: ["connexion", "clients"],
      from: "2026-09-17",
      to: "2026-09-18",
    });
    // Une seule case cochée arrive en chaîne, pas en tableau.
    expect(parseSecurityFilters({ famille: "mails" }).families).toEqual([
      "mails",
    ]);
    // Toutes les familles cochées revient à n'en cocher aucune.
    expect(
      parseSecurityFilters({
        famille: [
          "connexion",
          "comptes",
          "commandes",
          "catalogue",
          "personnel",
          "clients",
          "messages",
          "application",
          "mails",
        ],
      }).families,
    ).toBeUndefined();
    // Doublon d'URL : une seule fois.
    expect(
      parseSecurityFilters({ famille: ["mails", "mails"] }).families,
    ).toEqual(["mails"]);
  });

  it("ignore une valeur invalide au lieu d'échouer devant qui enquête", () => {
    expect(
      parseSecurityFilters({ famille: "inventee" }).families,
    ).toBeUndefined();
    expect(parseSecurityFilters({ du: "hier" }).from).toBeUndefined();
    expect(parseSecurityFilters({ q: "" }).query).toBeUndefined();
    expect(parseSecurityFilters({ q: "x".repeat(500) }).query).toBeUndefined();
    // Dates inversées : aucune période appliquée (règle commune).
    expect(
      parseSecurityFilters({ du: "2026-09-18", au: "2026-09-17" }).from,
    ).toBeUndefined();
  });

  it("réécrit l'URL telle qu'elle se relit", () => {
    const filters = {
      query: "zaki",
      families: ["connexion", "mails"] as const,
      from: "2026-09-17",
      to: "2026-09-18",
    };
    const query = securityFiltersQuery(filters);
    expect(query).toBe(
      "q=zaki&famille=connexion&famille=mails&du=2026-09-17&au=2026-09-18",
    );
    expect(
      parseSecurityFilters(
        Object.fromEntries(
          [...new URLSearchParams(query).keys()].map((key) => [
            key,
            new URLSearchParams(query).getAll(key).length > 1
              ? new URLSearchParams(query).getAll(key)
              : (new URLSearchParams(query).get(key) ?? undefined),
          ]),
        ),
      ),
    ).toEqual({ ...filters, families: ["connexion", "mails"] });
    expect(securityFiltersQuery({})).toBe("");
  });
});
