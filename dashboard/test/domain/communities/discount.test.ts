import { describe, expect, it } from "vitest";
import {
  COMMUNITY_DISCOUNT_TIERS,
  communityDiscountPercent,
  nextCommunityDiscountTier,
} from "@/domain/communities/discount";

describe("communityDiscountPercent", () => {
  it("rien jusqu'à trois membres, −5 % de quatre à neuf, −10 % dès dix", () => {
    expect(communityDiscountPercent(0)).toBe(0);
    expect(communityDiscountPercent(3)).toBe(0);
    expect(communityDiscountPercent(4)).toBe(5);
    expect(communityDiscountPercent(9)).toBe(5);
    expect(communityDiscountPercent(10)).toBe(10);
    expect(communityDiscountPercent(250)).toBe(10);
  });

  it("les paliers sont décroissants et commencent à zéro membre", () => {
    const mins = COMMUNITY_DISCOUNT_TIERS.map((t) => t.minMembers);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins.at(-1)).toBe(0);
  });

  it("annonce le palier suivant, ou null au taux maximal", () => {
    expect(nextCommunityDiscountTier(2)).toEqual({ minMembers: 4, percent: 5 });
    expect(nextCommunityDiscountTier(4)).toEqual({
      minMembers: 10,
      percent: 10,
    });
    expect(nextCommunityDiscountTier(10)).toBeNull();
  });
});
