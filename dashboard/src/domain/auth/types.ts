import type { Role } from "@/domain/auth/roles";

/*
 * A1.3 — export type CurrentUser = { id: string; name: string; role: Role }
 * A7 gardera exactement ce type en sortie de verifySession() : aucun appelant à reprendre.
 */
export type CurrentUser = { id: string; name: string; role: Role };
