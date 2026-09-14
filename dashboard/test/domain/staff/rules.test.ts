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
  staffFullName,
  staffOrders,
  summarizeStaffWork,
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
