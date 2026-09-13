import { describe, expect, it } from "vitest";
import {
  assignmentsFixtures,
  couriersFixtures,
} from "@/domain/deliveries/fixtures";
import {
  ASSIGNABLE_STATUSES,
  buildTour,
  canBeAssigned,
  countUnassigned,
  deliveryDates,
  hasSlotConflict,
  todayInParis,
} from "@/domain/deliveries/rules";
import { ordersFixtures } from "@/domain/orders/fixtures";
import { sortOrdersBySlot, filterOrders } from "@/domain/orders/rules";
import { ORDER_STATUSES } from "@/domain/orders/status";

describe("canBeAssigned", () => {
  it("n'autorise que confirmée, en préparation et en livraison", () => {
    expect(ASSIGNABLE_STATUSES).toEqual([
      "confirmed",
      "preparing",
      "delivering",
    ]);
    for (const status of ORDER_STATUSES) {
      expect(canBeAssigned(status)).toBe(ASSIGNABLE_STATUSES.includes(status));
    }
  });
});

describe("hasSlotConflict", () => {
  const slot = { date: "2026-09-07", start: "09:00" };

  it("détecte un même livreur sur le même jour et la même heure pour une autre commande", () => {
    // crs-0001 livre déjà cmd-0014 le 07 à 09:00
    expect(
      hasSlotConflict(assignmentsFixtures, "crs-0001", slot, "cmd-0002"),
    ).toBe(true);
  });

  it("ne compte pas la commande elle-même (réattribution)", () => {
    expect(
      hasSlotConflict(assignmentsFixtures, "crs-0001", slot, "cmd-0014"),
    ).toBe(false);
  });

  it("accepte un autre livreur, une autre heure ou un autre jour", () => {
    expect(
      hasSlotConflict(assignmentsFixtures, "crs-0002", slot, "cmd-0002"),
    ).toBe(false);
    expect(
      hasSlotConflict(
        assignmentsFixtures,
        "crs-0001",
        { date: "2026-09-07", start: "11:00" },
        "cmd-0003",
      ),
    ).toBe(false);
    expect(
      hasSlotConflict(
        assignmentsFixtures,
        "crs-0001",
        { date: "2026-09-08", start: "09:00" },
        "cmd-0009",
      ),
    ).toBe(false);
  });

  it("sans attribution, jamais de conflit", () => {
    expect(hasSlotConflict([], "crs-0001", slot, "cmd-0002")).toBe(false);
  });
});

describe("buildTour", () => {
  const day = sortOrdersBySlot(
    filterOrders(ordersFixtures, { date: "2026-09-07" }),
  );
  const tour = buildTour(day, assignmentsFixtures, couriersFixtures);

  it("garde une entrée par commande, dans l'ordre reçu", () => {
    expect(tour.map((e) => e.order.id)).toEqual([
      "cmd-0001",
      "cmd-0002",
      "cmd-0014",
      "cmd-0003",
      "cmd-0004",
    ]);
  });

  it("croise les livreurs attribués et laisse null sinon", () => {
    const byId = new Map(tour.map((e) => [e.order.id, e]));
    expect(byId.get("cmd-0014")?.courier?.name).toBe("Karim Haddad");
    expect(byId.get("cmd-0004")?.courier?.name).toBe("Léa Fontaine");
    expect(byId.get("cmd-0001")?.courier).toBeNull();
  });

  it("marque l'attribuabilité selon le statut", () => {
    const byId = new Map(tour.map((e) => [e.order.id, e]));
    expect(byId.get("cmd-0001")?.assignable).toBe(false); // pending
    expect(byId.get("cmd-0002")?.assignable).toBe(true); // confirmed
  });

  it("countUnassigned ne compte que les attribuables sans livreur", () => {
    // cmd-0002 (confirmed) et cmd-0003 (preparing) sans livreur ; cmd-0001 pending exclue
    expect(countUnassigned(tour)).toBe(2);
  });
});

describe("todayInParis", () => {
  it("donne le jour de Paris, pas celui d'UTC", () => {
    expect(todayInParis(new Date("2026-09-13T22:30:00.000Z"))).toBe(
      "2026-09-14",
    );
    expect(todayInParis(new Date("2026-09-13T10:00:00.000Z"))).toBe(
      "2026-09-13",
    );
  });
});

describe("deliveryDates", () => {
  it("liste les jours distincts triés", () => {
    expect(deliveryDates(ordersFixtures)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ]);
  });
});
