import { describe, expect, it } from "vitest";
import {
  articleResponse,
  catalogResponse,
  communityResponse,
  customerResponse,
  messageResponse,
  notificationResponse,
  orderResponse,
  pendingNotificationResponse,
  quoteResponse,
  sessionResponse,
} from "@/domain/api/responses";
import {
  articleView,
  catalogView,
  communityView,
  customerView,
  messageView,
  notificationView,
  orderView,
  pageView,
  pendingNotificationView,
  quoteView,
  sessionView,
} from "@/domain/api/views";
import { articlesFixtures } from "@/domain/articles/fixtures";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { customersFixtures } from "@/domain/customers/fixtures";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";
import { buildQuote } from "@/domain/orders/quote";
import { productsFixtures } from "@/domain/products/fixtures";

/*
 * Chaque vue respecte le schéma de réponse qui la documente (responses.ts) :
 * ce que l'OpenAPI promet est ce que l'API renvoie. Et ce qui doit rester
 * caché l'est : équipe affectée, notes, coordonnées des référents, marques
 * internes des messages.
 */
const NOW = "2026-09-17T12:00:00.000Z";
const settings = { sellWhenOutOfStock: false };

describe("vues des clients", () => {
  it("customerView respecte le schéma et calcule fidélité, catégorie et prochaine remise", () => {
    const amel = customersFixtures.find((c) => c.id === "cli-0001")!;
    const view = customerView(amel, {
      loyaltyCount: 8,
      loyalSince: "2026-09-01T10:00:00.000Z",
      memberCount: 0,
      referralCount: 2,
      now: NOW,
    });
    expect(() => customerResponse.parse(view)).not.toThrow();
    expect(view).toMatchObject({
      id: amel.id,
      email: amel.email,
      community: null,
      referralCount: 2,
      loyalty: { count: 8, rewardReady: true, remaining: 0, threshold: 8 },
      tier: { tier: "loyal", label: "Fidèle" },
      nextDiscount: { kind: "loyalty", percent: 15, label: "Remise fidélité" },
    });
    expect("notes" in view).toBe(false);

    const member = customersFixtures.find((c) => c.community !== null)!;
    const memberView = customerView(member, {
      loyaltyCount: 2,
      loyalSince: null,
      memberCount: 11,
      referralCount: 0,
      now: NOW,
    });
    expect(memberView.community?.discountPercent).toBe(10);
    expect(memberView.nextDiscount).toEqual({
      kind: "community",
      label: "Remise communauté",
      percent: 10,
    });
    expect(memberView.tier.tier).toBe("basic");
    expect(() =>
      sessionResponse.parse(
        sessionView("jeton", { expiresAt: NOW }, memberView, true),
      ),
    ).not.toThrow();
  });
});

describe("vues du catalogue et des contenus", () => {
  it("catalogView ne liste que les produits visibles, avec statut de vente et barèmes", () => {
    const catalog = catalogView(productsFixtures, settings, NOW);
    expect(() => catalogResponse.parse(catalog)).not.toThrow();
    expect(
      catalog.products.every(
        (p) => productsFixtures.find((f) => f.id === p.id)!.visible,
      ),
    ).toBe(true);
    expect(catalog.products.length).toBe(
      productsFixtures.filter((p) => p.visible).length,
    );
    expect(catalog.deliveryFeeTiers[0]).toEqual({
      minSubtotalCents: 2000,
      feeCents: 190,
    });
    expect(catalog.deliverySlotStarts[0]).toBe("10:00");
    expect(catalog.deliverySlotStarts.at(-1)).toBe("19:00");
    expect(catalog.loyalty).toEqual({ threshold: 8, discountPercent: 15 });
    const outOfStock = productsFixtures.find(
      (p) => p.visible && p.available && p.stockQuantity === 0,
    );
    if (outOfStock) {
      expect(
        catalog.products.find((p) => p.id === outOfStock.id)?.saleStatus,
      ).toBe("rupture");
    }
  });

  it("articleView et communityView respectent leur schéma ; la communauté cache ses référents", () => {
    for (const article of articlesFixtures) {
      expect(() => articleResponse.parse(articleView(article))).not.toThrow();
    }
    const view = communityView(communitiesFixtures[0]!, 11);
    expect(() => communityResponse.parse(view)).not.toThrow();
    expect(view).toMatchObject({
      memberCount: 11,
      discountPercent: 10,
      kindLabel: "Point relais",
    });
    expect(JSON.stringify(view)).not.toContain(
      communitiesFixtures[0]!.contactEmail,
    );
    expect(JSON.stringify(view)).not.toContain(
      communitiesFixtures[0]!.contactPhone,
    );
  });
});

describe("vues des commandes, messages et notifications", () => {
  it("orderView respecte le schéma, calcule le sous-total et cache l'équipe", () => {
    for (const order of ordersFixtures.slice(0, 40)) {
      const view = orderView(order);
      expect(() => orderResponse.parse(view)).not.toThrow();
      expect(view.subtotalCents).toBe(
        order.lines.reduce((s, l) => s + l.lineTotalCents, 0),
      );
      expect(view.cancellable).toBe(order.status === "preparing");
      expect("preparer" in view).toBe(false);
      expect("driver" in view).toBe(false);
      expect("customer" in view).toBe(false);
    }
    const cancelled = ordersFixtures.find((o) => o.cancellation !== null)!;
    expect(orderView(cancelled).cancellation?.label.length).toBeGreaterThan(0);
  });

  it("quoteView respecte le schéma", () => {
    const result = buildQuote([{ productId: "prd-0001", quantity: 1000 }], {
      products: productsFixtures,
      settings,
      loyaltyReady: false,
      community: null,
      communityPercent: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(() => quoteResponse.parse(quoteView(result.quote))).not.toThrow();
  });

  it("messageView cache l'épingle, l'importance et le traitant", () => {
    for (const message of messagesFixtures) {
      const view = messageView(message);
      expect(() => messageResponse.parse(view)).not.toThrow();
      expect("pinnedAt" in view).toBe(false);
      expect("important" in view).toBe(false);
      expect("handledByName" in view).toBe(false);
      expect(view.orderReference).toBe(message.order?.reference ?? null);
    }
  });

  it("notificationView et pendingNotificationView respectent leur schéma ; pageView encode le curseur", () => {
    for (const notification of notificationsFixtures) {
      expect(() =>
        notificationResponse.parse(notificationView(notification)),
      ).not.toThrow();
      expect(() =>
        pendingNotificationResponse.parse(
          pendingNotificationView(notification),
        ),
      ).not.toThrow();
    }
    const page = pageView(
      { items: notificationsFixtures.slice(0, 2), next: { at: NOW, id: "x" } },
      notificationView,
    );
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(
      pageView({ items: [], next: null }, notificationView).nextCursor,
    ).toBeNull();
  });
});
