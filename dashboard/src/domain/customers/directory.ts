import { communityDiscountPercent } from "@/domain/communities/discount";
import {
  COMMUNITY_KIND_LABELS,
  COMMUNITY_VISIBILITY_LABELS,
} from "@/domain/communities/kind";
import {
  summarizeCommunity,
  type CommunitySummary,
} from "@/domain/communities/rules";
import type { Community } from "@/domain/communities/types";
import {
  loyaltyCount,
  loyaltyFromCount,
  type LoyaltyStatus,
} from "@/domain/customers/loyalty";
import {
  computeCustomerStats,
  type CustomerStats,
} from "@/domain/customers/rules";
import {
  loyalTierEvents,
  tierFromReachedAt,
  type CustomerTierState,
} from "@/domain/customers/tier";
import type { Customer } from "@/domain/customers/types";
import { bestDiscount, type ExpectedDiscount } from "@/domain/orders/discount";
import type { Order } from "@/domain/orders/types";
import { digitsOnly, isPhoneLike, normalize } from "@/lib/text";

/*
 * Annuaire de la section Clients : particuliers et communautés dans une seule
 * liste, cherchée, filtrée et triée par des règles pures (testées dans
 * test/domain/customers/directory.test.ts). Les chiffres de chaque entrée sont
 * calculés une fois, à partir de toutes les commandes.
 * Filtre « particuliers » : toutes les personnes, membres de communauté
 * compris (une personne membre reste un particulier). Filtre « communautés » :
 * les groupes seulement, jamais leurs membres.
 */
export const DIRECTORY_TYPES = ["tous", "particuliers", "communautes"] as const;
export type DirectoryType = (typeof DIRECTORY_TYPES)[number];
export const DIRECTORY_TYPE_LABELS: Record<DirectoryType, string> = {
  tous: "Tous",
  particuliers: "Particuliers",
  communautes: "Communautés",
};

/** Phrase d'aide de chaque position du commutateur. */
export const DIRECTORY_TYPE_DESCRIPTIONS: Record<DirectoryType, string> = {
  tous: "Particuliers et communautés",
  particuliers: "Tous les clients, membres de communauté compris",
  communautes: "Les cartes des communautés, sans leurs membres",
};

export const DIRECTORY_SORTS = [
  "nom",
  "commandes",
  "montant",
  "recent",
  "anciennete",
  "membres",
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];
export const DIRECTORY_SORT_LABELS: Record<DirectorySort, string> = {
  nom: "Nom",
  commandes: "Nombre de commandes",
  montant: "Montant dépensé",
  recent: "Commande la plus récente",
  anciennete: "Ancienneté",
  membres: "Nombre de membres",
};

/** Sens d'un tri (?sens=) ; chaque tri a son sens naturel par défaut. */
export const DIRECTORY_ORDERS = ["croissant", "decroissant"] as const;
export type DirectoryOrder = (typeof DIRECTORY_ORDERS)[number];
export const DIRECTORY_ORDER_LABELS: Record<DirectoryOrder, string> = {
  croissant: "Croissant",
  decroissant: "Décroissant",
};
export const DEFAULT_DIRECTORY_ORDER: Record<DirectorySort, DirectoryOrder> = {
  nom: "croissant",
  commandes: "decroissant",
  montant: "decroissant",
  recent: "decroissant",
  // Les inscriptions les plus récentes d'abord : la question courante est
  // « qui vient d'arriver ? ». Le bouton de sens donne l'autre lecture.
  anciennete: "decroissant",
  membres: "decroissant",
};

/**
 * Nature des valeurs triées, qui choisit l'icône du bouton de sens : lettres
 * (A / Z) pour le nom, chiffres (1 / 9) pour les nombres, montants et dates.
 */
export type DirectorySortScale = "alpha" | "numeric";
export const DIRECTORY_SORT_SCALES: Record<DirectorySort, DirectorySortScale> =
  {
    nom: "alpha",
    commandes: "numeric",
    montant: "numeric",
    recent: "numeric",
    anciennete: "numeric",
    membres: "numeric",
  };

/** Le sens contraire. */
export function oppositeOrder(order: DirectoryOrder): DirectoryOrder {
  return order === "croissant" ? "decroissant" : "croissant";
}

/** Le tri par membres n'a de sens que sur les communautés. */
export function isSortAvailable(sort: DirectorySort, type: DirectoryType) {
  return sort !== "membres" || type === "communautes";
}

/**
 * Le tri se choisit en deux gestes : le CRITÈRE dans une liste déroulante
 * (?tri=), le SENS par le bouton à côté (?sens=), écrit seulement s'il diffère
 * du sens naturel du critère. Libellés du sens, sans jargon, pour le nom
 * accessible de ce bouton.
 */
export type DirectorySortOption = {
  /** Valeur d'URL : « commandes ». */
  value: DirectorySort;
  label: string;
};

export const SORT_ORDER_LABELS: Record<
  DirectorySort,
  Record<DirectoryOrder, string>
> = {
  nom: { croissant: "Nom, de A à Z", decroissant: "Nom, de Z à A" },
  commandes: {
    decroissant: "Commandes, les plus nombreuses d'abord",
    croissant: "Commandes, les moins nombreuses d'abord",
  },
  montant: {
    decroissant: "Montant dépensé, du plus élevé",
    croissant: "Montant dépensé, du plus faible",
  },
  recent: {
    decroissant: "Commande la plus récente d'abord",
    croissant: "Commande la plus ancienne d'abord",
  },
  anciennete: {
    decroissant: "Ancienneté, du plus récent au plus ancien",
    croissant: "Ancienneté, du plus ancien au plus récent",
  },
  membres: {
    decroissant: "Membres, du plus grand groupe",
    croissant: "Membres, du plus petit groupe",
  },
};

/**
 * Lit ?tri= : « commandes », ou l'ancienne forme « commandes-croissant »
 * (liens enregistrés avant le bouton de sens) ; undefined si inconnu.
 */
export function parseSortParam(
  value: string | undefined,
): { sort: DirectorySort; order: DirectoryOrder } | undefined {
  if (value === undefined) return undefined;
  const [sort, order, extra] = value.split("-");
  if (extra !== undefined) return undefined;
  if (!(DIRECTORY_SORTS as readonly string[]).includes(sort ?? "")) {
    return undefined;
  }
  const found = sort as DirectorySort;
  if (order === undefined) {
    return { sort: found, order: DEFAULT_DIRECTORY_ORDER[found] };
  }
  if (!(DIRECTORY_ORDERS as readonly string[]).includes(order)) {
    return undefined;
  }
  return { sort: found, order: order as DirectoryOrder };
}

/** Lit ?sens= ; undefined si absent ou inconnu. */
export function parseOrderParam(
  value: string | undefined,
): DirectoryOrder | undefined {
  return (DIRECTORY_ORDERS as readonly string[]).includes(value ?? "")
    ? (value as DirectoryOrder)
    : undefined;
}

/** Critères de la liste déroulante pour un type affiché. */
export function sortOptions(type: DirectoryType): DirectorySortOption[] {
  return DIRECTORY_SORTS.filter((sort) => isSortAvailable(sort, type)).map(
    (sort) => ({ value: sort, label: DIRECTORY_SORT_LABELS[sort] }),
  );
}

/** Cartes par page de la section Clients. */
export const DIRECTORY_PAGE_SIZE = 24;

export type CustomerEntry = {
  kind: "customer";
  id: string;
  name: string;
  customer: Customer;
  stats: CustomerStats;
  /** Compteur fidélité, membres de communauté compris. */
  loyalty: LoyaltyStatus;
  /** Catégorie (basique ou fidèle) à l'instant de la lecture. */
  tier: CustomerTierState;
  /** Taux annoncé de sa communauté, null pour un particulier. */
  communityDiscountPercent: number | null;
  /** Remise attendue sur sa prochaine commande : la plus forte l'emporte. */
  nextDiscount: ExpectedDiscount | null;
};

export type CommunityEntry = {
  kind: "community";
  id: string;
  name: string;
  community: Community;
  memberCount: number;
  /** Taux annoncé, déduit du nombre de membres. */
  discountPercent: number;
  summary: CommunitySummary;
};

export type DirectoryEntry = CustomerEntry | CommunityEntry;

export type DirectorySearch = {
  query?: string;
  type: DirectoryType;
  sort: DirectorySort;
  order: DirectoryOrder;
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
 * Chiffres de l'annuaire, par client et par communauté : calculés par des
 * requêtes SQL agrégées (orders-aggregates.db.ts) pour toute la base, ou en
 * mémoire par directoryStatsFromOrders pour une liste de commandes déjà
 * chargée (fiche d'une communauté, tests). Un client ou une communauté absent
 * des tables n'a aucune commande. Les membres se comptent sur TOUTES les
 * communautés, quel que soit le périmètre des commandes : c'est le taux de
 * remise, pas une statistique.
 */
export type DirectoryStats = {
  customers: ReadonlyMap<string, CustomerStats>;
  communities: ReadonlyMap<string, CommunitySummary>;
  /** Compteur fidélité brut (loyaltyCount) de chaque client ayant commandé. */
  loyaltyCounts: ReadonlyMap<string, number>;
  /** ISO 8601 de la DERNIÈRE atteinte de la catégorie « fidèle » (loyalTierEvents). */
  loyalSince: ReadonlyMap<string, string>;
  /** Nombre de membres de chaque communauté (clients non anonymisés rattachés). */
  memberCounts: ReadonlyMap<string, number>;
};

const NO_CUSTOMER_STATS = computeCustomerStats([]);
const NO_COMMUNITY_SUMMARY = summarizeCommunity([]);

/** Nombre de membres par communauté, à partir des fiches clients. */
export function countMembers(
  customers: readonly Customer[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of customers) {
    if (c.community === null) continue;
    counts.set(c.community.id, (counts.get(c.community.id) ?? 0) + 1);
  }
  return counts;
}

export function directoryStatsFromOrders(
  orders: readonly Order[],
  customers: readonly Customer[] = [],
): DirectoryStats {
  const byCustomer = groupBy(orders, (o) => o.customer.id);
  const byCommunity = groupBy(orders, (o) => o.community?.id ?? null);
  const loyalSince = new Map<string, string>();
  for (const [id, mine] of byCustomer) {
    const last = loyalTierEvents(mine).at(-1);
    if (last) loyalSince.set(id, last.reachedAt);
  }
  return {
    customers: new Map(
      [...byCustomer].map(([id, mine]) => [id, computeCustomerStats(mine)]),
    ),
    communities: new Map(
      [...byCommunity].map(([id, list]) => [id, summarizeCommunity(list)]),
    ),
    loyaltyCounts: new Map(
      [...byCustomer].map(([id, mine]) => [id, loyaltyCount(mine)]),
    ),
    loyalSince,
    memberCounts: countMembers(customers),
  };
}

/** Une entrée par client, chiffres tirés de ses commandes, catégorie à l'instant `at`. */
export function buildCustomerEntries(
  customers: readonly Customer[],
  stats: DirectoryStats,
  at: string,
): CustomerEntry[] {
  return customers.map((customer) => {
    const loyalty = loyaltyFromCount(stats.loyaltyCounts.get(customer.id) ?? 0);
    const communityPercent = customer.community
      ? communityDiscountPercent(
          stats.memberCounts.get(customer.community.id) ?? 0,
        )
      : null;
    return {
      kind: "customer",
      id: customer.id,
      name: customer.fullName,
      customer,
      stats: stats.customers.get(customer.id) ?? NO_CUSTOMER_STATS,
      loyalty,
      tier: tierFromReachedAt(stats.loyalSince.get(customer.id) ?? null, at),
      communityDiscountPercent: communityPercent,
      nextDiscount: bestDiscount(loyalty.rewardReady, communityPercent),
    };
  });
}

/** L'annuaire complet : les communautés puis les clients (non trié). */
export function buildDirectory(
  customers: readonly Customer[],
  communities: readonly Community[],
  stats: DirectoryStats,
  at: string,
): DirectoryEntry[] {
  return [
    ...communities.map((community): CommunityEntry => {
      const memberCount = stats.memberCounts.get(community.id) ?? 0;
      return {
        kind: "community",
        id: community.id,
        name: community.name,
        community,
        memberCount,
        discountPercent: communityDiscountPercent(memberCount),
        summary: stats.communities.get(community.id) ?? NO_COMMUNITY_SUMMARY,
      };
    }),
    ...buildCustomerEntries(customers, stats, at),
  ];
}

/**
 * Recherche libre, sans accents ni majuscules. Un client : nom, e-mail, ville,
 * code postal, nom de sa communauté, code de parrainage. Une communauté : nom,
 * type, point de retrait, ville, référent et son e-mail. Le téléphone se
 * compare chiffres seuls, quand la saisie ressemble à un numéro.
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
          entry.customer.referralCode ?? "",
        ]
      : [
          entry.community.name,
          COMMUNITY_KIND_LABELS[entry.community.kind],
          COMMUNITY_VISIBILITY_LABELS[entry.community.visibility],
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
  // Une personne est toujours un particulier, membre d'une communauté ou non ;
  // la position « communautés » ne montre que les groupes, jamais leurs membres.
  if (type === "particuliers") return entry.kind === "customer";
  return entry.kind === "community";
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
const signupDate = (e: DirectoryEntry) =>
  e.kind === "customer" ? e.customer.createdAt : e.community.createdAt;

/**
 * Copie triée selon le tri et son sens (par défaut, le sens naturel du tri) ;
 * à égalité, par nom (ordre français, toujours croissant). Le tri par membres
 * n'est proposé qu'en position « communautés » (des groupes seulement) ; s'il
 * reçoit malgré tout des personnes, il les laisse après les groupes, par nom.
 */
export function sortDirectory(
  entries: readonly DirectoryEntry[],
  sort: DirectorySort,
  order: DirectoryOrder = DEFAULT_DIRECTORY_ORDER[sort],
): DirectoryEntry[] {
  const byName = (a: DirectoryEntry, b: DirectoryEntry) =>
    a.name.localeCompare(b.name, "fr");
  const sign = order === "croissant" ? 1 : -1;
  const ascending = (a: DirectoryEntry, b: DirectoryEntry): number => {
    switch (sort) {
      case "commandes":
        return orderCount(a) - orderCount(b);
      case "montant":
        return amountCents(a) - amountCents(b);
      case "recent":
        return lastDate(a).localeCompare(lastDate(b));
      case "anciennete":
        return signupDate(a).localeCompare(signupDate(b));
      case "membres":
        if (a.kind !== b.kind) return 0;
        return a.kind === "community" && b.kind === "community"
          ? a.memberCount - b.memberCount
          : 0;
      default:
        return byName(a, b);
    }
  };
  return entries.toSorted((a, b) => {
    if (sort === "membres" && a.kind !== b.kind) {
      return a.kind === "community" ? -1 : 1;
    }
    return sign * ascending(a, b) || byName(a, b);
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
  if (search.order !== DEFAULT_DIRECTORY_ORDER[search.sort]) {
    params.set("sens", search.order);
  }
  return params.toString();
}
