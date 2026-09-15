import { COMMUNITY_KIND_LABELS } from "@/domain/communities/kind";
import {
  communityMembers,
  summarizeCommunity,
  type CommunitySummary,
} from "@/domain/communities/rules";
import type { Community } from "@/domain/communities/types";
import {
  loyaltyFromStreak,
  loyaltyStreak,
  type LoyaltyStatus,
} from "@/domain/customers/loyalty";
import {
  computeCustomerStats,
  type CustomerStats,
} from "@/domain/customers/rules";
import type { Customer } from "@/domain/customers/types";
import type { Order } from "@/domain/orders/types";
import { digitsOnly, isPhoneLike, normalize } from "@/lib/text";

/*
 * Annuaire de la section Clients : particuliers et communautés dans une seule
 * liste, cherchée, filtrée et triée par des règles pures (testées dans
 * test/domain/customers/directory.test.ts). Les chiffres de chaque entrée sont
 * calculés une fois, à partir de toutes les commandes.
 * Filtre « communautés » : les groupes ET leurs membres (une personne membre
 * reste une personne, rattachée à sa communauté).
 */
export const DIRECTORY_TYPES = ["tous", "particuliers", "communautes"] as const;
export type DirectoryType = (typeof DIRECTORY_TYPES)[number];
export const DIRECTORY_TYPE_LABELS: Record<DirectoryType, string> = {
  tous: "Particuliers et communautés",
  particuliers: "Particuliers",
  communautes: "Communautés et leurs membres",
};

export const DIRECTORY_SORTS = [
  "nom",
  "commandes",
  "montant",
  "recent",
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];
export const DIRECTORY_SORT_LABELS: Record<DirectorySort, string> = {
  nom: "Nom (A → Z)",
  commandes: "Nombre de commandes",
  montant: "Montant dépensé",
  recent: "Commande la plus récente",
};

/** Cartes par page de la section Clients. */
export const DIRECTORY_PAGE_SIZE = 24;

export type CustomerEntry = {
  kind: "customer";
  id: string;
  name: string;
  customer: Customer;
  stats: CustomerStats;
  /** Série de fidélité d'un particulier ; null pour un membre de communauté. */
  loyalty: LoyaltyStatus | null;
};

export type CommunityEntry = {
  kind: "community";
  id: string;
  name: string;
  community: Community;
  memberCount: number;
  summary: CommunitySummary;
};

export type DirectoryEntry = CustomerEntry | CommunityEntry;

export type DirectorySearch = {
  query?: string;
  type: DirectoryType;
  sort: DirectorySort;
};

function groupBy(
  orders: readonly Order[],
  key: (o: Order) => string | null,
): Map<string, Order[]> {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const k = key(o);
    if (k === null) continue;
    const list = groups.get(k) ?? [];
    list.push(o);
    groups.set(k, list);
  }
  return groups;
}

/**
 * Chiffres de l'annuaire, par client et par communauté : calculés par une
 * requête SQL agrégée (orders-aggregates.db.ts) pour toute la base, ou en
 * mémoire par directoryStatsFromOrders pour une liste de commandes déjà
 * chargée (fiche d'une communauté, tests). Un client ou une communauté absent
 * des tables n'a aucune commande.
 */
export type DirectoryStats = {
  customers: ReadonlyMap<string, CustomerStats>;
  communities: ReadonlyMap<string, CommunitySummary>;
  /** Série de fidélité brute (loyaltyStreak) de chaque client ayant commandé. */
  loyaltyStreaks: ReadonlyMap<string, number>;
};

const NO_CUSTOMER_STATS = computeCustomerStats([]);
const NO_COMMUNITY_SUMMARY = summarizeCommunity([]);

export function directoryStatsFromOrders(
  orders: readonly Order[],
): DirectoryStats {
  const byCustomer = groupBy(orders, (o) => o.customer.id);
  const byCommunity = groupBy(orders, (o) => o.community?.id ?? null);
  return {
    customers: new Map(
      [...byCustomer].map(([id, mine]) => [id, computeCustomerStats(mine)]),
    ),
    communities: new Map(
      [...byCommunity].map(([id, list]) => [id, summarizeCommunity(list)]),
    ),
    loyaltyStreaks: new Map(
      [...byCustomer].map(([id, mine]) => [id, loyaltyStreak(mine)]),
    ),
  };
}

/** Une entrée par client, chiffres tirés de ses commandes. */
export function buildCustomerEntries(
  customers: readonly Customer[],
  stats: DirectoryStats,
): CustomerEntry[] {
  return customers.map((customer) => ({
    kind: "customer",
    id: customer.id,
    name: customer.fullName,
    customer,
    stats: stats.customers.get(customer.id) ?? NO_CUSTOMER_STATS,
    loyalty: customer.community
      ? null
      : loyaltyFromStreak(stats.loyaltyStreaks.get(customer.id) ?? 0),
  }));
}

/** L'annuaire complet : les communautés puis les clients (non trié). */
export function buildDirectory(
  customers: readonly Customer[],
  communities: readonly Community[],
  stats: DirectoryStats,
): DirectoryEntry[] {
  return [
    ...communities.map((community): CommunityEntry => ({
      kind: "community",
      id: community.id,
      name: community.name,
      community,
      memberCount: communityMembers(customers, community.id).length,
      summary: stats.communities.get(community.id) ?? NO_COMMUNITY_SUMMARY,
    })),
    ...buildCustomerEntries(customers, stats),
  ];
}

/**
 * Recherche libre, sans accents ni majuscules. Un client : nom, e-mail, ville,
 * code postal, nom de sa communauté. Une communauté : nom, type, point de
 * retrait, ville, référent et son e-mail. Le téléphone se compare chiffres
 * seuls, quand la saisie ressemble à un numéro.
 */
export function matchesDirectoryQuery(
  entry: DirectoryEntry,
  query: string | undefined,
): boolean {
  const q = normalize(query ?? "");
  if (q === "") return true;
  const texts =
    entry.kind === "customer"
      ? [
          entry.customer.fullName,
          entry.customer.email,
          entry.customer.city,
          entry.customer.postalCode,
          entry.customer.community?.name ?? "",
        ]
      : [
          entry.community.name,
          COMMUNITY_KIND_LABELS[entry.community.kind],
          entry.community.pickupPlace,
          entry.community.pickupCity,
          entry.community.pickupPostalCode,
          entry.community.contactName,
          entry.community.contactEmail,
        ];
  if (texts.some((text) => normalize(text).includes(q))) return true;
  const phone =
    entry.kind === "customer"
      ? entry.customer.phone
      : entry.community.contactPhone;
  const qDigits = digitsOnly(q);
  return (
    isPhoneLike(q) && qDigits.length >= 2 && digitsOnly(phone).includes(qDigits)
  );
}

function typeMatches(entry: DirectoryEntry, type: DirectoryType): boolean {
  if (type === "tous") return true;
  if (type === "particuliers") {
    return entry.kind === "customer" && entry.customer.community === null;
  }
  return entry.kind === "community" || entry.customer.community !== null;
}

/** Garde les entrées du type demandé qui correspondent à la recherche. Ne trie pas. */
export function filterDirectory(
  entries: readonly DirectoryEntry[],
  search: Pick<DirectorySearch, "query" | "type">,
): DirectoryEntry[] {
  return entries.filter(
    (e) =>
      typeMatches(e, search.type) && matchesDirectoryQuery(e, search.query),
  );
}

const orderCount = (e: DirectoryEntry) =>
  e.kind === "customer" ? e.stats.orderCount : e.summary.orderCount;
const amountCents = (e: DirectoryEntry) =>
  e.kind === "customer" ? e.stats.totalSpentCents : e.summary.totalCents;
const lastDate = (e: DirectoryEntry) =>
  (e.kind === "customer"
    ? e.stats.lastDeliveryDate
    : e.summary.lastDeliveryDate) ?? "";

/** Copie triée ; à égalité, par nom (ordre français). */
export function sortDirectory(
  entries: readonly DirectoryEntry[],
  sort: DirectorySort,
): DirectoryEntry[] {
  const byName = (a: DirectoryEntry, b: DirectoryEntry) =>
    a.name.localeCompare(b.name, "fr");
  return entries.toSorted((a, b) => {
    switch (sort) {
      case "commandes":
        return orderCount(b) - orderCount(a) || byName(a, b);
      case "montant":
        return amountCents(b) - amountCents(a) || byName(a, b);
      case "recent":
        return lastDate(b).localeCompare(lastDate(a)) || byName(a, b);
      default:
        return byName(a, b);
    }
  });
}

/** Nombre de communautés et de clients dans une liste. */
export function countDirectory(entries: readonly DirectoryEntry[]): {
  communities: number;
  customers: number;
} {
  const communities = entries.filter((e) => e.kind === "community").length;
  return { communities, customers: entries.length - communities };
}

/** Recherche → paramètres d'URL (?q=&type=&tri=), sans les valeurs par défaut. */
export function directorySearchQuery(search: DirectorySearch): string {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.type !== "tous") params.set("type", search.type);
  if (search.sort !== "nom") params.set("tri", search.sort);
  return params.toString();
}
