import { describe, expect, it } from "vitest";
import {
  RETENTION,
  isCustomerInactive,
  retentionCutoffs,
} from "@/domain/privacy/retention";

describe("retentionCutoffs", () => {
  it("recule de 3 ans, 12 mois et 24 heures par défaut", () => {
    const now = new Date("2026-09-15T10:30:00.000Z");
    expect(RETENTION).toEqual({
      inactiveCustomerYears: 3,
      securityEventMonths: 12,
      loginAttemptHours: 24,
      customerLoginCodeHours: 24,
      customerSessionDays: 30,
    });
    expect(retentionCutoffs(now)).toEqual({
      customerActivitySince: "2023-09-15",
      securityEventsBefore: new Date("2025-09-15T10:30:00.000Z"),
      loginAttemptsBefore: new Date("2026-09-14T10:30:00.000Z"),
      customerLoginCodesBefore: new Date("2026-09-14T10:30:00.000Z"),
      customerSessionsBefore: new Date("2026-08-16T10:30:00.000Z"),
      idempotencyKeysBefore: now,
    });
  });

  it("accepte d'autres durées et ne modifie pas la date reçue", () => {
    const now = new Date("2026-03-31T00:00:00.000Z");
    const cutoffs = retentionCutoffs(now, {
      inactiveCustomerYears: 1,
      securityEventMonths: 1,
      loginAttemptHours: 1,
      customerLoginCodeHours: 1,
      customerSessionDays: 1,
    });
    expect(cutoffs.customerActivitySince).toBe("2025-03-31");
    expect(cutoffs.securityEventsBefore.toISOString().slice(0, 10)).toBe(
      "2026-03-03",
    );
    expect(cutoffs.loginAttemptsBefore).toEqual(
      new Date("2026-03-30T23:00:00.000Z"),
    );
    expect(now.toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });
});

describe("isCustomerInactive", () => {
  const since = "2023-09-15";

  it("inactif : créé et dernière livraison avant la borne", () => {
    expect(
      isCustomerInactive(
        {
          createdAt: "2021-01-10T09:00:00.000Z",
          lastDeliveryDate: "2023-09-14",
        },
        since,
      ),
    ).toBe(true);
    expect(
      isCustomerInactive(
        { createdAt: "2022-05-01T09:00:00.000Z", lastDeliveryDate: null },
        since,
      ),
    ).toBe(true);
  });

  it("actif : une livraison le jour de la borne ou après, même future", () => {
    expect(
      isCustomerInactive(
        { createdAt: "2021-01-10T09:00:00.000Z", lastDeliveryDate: since },
        since,
      ),
    ).toBe(false);
    expect(
      isCustomerInactive(
        {
          createdAt: "2021-01-10T09:00:00.000Z",
          lastDeliveryDate: "2027-01-01",
        },
        since,
      ),
    ).toBe(false);
  });

  it("jamais inactif avec une commande en préparation ou expédiée", () => {
    expect(
      isCustomerInactive(
        {
          createdAt: "2021-01-10T09:00:00.000Z",
          lastDeliveryDate: "2022-01-01",
          hasOpenOrders: true,
        },
        since,
      ),
    ).toBe(false);
  });

  it("actif : compte créé depuis la borne, même sans commande", () => {
    expect(
      isCustomerInactive(
        { createdAt: "2023-09-15T00:00:00.000Z", lastDeliveryDate: null },
        since,
      ),
    ).toBe(false);
  });
});
