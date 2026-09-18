import { describe, expect, it } from "vitest";
import {
  CANCELLATION_DETAIL_MAX_LENGTH,
  CANCELLATION_REASON_LABELS,
  CANCELLATION_REASONS,
  formatCancellation,
} from "@/domain/orders/cancellation";

describe("motifs d'annulation", () => {
  it("expose quatre motifs libellés et une limite de 100 caractères", () => {
    expect(CANCELLATION_REASONS).toEqual([
      "stock",
      "delivery",
      "customer",
      "other",
    ]);
    for (const r of CANCELLATION_REASONS) {
      expect(CANCELLATION_REASON_LABELS[r].length).toBeGreaterThan(0);
    }
    expect(CANCELLATION_DETAIL_MAX_LENGTH).toBe(100);
  });

  it("formatCancellation ajoute la précision quand elle existe", () => {
    expect(formatCancellation({ reason: "stock", detail: null })).toBe(
      "Stock insuffisant",
    );
    expect(
      formatCancellation({ reason: "other", detail: "Client absent" }),
    ).toBe("Autre : Client absent");
  });
});
