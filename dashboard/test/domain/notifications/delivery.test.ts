import { describe, expect, it } from "vitest";
import { deliveryState, shownDelivery } from "@/domain/notifications/delivery";
import { DELIVERY_TIMEOUT_MS } from "@/domain/notifications/types";

describe("deliveryState", () => {
  it("envoyée l'emporte, puis l'échec, sinon en attente", () => {
    expect(deliveryState({ sentAt: null, failedAt: null })).toBe("pending");
    expect(
      deliveryState({ sentAt: "2026-09-18T10:00:00Z", failedAt: null }),
    ).toBe("sent");
    expect(
      deliveryState({ sentAt: null, failedAt: "2026-09-18T10:00:00Z" }),
    ).toBe("failed");
  });
});

describe("shownDelivery (délai d'accusé à l'écran)", () => {
  it("en attente au-delà du délai : échec affiché ; envoyée ou en échec : inchangé", () => {
    expect(shownDelivery("pending", 0)).toBe("pending");
    expect(shownDelivery("pending", DELIVERY_TIMEOUT_MS - 1)).toBe("pending");
    expect(shownDelivery("pending", DELIVERY_TIMEOUT_MS)).toBe("failed");
    expect(shownDelivery("sent", DELIVERY_TIMEOUT_MS * 2)).toBe("sent");
    expect(shownDelivery("failed", 0)).toBe("failed");
  });
});
