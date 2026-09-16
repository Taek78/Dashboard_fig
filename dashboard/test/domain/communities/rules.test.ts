import { describe, expect, it } from "vitest";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import {
  communityMembers,
  communityOrders,
  sortCommunities,
  summarizeCommunity,
} from "@/domain/communities/rules";
import { customersFixtures } from "@/domain/customers/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";

describe("communitiesFixtures", () => {
  it("trois communautés, ids uniques, sans taux stocké, aucune personne réelle", () => {
    expect(communitiesFixtures).toHaveLength(3);
    expect(new Set(communitiesFixtures.map((c) => c.id)).size).toBe(3);
    for (const c of communitiesFixtures) {
      expect(c).not.toHaveProperty("discountPercent");
      expect(c.contactEmail).toMatch(/@example\.invalid$/);
      expect(c.contactPhone).toMatch(/^06 39 98 80 \d{2}$/);
      expect(c).not.toHaveProperty("pickupTime");
    }
  });
});

describe("sortCommunities", () => {
  it("ordre français par nom, inactives à la fin, sans muter", () => {
    const list = [
      { ...communitiesFixtures[0]!, name: "Zèbre", active: true },
      { ...communitiesFixtures[1]!, name: "Abeille", active: false },
      { ...communitiesFixtures[2]!, name: "École", active: true },
    ];
    expect(sortCommunities(list).map((c) => c.name)).toEqual([
      "École",
      "Zèbre",
      "Abeille",
    ]);
    expect(list[0]?.name).toBe("Zèbre");
  });
});

describe("communityMembers / communityOrders / summarizeCommunity", () => {
  it("retrouve les membres et les commandes d'une communauté des fixtures", () => {
    const members = communityMembers(customersFixtures, "com-0001");
    expect(members.length).toBeGreaterThan(3);
    expect(
      members.every((c) => c.community?.name === "Crèche Les Lucioles"),
    ).toBe(true);
    const orders = communityOrders(ordersFixtures, "com-0001");
    expect(orders.length).toBeGreaterThan(20);
    const memberIds = new Set(members.map((m) => m.id));
    expect(orders.every((o) => memberIds.has(o.customer.id))).toBe(true);
  });

  it("résume : commandes, total dû et remises hors annulées, dernier retrait", () => {
    const orders = communityOrders(ordersFixtures, "com-0002");
    const active = orders.filter((o) => o.status !== "cancelled");
    expect(summarizeCommunity(orders)).toEqual({
      orderCount: orders.length,
      totalCents: active.reduce((s, o) => s + o.totalCents, 0),
      discountCents: active.reduce(
        (s, o) => s + (o.discount?.amountCents ?? 0),
        0,
      ),
      lastDeliveryDate: orders
        .map((o) => o.deliverySlot.date)
        .sort()
        .at(-1),
    });
    expect(summarizeCommunity([])).toEqual({
      orderCount: 0,
      totalCents: 0,
      discountCents: 0,
      lastDeliveryDate: null,
    });
  });
});
