import { describe, expect, it } from "vitest";
import {
  FIXTURE_TODAY,
  HISTORY_FROM,
  HISTORY_TO,
  orderEventsFixtures,
  ordersFixtures,
  SCENARIO_WINDOW,
  scenarioOrders,
} from "@/domain/orders/fixtures";
import { communityDiscountPercent } from "@/domain/communities/discount";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { customersFixtures } from "@/domain/customers/fixtures";
import { LOYALTY_THRESHOLD } from "@/domain/customers/loyalty";
import { deliveryFeeCents } from "@/domain/orders/delivery-fee";
import {
  computeOrderSubtotalCents,
  computeOrderTotalCents,
} from "@/domain/orders/rules";
import { isDeliverySlot } from "@/domain/orders/slot";
import { staffFixtures } from "@/domain/staff/fixtures";
import { ORDER_STATUSES, statusPath } from "@/domain/orders/status";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = /^\d{2}:\d{2}$/;

describe("scenarioOrders", () => {
  it("contient 14 commandes autour de FIXTURE_TODAY, tous statuts couverts", () => {
    expect(scenarioOrders).toHaveLength(14);
    const dates = new Set(scenarioOrders.map((o) => o.deliverySlot.date));
    expect(dates).toEqual(new Set(["2026-09-06", FIXTURE_TODAY, "2026-09-08"]));
    for (const status of ORDER_STATUSES) {
      expect(scenarioOrders.some((o) => o.status === status)).toBe(true);
    }
  });
});

describe("ordersFixtures (scénario + historique généré)", () => {
  it("a des ids et des références uniques", () => {
    expect(new Set(ordersFixtures.map((o) => o.id)).size).toBe(
      ordersFixtures.length,
    );
    expect(new Set(ordersFixtures.map((o) => o.reference)).size).toBe(
      ordersFixtures.length,
    );
  });

  it("couvre deux ans jusqu'à HISTORY_TO en laissant la fenêtre du scénario vide", () => {
    const generated = ordersFixtures.filter((o) => o.id.startsWith("cmd-g-"));
    const dates = generated.map((o) => o.deliverySlot.date).toSorted();
    expect(dates[0]).toBe(HISTORY_FROM);
    expect(dates.at(-1)).toBe(HISTORY_TO);
    expect(
      generated.some(
        (o) =>
          o.deliverySlot.date >= SCENARIO_WINDOW.from &&
          o.deliverySlot.date <= SCENARIO_WINDOW.to,
      ),
    ).toBe(false);
    const days = new Set(dates).size;
    const perDay = generated.length / days;
    expect(perDay).toBeGreaterThan(2);
    expect(perDay).toBeLessThan(15);
    expect(generated.length).toBeGreaterThan(2000);
  });

  it("le passé est livré ou annulé (avec motif), la journée en cours est en cours", () => {
    for (const o of ordersFixtures) {
      if (!o.id.startsWith("cmd-g-")) continue;
      if (o.deliverySlot.date < HISTORY_TO) {
        expect(["delivered", "cancelled"]).toContain(o.status);
      } else {
        expect(["preparing", "delivering"]).toContain(o.status);
      }
      if (o.status === "cancelled") expect(o.cancellation).not.toBeNull();
      else expect(o.cancellation).toBeNull();
    }
    const generated = ordersFixtures.filter((o) => o.id.startsWith("cmd-g-"));
    const cancelled = generated.filter((o) => o.status === "cancelled").length;
    expect(cancelled / generated.length).toBeGreaterThan(0.02);
    expect(cancelled / generated.length).toBeLessThan(0.1);
  });

  it("chaque commande : total cohérent (remise puis frais au barème), 2 à 5 lignes, créneau d'une heure, formats ISO, aucune personne réelle", () => {
    for (const order of ordersFixtures) {
      const subtotal = computeOrderSubtotalCents(order.lines);
      expect(order.deliveryFeeCents).toBe(
        deliveryFeeCents(subtotal, order.community !== null),
      );
      expect(
        computeOrderTotalCents(
          order.lines,
          order.discount,
          order.deliveryFeeCents,
        ),
      ).toBe(order.totalCents);
      if (order.discount) {
        expect(order.discount.amountCents).toBeGreaterThan(0);
        // Une remise de communauté n'existe que pour un membre ; la fidélité
        // peut remplacer la sienne.
        if (order.discount.kind === "community") {
          expect(order.community).not.toBeNull();
        }
      }
      expect(order.lines.length).toBeGreaterThanOrEqual(2);
      expect(order.lines.length).toBeLessThanOrEqual(5);
      expect(order.createdAt).toMatch(ISO_DATETIME);
      expect(order.createdAt.slice(0, 10) <= order.deliverySlot.date).toBe(
        true,
      );
      expect(order.deliverySlot.date).toMatch(ISO_DATE);
      expect(order.deliverySlot.start).toMatch(HOUR);
      expect(order.deliverySlot.end).toMatch(HOUR);
      expect(isDeliverySlot(order.deliverySlot)).toBe(true);
      expect(order.deliveryAddressLine).toBeTruthy();
      expect(order.customer.email).toMatch(/@example\.invalid$/);
      expect(order.customer.phone).toMatch(/^06 39 98 \d{2} \d{2}$/);
      expect(order.deliveryPostalCode).toMatch(/^\d{5}$/);
    }
    // Un particulier paie des frais, jamais une communauté ; les quatre paliers existent.
    const fees = new Set(
      ordersFixtures.filter((o) => !o.community).map((o) => o.deliveryFeeCents),
    );
    expect(fees).toEqual(new Set([190, 290, 390, 490]));
    expect(
      ordersFixtures
        .filter((o) => o.community)
        .every((o) => o.deliveryFeeCents === 0),
    ).toBe(true);
  });

  it("la rue de livraison d'un particulier est celle de sa fiche", () => {
    const byId = new Map(customersFixtures.map((c) => [c.id, c]));
    for (const order of ordersFixtures.filter((o) => !o.community)) {
      expect(order.deliveryAddressLine).toBe(
        byId.get(order.customer.id)?.addressLine,
      );
    }
  });

  it("affecte l'équipe de façon vraisemblable : préparateur dès la préparation, livreur dès la livraison", () => {
    const generated = ordersFixtures.filter((o) => o.id.startsWith("cmd-g-"));
    const prepared = generated.filter((o) =>
      ["preparing", "delivering", "delivered"].includes(o.status),
    );
    const driven = generated.filter((o) =>
      ["delivering", "delivered"].includes(o.status),
    );
    expect(prepared.filter((o) => o.preparer).length / prepared.length).toBe(1);
    expect(driven.filter((o) => o.driver).length / driven.length).toBe(1);
    for (const o of generated) {
      if (o.status === "preparing") {
        expect(o.driver).toBeNull();
      }
      if (o.preparer) {
        const member = staffFixtures.find((m) => m.id === o.preparer?.id);
        expect(member?.kind).toBe("preparateur");
        expect(member!.startedAt <= o.deliverySlot.date).toBe(true);
      }
      if (o.driver) {
        expect(staffFixtures.find((m) => m.id === o.driver?.id)?.kind).toBe(
          "livreur",
        );
      }
    }
  });

  it("les membres d'une communauté sont livrés au point de retrait, sans frais, avec la remise que donne le nombre de membres", () => {
    const withCommunity = ordersFixtures.filter((o) => o.community);
    expect(withCommunity.length).toBeGreaterThan(100);
    for (const o of withCommunity) {
      const community = communitiesFixtures.find(
        (c) => c.id === o.community?.id,
      )!;
      const members = customersFixtures.filter(
        (c) => c.community?.id === community.id,
      ).length;
      const percent = communityDiscountPercent(members);
      expect(o.deliveryCity).toBe(community.pickupCity);
      expect(o.deliveryAddressLine).toBe(community.pickupPlace);
      expect(o.deliveryFeeCents).toBe(0);
      if (o.discount?.kind === "community") {
        expect(o.discount.percent).toBe(percent);
      } else if (o.discount === null) {
        expect(percent).toBe(0);
      } else {
        expect(o.discount.kind).toBe("loyalty");
      }
    }
    // Les trois paliers : une communauté sans remise, une à −5 %, une à −10 %.
    const percents = new Set(
      withCommunity.map((o) =>
        o.discount?.kind === "community" ? o.discount.percent : 0,
      ),
    );
    expect(percents).toEqual(new Set([0, 5, 10]));
  });

  it("la remise fidélité arrive exactement après huit commandes cumulées, annulées non comptées, membres compris", () => {
    const byCustomer = new Map<string, typeof ordersFixtures>();
    for (const o of ordersFixtures) {
      if (!o.customer.id.startsWith("cli-g-")) continue;
      byCustomer.set(o.customer.id, [
        ...(byCustomer.get(o.customer.id) ?? []),
        o,
      ]);
    }
    let rewarded = 0;
    let rewardedMembers = 0;
    for (const orders of byCustomer.values()) {
      let count = 0;
      for (const o of orders.toSorted(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )) {
        if (o.status === "cancelled") {
          expect(o.discount?.kind).not.toBe("loyalty");
          continue;
        }
        expect(o.discount?.kind === "loyalty").toBe(count >= LOYALTY_THRESHOLD);
        if (o.discount?.kind === "loyalty") {
          rewarded += 1;
          if (o.community) rewardedMembers += 1;
          count = 0;
        } else {
          count += 1;
        }
      }
    }
    expect(rewarded).toBeGreaterThan(10);
    expect(rewardedMembers).toBeGreaterThan(0);
  });

  it("garde un client cohérent d'une commande à l'autre", () => {
    const byId = new Map<string, string>();
    for (const { customer } of ordersFixtures) {
      const seen = byId.get(customer.id);
      if (seen !== undefined) expect(seen).toBe(customer.email);
      byId.set(customer.id, customer.email);
    }
  });

  it("est déterministe : deux imports donnent le même jeu", async () => {
    const again = await import("@/domain/orders/fixtures");
    expect(again.ordersFixtures.length).toBe(ordersFixtures.length);
    expect(again.ordersFixtures[500]?.reference).toBe(
      ordersFixtures[500]?.reference,
    );
  });
});

describe("orderEventsFixtures", () => {
  it("retrace pour chaque commande le chemin jusqu'à son statut actuel", () => {
    const byOrder = new Map<string, typeof orderEventsFixtures>();
    for (const e of orderEventsFixtures) {
      const list = byOrder.get(e.orderId) ?? [];
      byOrder.set(e.orderId, [...list, e]);
    }
    for (const order of ordersFixtures) {
      const mine = byOrder.get(order.id) ?? [];
      const path = statusPath(order.status);
      expect(mine.map((e) => e.to)).toEqual(path.slice(1));
      expect(mine.map((e) => e.from)).toEqual(path.slice(0, -1));
      for (const e of mine) {
        expect(e.at > order.createdAt).toBe(true);
        expect(e.at).toMatch(ISO_DATETIME);
        if (e.to === "cancelled") expect(e.cancellation).not.toBeNull();
      }
    }
    expect(new Set(orderEventsFixtures.map((e) => e.id)).size).toBe(
      orderEventsFixtures.length,
    );
  });
});
