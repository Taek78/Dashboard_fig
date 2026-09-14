import { describe, expect, it } from "vitest";
import { scenarioCustomers } from "@/domain/customers/fixtures";
import {
  computeCustomerStats,
  searchCustomers,
  sortCustomersByName,
  sortNotesNewestFirst,
} from "@/domain/customers/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { filterOrders } from "@/domain/orders/rules";

describe("searchCustomers", () => {
  it("sans requête, renvoie tout le monde", () => {
    expect(searchCustomers(scenarioCustomers, undefined)).toHaveLength(12);
    expect(searchCustomers(scenarioCustomers, "  ")).toHaveLength(12);
  });

  it("trouve par nom sans accents ni casse", () => {
    expect(
      searchCustomers(scenarioCustomers, "elise").map((c) => c.id),
    ).toEqual(["cli-0008"]);
    expect(
      searchCustomers(scenarioCustomers, "LEFEVRE").map((c) => c.id),
    ).toEqual(["cli-0004"]);
  });

  it("trouve par morceau d'e-mail", () => {
    expect(
      searchCustomers(scenarioCustomers, "dasilva").map((c) => c.id),
    ).toEqual(["cli-0010"]);
  });

  it("trouve par téléphone, chiffres seuls, avec ou sans espaces", () => {
    expect(
      searchCustomers(scenarioCustomers, "00 07").map((c) => c.id),
    ).toEqual(["cli-0007"]);
    expect(
      searchCustomers(scenarioCustomers, "0639980012").map((c) => c.id),
    ).toEqual(["cli-0012"]);
  });

  it("un seul chiffre ne déclenche pas la recherche téléphone", () => {
    expect(searchCustomers(scenarioCustomers, "0")).toHaveLength(0);
  });

  it("renvoie [] si rien ne correspond, sans muter l'entrée", () => {
    expect(searchCustomers(scenarioCustomers, "zzz")).toEqual([]);
    expect(scenarioCustomers).toHaveLength(12);
  });
});

describe("sortCustomersByName", () => {
  it("trie en ordre français, copie", () => {
    const sorted = sortCustomersByName(scenarioCustomers);
    expect(sorted[0]?.fullName).toBe("Amel Benali");
    expect(sorted[1]?.fullName).toBe("Chloé Da Silva");
    expect(scenarioCustomers[1]?.fullName).toBe("Théo Marchand");
  });
});

describe("computeCustomerStats", () => {
  it("compte les commandes, somme hors annulées, dernière livraison", () => {
    const orders = filterOrders(scenarioOrders, { customerId: "cli-0001" });
    const stats = computeCustomerStats(orders);
    expect(stats.orderCount).toBe(orders.length);
    expect(stats.totalSpentCents).toBe(
      orders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.totalCents, 0),
    );
    expect(stats.lastDeliveryDate).toBe(
      orders
        .map((o) => o.deliverySlot.date)
        .sort()
        .at(-1),
    );
  });

  it("sans commande : zéros et null", () => {
    expect(computeCustomerStats([])).toEqual({
      orderCount: 0,
      totalSpentCents: 0,
      lastDeliveryDate: null,
    });
  });
});

describe("sortNotesNewestFirst", () => {
  it("met la plus récente en premier sans muter", () => {
    const notes = scenarioCustomers[0]!.notes;
    const sorted = sortNotesNewestFirst(notes);
    expect(sorted[0]?.id).toBe("note-0002");
    expect(notes[0]?.id).toBe("note-0001");
  });
});
