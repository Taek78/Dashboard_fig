import type { AssignmentRole } from "@/domain/orders/assignment";
import type { Order } from "@/domain/orders/types";
import { STAFF_KINDS, type StaffKind } from "@/domain/staff/kind";
import type { StaffMember } from "@/domain/staff/types";

/*
 * Règles pures du personnel, testées dans test/domain/staff/rules.test.ts :
 * nom affiché, tris et filtres, personnes proposables pour une affectation,
 * historique et compteurs d'une personne calculés à partir des commandes.
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

/** Copie triée : actifs d'abord, puis par métier (livreurs, préparateurs, gestionnaires), puis par nom. */
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

/** Métier attendu pour chaque rôle d'affectation sur une commande. */
export const KIND_FOR_ROLE: Record<AssignmentRole, StaffKind> = {
  preparer: "preparateur",
  driver: "livreur",
};

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
    .filter((m) => m.active && m.kind === KIND_FOR_ROLE[role])
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
  return member.active && member.kind === KIND_FOR_ROLE[role];
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
  let prepared = 0;
  let delivered = 0;
  let inProgress = 0;
  let lastActivityDate: string | null = null;
  for (const o of orders) {
    const isPreparer = o.preparer?.id === staffId;
    const isDriver = o.driver?.id === staffId;
    if (!isPreparer && !isDriver) continue;
    if (isPreparer && o.status !== "cancelled") prepared += 1;
    if (isDriver && o.status === "delivered") delivered += 1;
    if (o.status === "preparing" || o.status === "delivering") inProgress += 1;
    if (lastActivityDate === null || o.deliverySlot.date > lastActivityDate) {
      lastActivityDate = o.deliverySlot.date;
    }
  }
  return { prepared, delivered, inProgress, lastActivityDate };
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
