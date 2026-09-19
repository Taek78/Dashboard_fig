import { describe, expect, it } from "vitest";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  acceptsRefund,
  isRefundAmountValid,
  REFUND_KIND_LABELS,
  REFUND_KINDS,
  refundScopeLabel,
  refundShareFrom,
  refundTotals,
  sharePercent,
} from "@/domain/orders/refund";
import { refundInputSchema } from "@/domain/orders/schemas";

describe("remboursement et avoir : règles", () => {
  it("deux types distincts, libellés français", () => {
    expect(REFUND_KINDS).toEqual(["refund", "credit"]);
    expect(REFUND_KIND_LABELS).toEqual({
      refund: "Remboursement",
      credit: "Avoir",
    });
  });

  it("seule une commande annulée qui a coûté quelque chose l'accepte", () => {
    expect(acceptsRefund({ status: "cancelled", totalCents: 1290 })).toBe(true);
    expect(acceptsRefund({ status: "cancelled", totalCents: 0 })).toBe(false);
    for (const status of ["preparing", "delivering", "delivered"]) {
      expect(acceptsRefund({ status, totalCents: 1290 })).toBe(false);
    }
  });

  it("montant entier, > 0 et ≤ total ; total ou partiel", () => {
    expect(isRefundAmountValid(1290, 1290)).toBe(true);
    expect(isRefundAmountValid(1, 1290)).toBe(true);
    expect(isRefundAmountValid(1291, 1290)).toBe(false);
    expect(isRefundAmountValid(0, 1290)).toBe(false);
    expect(isRefundAmountValid(12.5, 1290)).toBe(false);
    expect(refundScopeLabel({ kind: "refund", amountCents: 1290 }, 1290)).toBe(
      "Remboursement total",
    );
    expect(refundScopeLabel({ kind: "credit", amountCents: 500 }, 1290)).toBe(
      "Avoir partiel",
    );
  });

  it("parts en % à une décimale sur TOUTES les commandes ; null sans commande", () => {
    expect(sharePercent(3, 40)).toBe(7.5);
    expect(sharePercent(1, 3)).toBe(33.3);
    expect(sharePercent(0, 0)).toBeNull();
    const totals = refundTotals([
      { refund: { kind: "refund", amountCents: 1000 } },
      { refund: { kind: "refund", amountCents: 250 } },
      { refund: { kind: "credit", amountCents: 700 } },
      { refund: null },
    ]);
    expect(totals).toEqual({
      refund: { count: 2, amountCents: 1250 },
      credit: { count: 1, amountCents: 700 },
    });
    expect(refundShareFrom(totals, 8)).toEqual({
      refund: { count: 2, amountCents: 1250, percent: 25 },
      credit: { count: 1, amountCents: 700, percent: 12.5 },
    });
  });

  it("jeu de données : remboursements et avoirs sur des annulées seulement, jamais au-dessus du total", () => {
    const refunded = ordersFixtures.filter((o) => o.refund !== null);
    expect(refunded.some((o) => o.refund?.kind === "refund")).toBe(true);
    expect(refunded.some((o) => o.refund?.kind === "credit")).toBe(true);
    for (const o of refunded) {
      expect(o.status).toBe("cancelled");
      expect(isRefundAmountValid(o.refund!.amountCents, o.totalCents)).toBe(
        true,
      );
    }
  });
});

describe("refundInputSchema", () => {
  it("enregistrer : type et montant en euros → centimes", () => {
    expect(
      refundInputSchema.parse({
        orderId: "cmd-1",
        intent: "enregistrer",
        kind: "credit",
        amount: " 12,50 € ",
      }),
    ).toEqual({
      orderId: "cmd-1",
      refund: { kind: "credit", amountCents: 1250 },
    });
  });

  it("retirer : ni type ni montant", () => {
    expect(
      refundInputSchema.parse({ orderId: "cmd-1", intent: "retirer" }),
    ).toEqual({ orderId: "cmd-1", refund: null });
  });

  it("refuse un type absent ou inconnu, un montant nul, négatif ou illisible", () => {
    const base = { orderId: "cmd-1", intent: "enregistrer" };
    expect(refundInputSchema.safeParse({ ...base, amount: "5" }).success).toBe(
      false,
    );
    expect(
      refundInputSchema.safeParse({ ...base, kind: "cash", amount: "5" })
        .success,
    ).toBe(false);
    for (const amount of ["0", "-3", "douze", "1,999", ""]) {
      expect(
        refundInputSchema.safeParse({ ...base, kind: "refund", amount })
          .success,
      ).toBe(false);
    }
  });
});
