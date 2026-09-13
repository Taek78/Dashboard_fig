import type { UserAccount } from "@/domain/auth/types";

/* CONTRAT des comptes : mock (compte d'amorçage) aujourd'hui, table en piste B. */
export type UsersSource = {
  findUserByEmail(email: string): Promise<UserAccount | null>;
};
