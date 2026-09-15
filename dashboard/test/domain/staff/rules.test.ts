import { describe, expect, it } from "vitest";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";
import {
  assignableStaff,
  assignmentOptions,
  canBeAssigned,
  filterStaff,
  KIND_FOR_ROLE,
  sortStaff,
  staffFilterOptions,
  staffFullName,
  staffOrders,
  summarizeStaffWork,
  filterStaffHistory,
  hasStaffHistoryFilters,
  hasStaffSearch,
  matchesStaffQuery,
  searchStaff,
  staffTemplate,
} from "@/domain/staff/rules";
import type { StaffMember } from "@/domain/staff/types";

const byId = (id: string): StaffMember =>
  staffFixtures.find((m) => m.id === id)!;

describe("staffFullName", () => {
  it("prénom puis nom, sans espace superflu", () => {
    expect(staffFullName({ firstName: "Malik", lastName: "Dembélé" })).toBe(
      "Malik Dembélé",
    );
    expect(staffFullName({ firstName: "Léa", lastName: "" })).toBe("Léa");
  });
});

describe("sortStaff / filterStaff", () => {
  it("actifs d'abord, puis livreurs, préparateurs, gestionnaires, puis nom", () => {
    const sorted = sortStaff(staffFixtures);
    expect(sorted.at(-1)?.id).toBe("stf-0010");
    const kinds = sorted.filter((m) => m.active).map((m) => m.kind);
    expect(kinds).toEqual([...kinds].toSorted((a, b) => order(a) - order(b)));
    expect(sorted[0]?.lastName).toBe("Dembélé");
    expect(staffFixtures[0]?.id).toBe("stf-0001");
  });

  it("filtre par métier, tout le monde sans métier", () => {
    expect(filterStaff(staffFixtures)).toHaveLength(staffFixtures.length);
    expect(filterStaff(staffFixtures, "gestionnaire").map((m) => m.id)).toEqual(
      ["stf-0008", "stf-0009"],
    );
  });
});

describe("matchesStaffQuery", () => {
  const malik = () => byId("stf-0001");

  it("trouve par prénom, nom, dans les deux ordres, sans accents ni majuscules", () => {
    expect(matchesStaffQuery(malik(), "MALIK")).toBe(true);
    expect(matchesStaffQuery(malik(), "dembele")).toBe(true);
    expect(matchesStaffQuery(malik(), "dembélé malik")).toBe(true);
    expect(matchesStaffQuery(malik(), "malik renard")).toBe(false);
  });

  it("trouve par e-mail et par téléphone (chiffres seuls)", () => {
    expect(matchesStaffQuery(malik(), "dembele@fig")).toBe(true);
    expect(matchesStaffQuery(malik(), "90 01")).toBe(true);
    expect(matchesStaffQuery(malik(), "9001")).toBe(true);
    expect(matchesStaffQuery(malik(), "90 04")).toBe(false);
    expect(matchesStaffQuery(malik(), "0")).toBe(false);
  });

  it("une recherche vide ou absente garde tout le monde", () => {
    expect(matchesStaffQuery(malik(), undefined)).toBe(true);
    expect(matchesStaffQuery(malik(), "   ")).toBe(true);
  });
});

describe("searchStaff / hasStaffSearch", () => {
  const ids = (members: readonly StaffMember[]) => members.map((m) => m.id);

  it("sans recherche, toute l'équipe triée", () => {
    expect(ids(searchStaff(staffFixtures, {}))).toEqual(
      ids(sortStaff(staffFixtures)),
    );
    expect(hasStaffSearch({})).toBe(false);
    expect(hasStaffSearch({ workDay: "sam" })).toBe(true);
  });

  it("cumule métier, créneau et jour travaillé", () => {
    expect(
      ids(
        searchStaff(staffFixtures, {
          kind: "livreur",
          shift: "matin",
          workDay: "sam",
        }),
      ),
    ).toEqual(["stf-0001"]);
  });

  it("une disponibilité ne retient que les personnes encore dans l'équipe", () => {
    const unavailable = ids(
      searchStaff(staffFixtures, { availability: "indisponible" }),
    );
    expect(unavailable).toEqual(["stf-0007"]);
    expect(unavailable).not.toContain("stf-0010");
    expect(ids(searchStaff(staffFixtures, { presence: "partis" }))).toEqual([
      "stf-0010",
    ]);
    expect(
      searchStaff(staffFixtures, { presence: "actifs" }).every((m) => m.active),
    ).toBe(true);
  });

  it("combine la recherche libre et les filtres", () => {
    expect(
      ids(
        searchStaff(staffFixtures, { query: "fig-demo", kind: "gestionnaire" }),
      ),
    ).toEqual(["stf-0009", "stf-0008"]);
    expect(searchStaff(staffFixtures, { query: "zzz" })).toEqual([]);
  });
});

function order(kind: StaffMember["kind"]): number {
  return { livreur: 0, preparateur: 1, gestionnaire: 2 }[kind];
}

describe("assignableStaff / canBeAssigned / assignmentOptions", () => {
  it("ne propose que le bon métier, actif, disponibles d'abord", () => {
    const drivers = assignableStaff(staffFixtures, "driver");
    expect(drivers.every((m) => m.kind === "livreur" && m.active)).toBe(true);
    expect(drivers.map((m) => m.id)).not.toContain("stf-0010");
    expect(drivers.at(-1)?.availability).toBe("conge");
    expect(KIND_FOR_ROLE.preparer).toBe("preparateur");
  });

  it("canBeAssigned refuse le mauvais métier et une personne partie", () => {
    expect(canBeAssigned(byId("stf-0005"), "preparer")).toBe(true);
    expect(canBeAssigned(byId("stf-0005"), "driver")).toBe(false);
    expect(canBeAssigned(byId("stf-0010"), "driver")).toBe(false);
    expect(canBeAssigned(byId("stf-0003"), "driver")).toBe(true);
  });

  it("assignmentOptions donne les deux listes avec le nom affiché", () => {
    const options = assignmentOptions(staffFixtures);
    expect(options.preparer.map((o) => o.name)).toContain("Julien Carpentier");
    expect(options.driver.map((o) => o.name)).toContain("Malik Dembélé");
    expect(options.driver.map((o) => o.name)).not.toContain(
      "Julien Carpentier",
    );
    expect(options.preparer[0]).toMatchObject({ availability: "disponible" });
  });
});

describe("staffOrders / summarizeStaffWork", () => {
  it("retrouve les commandes d'une personne, les plus récentes d'abord", () => {
    const malik = staffOrders(scenarioOrders, "stf-0001");
    expect(malik.map((o) => o.id)).toEqual([
      "cmd-0004",
      "cmd-0014",
      "cmd-0008",
      "cmd-0007",
    ]);
    expect(staffOrders(scenarioOrders, "stf-9999")).toEqual([]);
  });

  it("compte préparées, livrées, en cours et la dernière activité", () => {
    expect(summarizeStaffWork(scenarioOrders, "stf-0001")).toEqual({
      prepared: 0,
      delivered: 2,
      inProgress: 2,
      lastActivityDate: "2026-09-07",
    });
    expect(summarizeStaffWork(scenarioOrders, "stf-0005")).toEqual({
      prepared: 4,
      delivered: 0,
      inProgress: 2,
      lastActivityDate: "2026-09-07",
    });
    expect(summarizeStaffWork(scenarioOrders, "stf-9999")).toEqual({
      prepared: 0,
      delivered: 0,
      inProgress: 0,
      lastActivityDate: null,
    });
  });
});

describe("staffFilterOptions", () => {
  it("propose tout le métier, personnes désactivées comprises, actives d'abord", () => {
    const { preparer, driver } = staffFilterOptions(staffFixtures);
    expect(preparer.map((o) => o.id).sort()).toEqual([
      "stf-0005",
      "stf-0006",
      "stf-0007",
    ]);
    expect(driver.map((o) => o.id).sort()).toEqual([
      "stf-0001",
      "stf-0002",
      "stf-0003",
      "stf-0004",
      "stf-0010",
    ]);
    expect(driver.at(-1)).toEqual({
      id: "stf-0010",
      name: "Paul Girard",
      active: false,
    });
  });
});

describe("staffTemplate", () => {
  it("reprend le métier et l'organisation, jamais l'identité ni les notes", () => {
    const malik = byId("stf-0001");
    const template = staffTemplate(malik);
    expect(template).toEqual({
      kind: malik.kind,
      shift: malik.shift,
      availability: malik.availability,
      workDays: malik.workDays,
      active: malik.active,
    });
    expect(template.workDays).not.toBe(malik.workDays);
    expect(template).not.toHaveProperty("email");
    expect(template).not.toHaveProperty("notes");
  });
});

describe("filterStaffHistory / hasStaffHistoryFilters", () => {
  const ids = (orders: readonly { id: string }[]) => orders.map((o) => o.id);

  it("sans recherche, toutes les commandes de la personne", () => {
    expect(ids(filterStaffHistory(scenarioOrders, "stf-0001", {}))).toEqual(
      ids(staffOrders(scenarioOrders, "stf-0001")),
    );
    expect(hasStaffHistoryFilters({})).toBe(false);
    expect(hasStaffHistoryFilters({ role: "livraison" })).toBe(true);
  });

  it("filtre par rôle tenu", () => {
    expect(
      filterStaffHistory(scenarioOrders, "stf-0001", { role: "livraison" }),
    ).toHaveLength(4);
    expect(
      filterStaffHistory(scenarioOrders, "stf-0001", { role: "preparation" }),
    ).toEqual([]);
  });

  it("cumule recherche, statut, période et rôle, les plus récentes d'abord", () => {
    expect(
      ids(
        filterStaffHistory(scenarioOrders, "stf-0005", {
          role: "preparation",
          query: "FIG-260906",
        }),
      ),
    ).toEqual(["cmd-0005", "cmd-0007"]);
    expect(
      ids(
        filterStaffHistory(scenarioOrders, "stf-0005", {
          status: "delivering",
        }),
      ),
    ).toEqual(["cmd-0014"]);
    expect(
      ids(
        filterStaffHistory(scenarioOrders, "stf-0005", {
          from: "2026-09-07",
          to: "2026-09-07",
        }),
      ),
    ).toEqual(["cmd-0003", "cmd-0014"]);
  });
});
