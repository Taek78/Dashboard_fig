import { describe, expect, it } from "vitest";
import {
  LOYALTY_THRESHOLD,
  loyaltyFromStreak,
  loyaltyStatus,
  loyaltyStreak,
} from "@/domain/customers/loyalty";
import { ordersFixtures } from "@/domain/orders/fixtures";

/* Série brute (ce que la base compte) et état de fidélité qui en découle. */
describe("loyaltyStreak / loyaltyFromStreak", () => {
  it("l'état tiré de la série brute est celui de loyaltyStatus, pour chaque client des fixtures", () => {
    const ids = new Set(ordersFixtures.map((o) => o.customer.id));
    for (const id of ids) {
      const mine = ordersFixtures.filter((o) => o.customer.id === id);
      expect(loyaltyFromStreak(loyaltyStreak(mine))).toEqual(
        loyaltyStatus(mine),
      );
    }
  });

  it("plafonne la série au seuil et annonce la remise", () => {
    expect(loyaltyFromStreak(0)).toEqual({
      streak: 0,
      rewardReady: false,
      remaining: LOYALTY_THRESHOLD,
    });
    expect(loyaltyFromStreak(LOYALTY_THRESHOLD + 3)).toEqual({
      streak: LOYALTY_THRESHOLD,
      rewardReady: true,
      remaining: 0,
    });
  });
});
