import { describe, expect, it } from "vitest";
import {
  deliveryDates,
  summarizeTour,
  todayInParis,
} from "@/domain/deliveries/rules";
import { ordersFixtures } from "@/domain/orders/fixtures";
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
    expect(deliveryDates(ordersFixtures)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ]);
  });
});

describe("summarizeTour", () => {
  it("compte à confirmer, en cours et terminées sur la tournée du 7", () => {
    const day = filterOrders(ordersFixtures, { date: "2026-09-07" });
    // cmd-0001 pending ; 0002 confirmed, 0003 preparing, 0004 et 0014 delivering
    expect(summarizeTour(day)).toEqual({
      total: 5,
      toConfirm: 1,
      inProgress: 4,
      done: 0,
    });
  });

  it("compte les livrées et annulées comme terminées", () => {
    const day = filterOrders(ordersFixtures, { date: "2026-09-06" });
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
