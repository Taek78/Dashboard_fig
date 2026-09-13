import { describe, expect, it } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import {
  computeCustomerStats,
  searchCustomers,
  sortCustomersByName,
  sortNotesNewestFirst,
} from "@/domain/customers/rules";
import { ordersFixtures } from "@/domain/orders/fixtures";
import { filterOrders } from "@/domain/orders/rules";

describe("searchCustomers", () => {
  it("sans requête, renvoie tout le monde", () => {
    expect(searchCustomers(customersFixtures, undefined)).toHaveLength(12);
    expect(searchCustomers(customersFixtures, "  ")).toHaveLength(12);
  });

  it("trouve par nom sans accents ni casse", () => {
    expect(
      searchCustomers(customersFixtures, "elise").map((c) => c.id),
    ).toEqual(["cli-0008"]);
    expect(
      searchCustomers(customersFixtures, "LEFEVRE").map((c) => c.id),
    ).toEqual(["cli-0004"]);
  });

  it("trouve par morceau d'e-mail", () => {
    expect(
      searchCustomers(customersFixtures, "dasilva").map((c) => c.id),
    ).toEqual(["cli-0010"]);
  });

  it("trouve par téléphone, chiffres seuls, avec ou sans espaces", () => {
    expect(
      searchCustomers(customersFixtures, "00 07").map((c) => c.id),
    ).toEqual(["cli-0007"]);
    expect(
      searchCustomers(customersFixtures, "0639980012").map((c) => c.id),
    ).toEqual(["cli-0012"]);
  });

  it("un seul chiffre ne déclenche pas la recherche téléphone", () => {
    expect(searchCustomers(customersFixtures, "0")).toHaveLength(0);
  });

  it("renvoie [] si rien ne correspond, sans muter l'entrée", () => {
    expect(searchCustomers(customersFixtures, "zzz")).toEqual([]);
    expect(customersFixtures).toHaveLength(12);
  });
});

describe("sortCustomersByName", () => {
  it("trie en ordre français, copie", () => {
    const sorted = sortCustomersByName(customersFixtures);
    expect(sorted[0]?.fullName).toBe("Amel Benali");
    expect(sorted[1]?.fullName).toBe("Chloé Da Silva");
    expect(customersFixtures[1]?.fullName).toBe("Théo Marchand");
  });
});

describe("computeCustomerStats", () => {
  it("compte les commandes, somme hors annulées, dernière livraison", () => {
    const orders = filterOrders(ordersFixtures, { customerId: "cli-0001" });
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
    const notes = customersFixtures[0]!.notes;
    const sorted = sortNotesNewestFirst(notes);
    expect(sorted[0]?.id).toBe("note-0002");
    expect(notes[0]?.id).toBe("note-0001");
  });
});
