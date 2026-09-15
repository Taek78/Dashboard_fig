import { describe, expect, it } from "vitest";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import {
  buildDirectory,
  countDirectory,
  directorySearchQuery,
  directoryStatsFromOrders,
  filterDirectory,
  matchesDirectoryQuery,
  sortDirectory,
  type DirectoryEntry,
} from "@/domain/customers/directory";
import { customersFixtures } from "@/domain/customers/fixtures";
import { loyaltyStatus } from "@/domain/customers/loyalty";
import { ordersFixtures } from "@/domain/orders/fixtures";

const directory = buildDirectory(
  customersFixtures,
  communitiesFixtures,
  directoryStatsFromOrders(ordersFixtures),
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

describe("buildDirectory", () => {
  it("une entrée par communauté et par client, chiffres tirés de leurs commandes", () => {
    expect(countDirectory(directory)).toEqual({
      communities: communitiesFixtures.length,
      customers: customersFixtures.length,
    });
    const amel = customerEntry("cli-0001");
    expect(amel.stats.orderCount).toBe(
      ordersFixtures.filter((o) => o.customer.id === "cli-0001").length,
    );
    expect(amel.loyalty).toEqual(
      loyaltyStatus(ordersFixtures.filter((o) => o.customer.id === "cli-0001")),
    );
    const noOrders = buildDirectory(
      customersFixtures.slice(0, 1),
      [],
      directoryStatsFromOrders([]),
    )[0];
    expect(noOrders?.kind === "customer" && noOrders.stats).toEqual({
      orderCount: 0,
      totalSpentCents: 0,
      lastDeliveryDate: null,
    });
    const creche = communityEntry("com-0001");
    expect(creche.memberCount).toBe(
      customersFixtures.filter((c) => c.community?.id === "com-0001").length,
    );
    expect(creche.summary.orderCount).toBe(
      ordersFixtures.filter((o) => o.community?.id === "com-0001").length,
    );
    const member = directory.find(
      (e) => e.kind === "customer" && e.customer.community !== null,
    );
    expect(member?.kind === "customer" ? member.loyalty : "absent").toBeNull();
  });
});

describe("matchesDirectoryQuery / filterDirectory", () => {
  it("cherche un client par nom sans accents, e-mail, ville ou téléphone", () => {
    const amel = customerEntry("cli-0001");
    expect(matchesDirectoryQuery(amel, "BENALI")).toBe(true);
    expect(matchesDirectoryQuery(amel, "amel.benali@")).toBe(true);
    expect(matchesDirectoryQuery(amel, "00 01")).toBe(true);
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
  it("trie par nom, commandes, montant ou récence, sans muter", () => {
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
    const amount = (e: DirectoryEntry) =>
      e.kind === "customer" ? e.stats.totalSpentCents : e.summary.totalCents;
    const byAmount = sortDirectory(directory, "montant");
    for (let i = 1; i < byAmount.length; i += 1) {
      expect(amount(byAmount[i - 1]!)).toBeGreaterThanOrEqual(
        amount(byAmount[i]!),
      );
    }
    const last = (e: DirectoryEntry) =>
      (e.kind === "customer"
        ? e.stats.lastDeliveryDate
        : e.summary.lastDeliveryDate) ?? "";
    const byRecent = sortDirectory(directory, "recent");
    for (let i = 1; i < byRecent.length; i += 1) {
      expect(last(byRecent[i - 1]!) >= last(byRecent[i]!)).toBe(true);
    }
    expect(directory.map((e) => e.id)).toEqual(before);
  });
});

describe("directorySearchQuery", () => {
  it("n'écrit que ce qui diffère des valeurs par défaut", () => {
    expect(directorySearchQuery({ type: "tous", sort: "nom" })).toBe("");
    expect(
      directorySearchQuery({
        query: "amel benali",
        type: "communautes",
        sort: "recent",
      }),
    ).toBe("q=amel+benali&type=communautes&tri=recent");
  });
});
