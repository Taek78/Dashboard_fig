import {
  ASSIGNMENT_ROLES,
  type AssignmentRole,
} from "@/domain/orders/assignment";
import {
  filterOrders,
  orderFiltersQuery,
  sortOrdersBySlot,
} from "@/domain/orders/rules";
import type { Order, OrderFilters } from "@/domain/orders/types";
import {
  STAFF_KINDS,
  type Availability,
  type Shift,
  type StaffKind,
  type Weekday,
} from "@/domain/staff/kind";
import type { StaffMember } from "@/domain/staff/types";
import { digitsOnly, isPhoneLike, normalize } from "@/lib/text";

/*
 * Règles pures du personnel, testées dans test/domain/staff/rules.test.ts :
 * nom affiché, tris et filtres, recherche dans l'équipe, personnes proposables
 * pour une affectation, historique et compteurs d'une personne calculés à
 * partir des commandes.
 */

/** "Malik Dembélé" : le nom affiché partout (cartes, listes déroulantes, historique). */
export function staffFullName(
  member: Pick<StaffMember, "firstName" | "lastName">,
): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

const KIND_ORDER: Record<StaffKind, number> = Object.fromEntries(
  STAFF_KINDS.map((kind, index) => [kind, index]),
) as Record<StaffKind, number>;

/** Copie triée : actifs d'abord, puis par métier (livreurs, préparateurs, préparateurs-livreurs, gestionnaires), puis par nom. */
export function sortStaff(members: readonly StaffMember[]): StaffMember[] {
  return members.toSorted(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.lastName.localeCompare(b.lastName, "fr") ||
      a.firstName.localeCompare(b.firstName, "fr"),
  );
}

/** Un métier, ou tout le monde quand `kind` est absent. Ne trie pas. */
export function filterStaff(
  members: readonly StaffMember[],
  kind?: StaffKind,
): StaffMember[] {
  return kind === undefined
    ? [...members]
    : members.filter((m) => m.kind === kind);
}

/* ---------- Recherche dans l'équipe ---------- */

export const STAFF_PRESENCES = ["actifs", "partis"] as const;
export type StaffPresence = (typeof STAFF_PRESENCES)[number];
export const STAFF_PRESENCE_LABELS: Record<StaffPresence, string> = {
  actifs: "Dans l'entreprise",
  partis: "Partis de l'entreprise",
};

/** Recherche de la section Personnel (?q=&type=&dispo=&creneau=&jour=&presence=). */
export type StaffSearch = {
  query?: string;
  kind?: StaffKind;
  availability?: Availability;
  shift?: Shift;
  workDay?: Weekday;
  presence?: StaffPresence;
};

/**
 * Recherche libre, sans accents ni majuscules : chaque mot doit se retrouver
 * dans le prénom, le nom ou l'e-mail (« malik dembele », « dembele malik »,
 * « renard@ » fonctionnent). Une saisie qui ressemble à un numéro se compare
 * au téléphone, chiffres seuls (« 90 04 »).
 */
export function matchesStaffQuery(
  member: StaffMember,
  query: string | undefined,
): boolean {
  const q = normalize(query ?? "");
  if (q === "") return true;
  const haystack = normalize(
    `${member.firstName} ${member.lastName} ${member.email}`,
  );
  if (q.split(/\s+/).every((word) => haystack.includes(word))) return true;
  const digits = digitsOnly(q);
  return (
    isPhoneLike(q) &&
    digits.length >= 2 &&
    digitsOnly(member.phone).includes(digits)
  );
}

/**
 * Filtres cumulés puis tri de sortStaff. Une disponibilité ne retient que les
 * personnes encore dans l'équipe (une personne partie n'est ni disponible ni
 * en congé) ; un jour retient celles qui travaillent ce jour-là.
 */
export function searchStaff(
  members: readonly StaffMember[],
  search: StaffSearch,
): StaffMember[] {
  return sortStaff(
    members.filter(
      (m) =>
        (search.kind === undefined || m.kind === search.kind) &&
        (search.availability === undefined ||
          (m.active && m.availability === search.availability)) &&
        (search.shift === undefined || m.shift === search.shift) &&
        (search.workDay === undefined || m.workDays.includes(search.workDay)) &&
        (search.presence === undefined ||
          m.active === (search.presence === "actifs")) &&
        matchesStaffQuery(m, search.query),
    ),
  );
}

/**
 * La liste coupée en deux (demande du 2026-09-18) : les personnes dans
 * l'entreprise, puis celles qui en sont parties, les plus récemment sorties
 * d'abord (un départ sans date, antérieur à la migration 0019, en dernier).
 * L'ordre de chaque moitié est sinon celui reçu.
 */
export function splitByPresence(members: readonly StaffMember[]): {
  present: StaffMember[];
  departed: StaffMember[];
} {
  return {
    present: members.filter((m) => m.active),
    departed: members
      .filter((m) => !m.active)
      .toSorted((a, b) => (b.leftAt ?? "").localeCompare(a.leftAt ?? "")),
  };
}

/** Vrai si une recherche ou un filtre est actif sur l'équipe. */
export function hasStaffSearch(search: StaffSearch): boolean {
  return Object.values(search).some((value) => value !== undefined);
}

/** Métier de référence de chaque rôle d'affectation (liens « Voir les livreurs »). */
export const KIND_FOR_ROLE: Record<AssignmentRole, StaffKind> = {
  preparer: "preparateur",
  driver: "livreur",
};

/**
 * Métiers qui peuvent tenir chaque rôle sur une commande : le
 * préparateur-livreur (demande du 2026-09-18) prépare ET livre, il est
 * proposé dans les deux listes, et peut tenir les deux rôles d'une même
 * commande.
 */
export const KINDS_FOR_ROLE: Record<AssignmentRole, readonly StaffKind[]> = {
  preparer: ["preparateur", "preparateur_livreur"],
  driver: ["livreur", "preparateur_livreur"],
};

/** Vrai si ce métier peut tenir ce rôle sur une commande. */
export function kindTakesRole(kind: StaffKind, role: AssignmentRole): boolean {
  return KINDS_FOR_ROLE[role].includes(kind);
}

/**
 * Personnes proposables dans la liste déroulante d'affectation : du bon
 * métier et actives, les disponibles d'abord (une personne en congé reste
 * proposée, signalée, pour une affectation anticipée). Copie triée.
 */
export function assignableStaff(
  members: readonly StaffMember[],
  role: AssignmentRole,
): StaffMember[] {
  return members
    .filter((m) => m.active && kindTakesRole(m.kind, role))
    .toSorted(
      (a, b) =>
        Number(a.availability !== "disponible") -
          Number(b.availability !== "disponible") ||
        a.lastName.localeCompare(b.lastName, "fr") ||
        a.firstName.localeCompare(b.firstName, "fr"),
    );
}

/** Vrai si la personne peut être affectée à ce rôle (métier, active). */
export function canBeAssigned(
  member: StaffMember,
  role: AssignmentRole,
): boolean {
  return member.active && kindTakesRole(member.kind, role);
}

/** Présente pour une affectation aujourd'hui : dans l'équipe et « disponible » (peu importe la raison d'une absence). */
export function isPresent(member: StaffMember): boolean {
  return member.active && member.availability === "disponible";
}

/**
 * Rôles pour lesquels PERSONNE n'est présent : plus aucune préparation, ou
 * plus aucune livraison, n'est possible. Le tableau de bord l'annonce en
 * priorité (demande du client). Sur la disponibilité de la fiche seulement,
 * pas sur les jours travaillés.
 */
export function unavailableRoles(
  members: readonly StaffMember[],
): AssignmentRole[] {
  return ASSIGNMENT_ROLES.filter(
    (role) => !members.some((m) => isPresent(m) && kindTakesRole(m.kind, role)),
  );
}

/** Commandes où la personne est préparateur ou livreur, les plus récentes d'abord. */
export function staffOrders(
  orders: readonly Order[],
  staffId: string,
): Order[] {
  return orders
    .filter((o) => o.preparer?.id === staffId || o.driver?.id === staffId)
    .toSorted(
      (a, b) =>
        b.deliverySlot.date.localeCompare(a.deliverySlot.date) ||
        b.deliverySlot.start.localeCompare(a.deliverySlot.start) ||
        b.reference.localeCompare(a.reference),
    );
}

export type StaffWorkSummary = {
  /** Commandes affectées (préparateur ou livreur, chacune une fois). */
  assigned: number;
  /** Commandes préparées (préparateur, hors annulées). */
  prepared: number;
  /** Livraisons terminées (livreur, statut livrée). */
  delivered: number;
  /** Commandes affectées encore en cours (en préparation ou en livraison). */
  inProgress: number;
  /** Jour de livraison le plus récent parmi les commandes affectées, ou null. */
  lastActivityDate: string | null;
};

/** Compteurs d'une personne à partir de TOUTES les commandes (le filtre est fait ici). */
export function summarizeStaffWork(
  orders: readonly Order[],
  staffId: string,
): StaffWorkSummary {
  let assigned = 0;
  let prepared = 0;
  let delivered = 0;
  let inProgress = 0;
  let lastActivityDate: string | null = null;
  for (const o of orders) {
    const isPreparer = o.preparer?.id === staffId;
    const isDriver = o.driver?.id === staffId;
    if (!isPreparer && !isDriver) continue;
    assigned += 1;
    if (isPreparer && o.status !== "cancelled") prepared += 1;
    if (isDriver && o.status === "delivered") delivered += 1;
    if (o.status === "preparing" || o.status === "delivering") inProgress += 1;
    if (lastActivityDate === null || o.deliverySlot.date > lastActivityDate) {
      lastActivityDate = o.deliverySlot.date;
    }
  }
  return { assigned, prepared, delivered, inProgress, lastActivityDate };
}

/** Ce qu'une liste déroulante d'affectation a besoin de savoir d'une personne. */
export type StaffOption = {
  id: string;
  name: string;
  availability: StaffMember["availability"];
};

/** Options des deux listes déroulantes (préparateur, livreur) à partir de toute l'équipe. */
export function assignmentOptions(
  members: readonly StaffMember[],
): Record<AssignmentRole, StaffOption[]> {
  const toOption = (m: StaffMember): StaffOption => ({
    id: m.id,
    name: staffFullName(m),
    availability: m.availability,
  });
  return {
    preparer: assignableStaff(members, "preparer").map(toOption),
    driver: assignableStaff(members, "driver").map(toOption),
  };
}

export type StaffFilterOption = { id: string; name: string; active: boolean };

/**
 * Options des filtres « préparateur » et « livreur » des listes : tout le
 * métier, personnes désactivées comprises (leurs commandes passées restent à
 * retrouver), actives d'abord puis par nom.
 */
export function staffFilterOptions(
  members: readonly StaffMember[],
): Record<AssignmentRole, StaffFilterOption[]> {
  const optionsFor = (role: AssignmentRole) =>
    sortStaff(members.filter((m) => kindTakesRole(m.kind, role))).map((m) => ({
      id: m.id,
      name: staffFullName(m),
      active: m.active,
    }));
  return { preparer: optionsFor("preparer"), driver: optionsFor("driver") };
}

/* ---------- Duplication ---------- */

/** Ce qu'une duplication reprend d'une fiche. */
export type StaffTemplate = Pick<
  StaffMember,
  "kind" | "shift" | "availability" | "workDays"
>;

/**
 * Modèle d'une nouvelle fiche à partir d'une personne : métier, créneau,
 * disponibilité et jours travaillés sont repris ; identité, coordonnées, date
 * d'entrée et notes restent à saisir (un e-mail est unique, une note est
 * personnelle). La copie arrive TOUJOURS dans l'entreprise, même d'une
 * personne partie (demande du 2026-09-18) : ni présence ni date de sortie.
 */
export function staffTemplate(member: StaffMember): StaffTemplate {
  return {
    kind: member.kind,
    shift: member.shift,
    availability: member.availability,
    workDays: [...member.workDays],
  };
}

/* ---------- Historique filtré ---------- */

export const STAFF_HISTORY_ROLES = ["preparation", "livraison"] as const;
export type StaffHistoryRole = (typeof STAFF_HISTORY_ROLES)[number];
export const STAFF_HISTORY_ROLE_LABELS: Record<StaffHistoryRole, string> = {
  preparation: "Préparations",
  livraison: "Livraisons",
};

/** Recherche dans l'historique d'une personne : commande, statut, période, rôle tenu. */
export type StaffHistoryFilters = Pick<
  OrderFilters,
  "query" | "status" | "from" | "to"
> & { role?: StaffHistoryRole };

/**
 * La recherche dans l'historique exprimée en filtres de commandes : la personne
 * (préparateur OU livreur) ou, si un rôle est demandé, la personne à ce rôle,
 * plus la recherche commune. Une seule définition pour la mémoire
 * (filterStaffHistory) et pour la base (getOrdersPage de la fiche).
 */
export function staffHistoryOrderFilters(
  staffId: string,
  filters: StaffHistoryFilters,
): OrderFilters {
  const { role, ...orderFilters } = filters;
  return {
    ...orderFilters,
    staffId,
    ...(role === "preparation" ? { preparerId: staffId } : {}),
    ...(role === "livraison" ? { driverId: staffId } : {}),
  };
}

/** Commandes de la personne qui passent la recherche, les plus récentes d'abord (comme staffOrders). */
export function filterStaffHistory(
  orders: readonly Order[],
  staffId: string,
  filters: StaffHistoryFilters,
): Order[] {
  return sortOrdersBySlot(
    filterOrders(orders, staffHistoryOrderFilters(staffId, filters)),
    "desc",
  );
}

/** Recherche de l'historique → paramètres d'URL (?q=&statut=&du=&au=&role=), pour la pagination. */
export function staffHistoryQuery(filters: StaffHistoryFilters): string {
  const params = new URLSearchParams(orderFiltersQuery(filters));
  if (filters.role) params.set("role", filters.role);
  return params.toString();
}

/** Vrai si une recherche est active sur l'historique. */
export function hasStaffHistoryFilters(filters: StaffHistoryFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}
