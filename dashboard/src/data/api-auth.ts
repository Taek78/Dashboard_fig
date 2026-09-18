import "server-only";
import { apiAuthDb } from "@/data/api-auth.db";
import type { ApiAuthSource } from "@/domain/api/source";

/*
 * FAÇADE de l'accès des clients à l'API (codes de connexion, sessions,
 * inscription) : le seul module que les routes de l'API importent.
 * L'implémentation est PostgreSQL (api-auth.db.ts).
 */
export const {
  issueLoginCode,
  findActiveLoginCode,
  recordLoginCodeAttempt,
  consumeLoginCode,
  openSession,
  signupCustomer,
  findSession,
  touchSession,
  revokeSession,
  listCustomerSessions,
}: ApiAuthSource = apiAuthDb;
