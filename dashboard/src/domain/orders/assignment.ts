/*
 * Affectation d'une personne de l'équipe à une commande : un préparateur
 * (qui prépare le panier) et un livreur (qui livre). Deux rôles, un même
 * geste : choisir dans une liste déroulante, ou retirer l'affectation. Le
 * métier attendu pour chaque rôle est dans src/domain/staff/rules.ts
 * (KIND_FOR_ROLE) ; la Server Action assignOrderStaff le vérifie.
 */
export const ASSIGNMENT_ROLES = ["preparer", "driver"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  preparer: "Préparateur",
  driver: "Livreur",
};

/** Référence légère à une personne, telle que portée par une commande. */
export type StaffRef = { id: string; name: string };

/**
 * Ce que la Server Action transmet à la source : le rôle, la personne (ou
 * rien) et, en précondition, l'identifiant de la personne que l'écran
 * affichait au moment du choix (`null` = personne ; absent = pas de
 * précondition). Si l'affectation a changé entre-temps, la source n'écrit rien.
 */
export type StaffAssignment = {
  role: AssignmentRole;
  staff: StaffRef | null;
  expectedStaffId?: string | null;
};
