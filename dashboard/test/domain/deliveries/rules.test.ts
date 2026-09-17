import { describe, expect, it } from "vitest";
import {
  itineraryUrl,
  RECENT_DAYS,
  recentDeliveryDays,
  recentDeliveryDaysFromCounts,
  todayInParis,
  tourProgress,
} from "@/domain/deliveries/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { filterOrders } from "@/domain/orders/rules";

/* Les tournées du scénario : 4 commandes le 6, 5 le 7, 5 le 8 septembre 2026. */
const day = (date: string) =>
  filterOrders(scenarioOrders, { from: date, to: date });

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

describe("recentDeliveryDays", () => {
  it(`donne les ${RECENT_DAYS} derniers jours jusqu'à aujourd'hui, jours vides compris`, () => {
    expect(RECENT_DAYS).toBe(7);
    expect(recentDeliveryDays(scenarioOrders, "2026-09-08")).toEqual([
      { date: "2026-09-02", count: 0 },
      { date: "2026-09-03", count: 0 },
      { date: "2026-09-04", count: 0 },
      { date: "2026-09-05", count: 0 },
      { date: "2026-09-06", count: 4 },
      { date: "2026-09-07", count: 5 },
      { date: "2026-09-08", count: 5 },
    ]);
  });

  it("donne les mêmes raccourcis à partir de totaux par jour (base)", () => {
    const perDay = new Map([
      ["2026-09-06", 4],
      ["2026-09-07", 5],
      ["2026-09-08", 5],
      ["2026-08-20", 9],
    ]);
    expect(recentDeliveryDaysFromCounts(perDay, "2026-09-08")).toEqual(
      recentDeliveryDays(scenarioOrders, "2026-09-08"),
    );
    expect(recentDeliveryDaysFromCounts(new Map(), "2026-09-08", 2)).toEqual([
      { date: "2026-09-07", count: 0 },
      { date: "2026-09-08", count: 0 },
    ]);
  });
});

describe("tourProgress", () => {
  it("détaille une tournée en cours, du terminé vers le reste à faire", () => {
    expect(tourProgress(day("2026-09-08"))).toEqual({
      total: 5,
      done: 1,
      remaining: 4,
      percentDone: 20,
      segments: [
        { status: "cancelled", count: 1 },
        { status: "preparing", count: 4 },
      ],
    });
    // cmd-0001, 0002 et 0003 en préparation ; 0004 et 0014 expédiées
    expect(tourProgress(day("2026-09-07")).segments).toEqual([
      { status: "delivering", count: 2 },
      { status: "preparing", count: 3 },
    ]);
  });

  it("compte les livrées et les annulées comme traitées", () => {
    expect(tourProgress(day("2026-09-06"))).toMatchObject({
      total: 4,
      done: 4,
      remaining: 0,
      percentDone: 100,
    });
    expect(tourProgress([])).toEqual({
      total: 0,
      done: 0,
      remaining: 0,
      percentDone: 0,
      segments: [],
    });
  });
});

describe("itineraryUrl", () => {
  it("encode code postal et ville dans une recherche Google Maps, la rue devant quand elle est connue", () => {
    expect(itineraryUrl("75011", "Paris")).toBe(
      "https://www.google.com/maps/search/?api=1&query=75011%20Paris",
    );
    expect(itineraryUrl("75011", "Paris", null)).toBe(
      "https://www.google.com/maps/search/?api=1&query=75011%20Paris",
    );
    expect(itineraryUrl("75011", "Paris", "12 rue des Lilas")).toBe(
      "https://www.google.com/maps/search/?api=1&query=12%20rue%20des%20Lilas%2C%2075011%20Paris",
    );
  });
});
