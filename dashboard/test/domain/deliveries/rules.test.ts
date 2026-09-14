import { describe, expect, it } from "vitest";
import {
  deliveryDates,
  itineraryUrl,
  nextDeliveryStep,
  nextStopIndex,
  summarizeTour,
  todayInParis,
} from "@/domain/deliveries/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { filterOrders } from "@/domain/orders/rules";

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
    expect(deliveryDates(scenarioOrders)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ]);
  });
});

describe("summarizeTour", () => {
  it("compte à confirmer, en cours et terminées sur la tournée du 7", () => {
    const day = filterOrders(scenarioOrders, { date: "2026-09-07" });
    // cmd-0001 pending ; 0002 confirmed, 0003 preparing, 0004 et 0014 delivering
    expect(summarizeTour(day)).toEqual({
      total: 5,
      toConfirm: 1,
      inProgress: 4,
      done: 0,
    });
  });

  it("compte les livrées et annulées comme terminées", () => {
    const day = filterOrders(scenarioOrders, { date: "2026-09-06" });
    expect(summarizeTour(day)).toEqual({
      total: 4,
      toConfirm: 0,
      inProgress: 0,
      done: 4,
    });
    expect(summarizeTour([])).toEqual({
      total: 0,
      toConfirm: 0,
      inProgress: 0,
      done: 0,
    });
  });
});

describe("nextDeliveryStep", () => {
  it("suit le cycle nominal et s'arrête aux états terminaux", () => {
    expect(nextDeliveryStep("pending")).toBe("confirmed");
    expect(nextDeliveryStep("confirmed")).toBe("preparing");
    expect(nextDeliveryStep("preparing")).toBe("delivering");
    expect(nextDeliveryStep("delivering")).toBe("delivered");
    expect(nextDeliveryStep("delivered")).toBeNull();
    expect(nextDeliveryStep("cancelled")).toBeNull();
  });
});

describe("nextStopIndex", () => {
  it("désigne la première commande non terminée, -1 si tout est fait", () => {
    const day6 = filterOrders(scenarioOrders, { date: "2026-09-06" });
    expect(nextStopIndex(day6)).toBe(-1);
    const day7 = filterOrders(scenarioOrders, { date: "2026-09-07" });
    expect(nextStopIndex(day7)).toBe(0);
    expect(nextStopIndex([])).toBe(-1);
  });
});

describe("itineraryUrl", () => {
  it("encode code postal et ville dans une recherche Google Maps", () => {
    expect(itineraryUrl("75011", "Paris")).toBe(
      "https://www.google.com/maps/search/?api=1&query=75011%20Paris",
    );
  });
});
