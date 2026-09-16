import { describe, expect, it } from "vitest";
import { communityDiscountPercent } from "@/domain/communities/discount";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import {
  buildDirectory,
  countDirectory,
  DEFAULT_DIRECTORY_ORDER,
  DIRECTORY_SORTS,
  directorySearchQuery,
  directoryStatsFromOrders,
  filterDirectory,
  matchesDirectoryQuery,
  parseSortParam,
  sortDirectory,
  sortOptions,
  sortParam,
  type DirectoryEntry,
} from "@/domain/customers/directory";
import { customersFixtures } from "@/domain/customers/fixtures";
import { loyaltyStatus } from "@/domain/customers/loyalty";
import { customerTier } from "@/domain/customers/tier";
import { ordersFixtures } from "@/domain/orders/fixtures";

/** Instant de lecture figé : le jour du scénario, à midi. */
const AT = "2026-09-07T12:00:00.000Z";

const directory = buildDirectory(
  customersFixtures,
  communitiesFixtures,
  directoryStatsFromOrders(ordersFixtures, customersFixtures),
  AT,
);

function customerEntry(id: string) {
  const entry = directory.find((e) => e.kind === "customer" && e.id === id);
  if (entry?.kind !== "customer") throw new Error(`client ${id} absent`);
  return entry;
}
function communityEntry(id: string) {
  const entry = directory.find((e) => e.kind === "community" && e.id === id);
  if (entry?.kind !== "community") throw new Error(`communauté ${id} absente`);
  return entry;
}
const orders = (e: DirectoryEntry) =>
  e.kind === "customer" ? e.stats.orderCount : e.summary.orderCount;
const own = (id: string) => ordersFixtures.filter((o) => o.customer.id === id);

describe("buildDirectory", () => {
  it("une entrée par communauté et par client, chiffres tirés de leurs commandes", () => {
    expect(countDirectory(directory)).toEqual({
      communities: communitiesFixtures.length,
      customers: customersFixtures.length,
    });
    const amel = customerEntry("cli-0001");
    expect(amel.stats.orderCount).toBe(own("cli-0001").length);
    expect(amel.loyalty).toEqual(loyaltyStatus(own("cli-0001")));
    expect(amel.tier).toEqual(customerTier(own("cli-0001"), AT));
    expect(amel.communityDiscountPercent).toBeNull();
    const noOrders = buildDirectory(
      customersFixtures.slice(0, 1),
      [],
      directoryStatsFromOrders([]),
      AT,
    )[0];
    expect(noOrders?.kind === "customer" && noOrders.stats).toEqual({
      orderCount: 0,
      totalSpentCents: 0,
      lastDeliveryDate: null,
    });
    expect(noOrders?.kind === "customer" && noOrders.tier.tier).toBe("basic");
  });

  it("une communauté porte ses membres et le taux que leur nombre donne", () => {
    const creche = communityEntry("com-0001");
    const members = customersFixtures.filter(
      (c) => c.community?.id === "com-0001",
    ).length;
    expect(creche.memberCount).toBe(members);
    expect(creche.discountPercent).toBe(communityDiscountPercent(members));
    expect(creche.summary.orderCount).toBe(
      ordersFixtures.filter((o) => o.community?.id === "com-0001").length,
    );
    // Les trois paliers sont représentés dans les fixtures.
    expect(
      new Set(
        communitiesFixtures.map((c) => communityEntry(c.id).discountPercent),
      ),
    ).toEqual(new Set([0, 5, 10]));
  });

  it("un membre a un compteur fidélité, le taux de sa communauté et la meilleure remise à venir", () => {
    const member = directory.find(
      (e) => e.kind === "customer" && e.customer.community !== null,
    );
    if (member?.kind !== "customer") throw new Error("aucun membre");
    expect(member.loyalty).toEqual(loyaltyStatus(own(member.id)));
    expect(member.communityDiscountPercent).toBe(
      communityEntry(member.customer.community!.id).discountPercent,
    );
    if (member.loyalty.rewardReady) {
      expect(member.nextDiscount).toEqual({ kind: "loyalty", percent: 15 });
    } else if (member.communityDiscountPercent) {
      expect(member.nextDiscount).toEqual({
        kind: "community",
        percent: member.communityDiscountPercent,
      });
    } else {
      expect(member.nextDiscount).toBeNull();
    }
  });

  it("certains clients des fixtures sont fidèles au jour du scénario, d'autres basiques", () => {
    const tiers = directory
      .filter((e) => e.kind === "customer")
      .map((e) => (e.kind === "customer" ? e.tier.tier : "basic"));
    expect(tiers).toContain("loyal");
    expect(tiers).toContain("basic");
  });
});

describe("matchesDirectoryQuery / filterDirectory", () => {
  it("cherche un client par nom sans accents, e-mail, ville, téléphone ou code de parrainage", () => {
    const amel = customerEntry("cli-0001");
    expect(matchesDirectoryQuery(amel, "BENALI")).toBe(true);
    expect(matchesDirectoryQuery(amel, "amel.benali@")).toBe(true);
    expect(matchesDirectoryQuery(amel, "00 01")).toBe(true);
    expect(matchesDirectoryQuery(amel, "benali#0001")).toBe(true);
    expect(matchesDirectoryQuery(amel, "lucioles")).toBe(false);
    expect(matchesDirectoryQuery(amel, "   ")).toBe(true);
  });

  it("cherche une communauté par nom, type, ville ou référent", () => {
    const ecole = communityEntry("com-0002");
    expect(matchesDirectoryQuery(ecole, "ecole jules")).toBe(true);
    expect(matchesDirectoryQuery(ecole, "Montreuil")).toBe(true);
    expect(matchesDirectoryQuery(communityEntry("com-0001"), "crèche")).toBe(
      true,
    );
  });

  it("le nom d'une communauté retrouve le groupe et ses membres", () => {
    const found = filterDirectory(directory, {
      query: "lucioles",
      type: "tous",
    });
    expect(found.some((e) => e.kind === "community")).toBe(true);
    expect(
      found.every(
        (e) =>
          e.kind === "community" || e.customer.community?.id === "com-0001",
      ),
    ).toBe(true);
    expect(found.length).toBe(1 + communityEntry("com-0001").memberCount);
  });

  it("particuliers sans communauté ; communautés avec leurs membres ; tous", () => {
    const individuals = filterDirectory(directory, { type: "particuliers" });
    expect(
      individuals.every(
        (e) => e.kind === "customer" && e.customer.community === null,
      ),
    ).toBe(true);
    const communities = filterDirectory(directory, { type: "communautes" });
    expect(
      communities.every(
        (e) => e.kind === "community" || e.customer.community !== null,
      ),
    ).toBe(true);
    expect(individuals.length + communities.length).toBe(directory.length);
    expect(filterDirectory(directory, { type: "tous" })).toHaveLength(
      directory.length,
    );
  });
});

describe("sortDirectory", () => {
  const amount = (e: DirectoryEntry) =>
    e.kind === "customer" ? e.stats.totalSpentCents : e.summary.totalCents;
  const last = (e: DirectoryEntry) =>
    (e.kind === "customer"
      ? e.stats.lastDeliveryDate
      : e.summary.lastDeliveryDate) ?? "";

  it("trie par nom, commandes, montant ou récence dans le sens naturel, sans muter", () => {
    const before = directory.map((e) => e.id);
    const byName = sortDirectory(directory, "nom");
    for (let i = 1; i < byName.length; i += 1) {
      expect(
        byName[i - 1]!.name.localeCompare(byName[i]!.name, "fr"),
      ).toBeLessThanOrEqual(0);
    }
    const byOrders = sortDirectory(directory, "commandes");
    for (let i = 1; i < byOrders.length; i += 1) {
      expect(orders(byOrders[i - 1]!)).toBeGreaterThanOrEqual(
        orders(byOrders[i]!),
      );
    }
    const byAmount = sortDirectory(directory, "montant");
    for (let i = 1; i < byAmount.length; i += 1) {
      expect(amount(byAmount[i - 1]!)).toBeGreaterThanOrEqual(
        amount(byAmount[i]!),
      );
    }
    const byRecent = sortDirectory(directory, "recent");
    for (let i = 1; i < byRecent.length; i += 1) {
      expect(last(byRecent[i - 1]!) >= last(byRecent[i]!)).toBe(true);
    }
    expect(directory.map((e) => e.id)).toEqual(before);
  });

  it("chaque tri s'inverse, les ex æquo restant par nom croissant", () => {
    const desc = sortDirectory(directory, "nom", "decroissant");
    for (let i = 1; i < desc.length; i += 1) {
      expect(
        desc[i - 1]!.name.localeCompare(desc[i]!.name, "fr"),
      ).toBeGreaterThanOrEqual(0);
    }
    const asc = sortDirectory(directory, "commandes", "croissant");
    for (let i = 1; i < asc.length; i += 1) {
      const a = asc[i - 1]!;
      const b = asc[i]!;
      expect(orders(a)).toBeLessThanOrEqual(orders(b));
      if (orders(a) === orders(b)) {
        expect(a.name.localeCompare(b.name, "fr")).toBeLessThanOrEqual(0);
      }
    }
  });

  it("par membres : les communautés d'abord, du plus grand groupe, puis leurs membres par nom", () => {
    const list = filterDirectory(directory, { type: "communautes" });
    const sorted = sortDirectory(list, "membres");
    const groups = sorted.filter((e) => e.kind === "community");
    expect(sorted.slice(0, groups.length)).toEqual(groups);
    const counts = groups.map((e) =>
      e.kind === "community" ? e.memberCount : -1,
    );
    expect(counts).toEqual(counts.toSorted((a, b) => b - a));
    const members = sorted.slice(groups.length);
    for (let i = 1; i < members.length; i += 1) {
      expect(
        members[i - 1]!.name.localeCompare(members[i]!.name, "fr"),
      ).toBeLessThanOrEqual(0);
    }
    const reversed = sortDirectory(list, "membres", "croissant")
      .filter((e) => e.kind === "community")
      .map((e) => (e.kind === "community" ? e.memberCount : -1));
    expect(reversed).toEqual(counts.toReversed());
  });
});

describe("sortParam / parseSortParam / sortOptions", () => {
  it("le sens naturel s'omet dans l'URL, l'autre s'écrit", () => {
    expect(sortParam("nom", "croissant")).toBe("nom");
    expect(sortParam("nom", "decroissant")).toBe("nom-decroissant");
    expect(sortParam("commandes", "decroissant")).toBe("commandes");
    expect(sortParam("commandes", "croissant")).toBe("commandes-croissant");
    for (const sort of DIRECTORY_SORTS) {
      expect(parseSortParam(sort)).toEqual({
        sort,
        order: DEFAULT_DIRECTORY_ORDER[sort],
      });
    }
    expect(parseSortParam("montant-croissant")).toEqual({
      sort: "montant",
      order: "croissant",
    });
    expect(parseSortParam(undefined)).toBeUndefined();
    expect(parseSortParam("prix")).toBeUndefined();
    expect(parseSortParam("nom-aleatoire")).toBeUndefined();
    expect(parseSortParam("nom-croissant-x")).toBeUndefined();
  });

  it("propose chaque tri dans les deux sens, naturel en premier ; membres pour les communautés seulement", () => {
    const all = sortOptions("tous");
    expect(all.map((o) => o.value)).toEqual([
      "nom-croissant",
      "nom-decroissant",
      "commandes-decroissant",
      "commandes-croissant",
      "montant-decroissant",
      "montant-croissant",
      "recent-decroissant",
      "recent-croissant",
    ]);
    expect(sortOptions("communautes").map((o) => o.value)).toContain(
      "membres-decroissant",
    );
    expect(new Set(all.map((o) => o.label)).size).toBe(all.length);
  });
});

describe("directorySearchQuery", () => {
  it("n'écrit que ce qui diffère des valeurs par défaut", () => {
    expect(
      directorySearchQuery({ type: "tous", sort: "nom", order: "croissant" }),
    ).toBe("");
    expect(
      directorySearchQuery({
        query: "amel benali",
        type: "communautes",
        sort: "recent",
        order: "decroissant",
      }),
    ).toBe("q=amel+benali&type=communautes&tri=recent");
    expect(
      directorySearchQuery({
        type: "communautes",
        sort: "membres",
        order: "croissant",
      }),
    ).toBe("type=communautes&tri=membres-croissant");
  });
});
