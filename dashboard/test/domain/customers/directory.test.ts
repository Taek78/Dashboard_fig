import { describe, expect, it } from "vitest";
import { communityDiscountPercent } from "@/domain/communities/discount";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import {
  buildDirectory,
  countDirectory,
  DEFAULT_DIRECTORY_ORDER,
  DIRECTORY_SORT_SCALES,
  DIRECTORY_SORTS,
  directorySearchQuery,
  directoryStatsFromOrders,
  filterDirectory,
  matchesDirectoryQuery,
  oppositeOrder,
  parseOrderParam,
  parseSortParam,
  SORT_ORDER_LABELS,
  sortDirectory,
  sortOptions,
  isSortAvailable,
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

  it("cherche une communauté par nom, type, visibilité, ville ou référent", () => {
    const voisins = communityEntry("com-0002");
    expect(matchesDirectoryQuery(voisins, "residence jules")).toBe(true);
    expect(matchesDirectoryQuery(voisins, "Montreuil")).toBe(true);
    expect(matchesDirectoryQuery(voisins, "voisinage")).toBe(true);
    expect(matchesDirectoryQuery(voisins, "prive")).toBe(true);
    expect(matchesDirectoryQuery(voisins, "public")).toBe(false);
    const lucioles = communityEntry("com-0001");
    expect(matchesDirectoryQuery(lucioles, "point relais")).toBe(true);
    expect(matchesDirectoryQuery(lucioles, "Public")).toBe(true);
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

  it("particuliers = toutes les personnes, membres compris ; communautés = les groupes seulement ; tous", () => {
    const individuals = filterDirectory(directory, { type: "particuliers" });
    expect(individuals.every((e) => e.kind === "customer")).toBe(true);
    expect(individuals).toHaveLength(
      directory.filter((e) => e.kind === "customer").length,
    );
    // Un membre de communauté reste un particulier.
    expect(
      individuals.some(
        (e) => e.kind === "customer" && e.customer.community !== null,
      ),
    ).toBe(true);
    const communities = filterDirectory(directory, { type: "communautes" });
    expect(communities.every((e) => e.kind === "community")).toBe(true);
    expect(communities).toHaveLength(3);
    // Même en cherchant le nom d'un groupe, ses membres n'y apparaissent pas.
    expect(
      filterDirectory(directory, { type: "communautes", query: "lucioles" }),
    ).toHaveLength(1);
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

  it("par ancienneté : la plus récente inscription d'abord, puis l'inverse", () => {
    const date = (e: DirectoryEntry) =>
      e.kind === "customer" ? e.customer.createdAt : e.community.createdAt;
    // Sens naturel du critère : du plus récent au plus ancien.
    expect(DEFAULT_DIRECTORY_ORDER.anciennete).toBe("decroissant");
    const desc = sortDirectory(directory, "anciennete");
    for (let i = 1; i < desc.length; i += 1) {
      expect(date(desc[i - 1]!) >= date(desc[i]!)).toBe(true);
    }
    const asc = sortDirectory(directory, "anciennete", "croissant");
    for (let i = 1; i < asc.length; i += 1) {
      expect(date(asc[i - 1]!) <= date(asc[i]!)).toBe(true);
    }
    // L'ordre exact des trois communautés, connues dans les fixtures.
    const groups = filterDirectory(directory, { type: "communautes" });
    expect(sortDirectory(groups, "anciennete").map((e) => e.id)).toEqual([
      "com-0003",
      "com-0002",
      "com-0001",
    ]);
    expect(
      sortDirectory(groups, "anciennete", "croissant").map((e) => e.id),
    ).toEqual(["com-0001", "com-0002", "com-0003"]);
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

  it("par membres : les communautés seules, du plus grand groupe au plus petit, et l'inverse", () => {
    const list = filterDirectory(directory, { type: "communautes" });
    const sorted = sortDirectory(list, "membres");
    expect(sorted.every((e) => e.kind === "community")).toBe(true);
    const counts = sorted.map((e) =>
      e.kind === "community" ? e.memberCount : -1,
    );
    expect(counts).toEqual(counts.toSorted((a, b) => b - a));
    // Des personnes passées malgré tout au tri restent après les groupes.
    const mixed = sortDirectory(directory, "membres");
    const firstPerson = mixed.findIndex((e) => e.kind === "customer");
    expect(firstPerson).toBe(3);
    const reversed = sortDirectory(list, "membres", "croissant")
      .filter((e) => e.kind === "community")
      .map((e) => (e.kind === "community" ? e.memberCount : -1));
    expect(reversed).toEqual(counts.toReversed());
  });
});

describe("parseSortParam / parseOrderParam / sortOptions", () => {
  it("lit le critère, l'ancienne forme critère-sens, et le sens seul", () => {
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
    expect(parseSortParam("anciennete-croissant")).toEqual({
      sort: "anciennete",
      order: "croissant",
    });
    expect(parseSortParam(undefined)).toBeUndefined();
    expect(parseSortParam("prix")).toBeUndefined();
    expect(parseSortParam("nom-aleatoire")).toBeUndefined();
    expect(parseSortParam("nom-croissant-x")).toBeUndefined();
    expect(parseOrderParam("croissant")).toBe("croissant");
    expect(parseOrderParam("decroissant")).toBe("decroissant");
    expect(parseOrderParam("haut")).toBeUndefined();
    expect(parseOrderParam(undefined)).toBeUndefined();
    expect(oppositeOrder("croissant")).toBe("decroissant");
    expect(oppositeOrder("decroissant")).toBe("croissant");
  });

  it("la liste ne propose que les critères ; membres pour les communautés seulement", () => {
    const all = sortOptions("tous");
    expect(all.map((o) => o.value)).toEqual([
      "nom",
      "commandes",
      "montant",
      "recent",
      "anciennete",
    ]);
    expect(sortOptions("communautes").map((o) => o.value)).toContain("membres");
    expect(new Set(all.map((o) => o.label)).size).toBe(all.length);
  });

  it("sans l'argent (livreur), pas de tri par montant dépensé", () => {
    expect(sortOptions("tous", false).map((o) => o.value)).not.toContain(
      "montant",
    );
    expect(isSortAvailable("montant", "tous", false)).toBe(false);
    expect(isSortAvailable("montant", "tous")).toBe(true);
    expect(isSortAvailable("nom", "tous", false)).toBe(true);
  });

  it("lettres pour le nom, chiffres pour le reste ; chaque sens a son libellé", () => {
    expect(DIRECTORY_SORT_SCALES.nom).toBe("alpha");
    for (const sort of DIRECTORY_SORTS) {
      if (sort !== "nom") expect(DIRECTORY_SORT_SCALES[sort]).toBe("numeric");
      expect(SORT_ORDER_LABELS[sort].croissant).not.toBe(
        SORT_ORDER_LABELS[sort].decroissant,
      );
    }
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
    ).toBe("type=communautes&tri=membres&sens=croissant");
    expect(
      directorySearchQuery({ type: "tous", sort: "nom", order: "decroissant" }),
    ).toBe("sens=decroissant");
    expect(
      directorySearchQuery({
        type: "tous",
        sort: "anciennete",
        order: "decroissant",
      }),
    ).toBe("tri=anciennete");
    expect(
      directorySearchQuery({
        type: "tous",
        sort: "anciennete",
        order: "croissant",
      }),
    ).toBe("tri=anciennete&sens=croissant");
  });
});
