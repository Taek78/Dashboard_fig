import type { CustomerLoginCode, CustomerSession } from "@/domain/api/session";
import type { Customer } from "@/domain/customers/types";

/*
 * CONTRATS de l'API implémentés par PostgreSQL : l'accès des clients
 * (src/data/api-auth.db.ts) et les clés d'idempotence
 * (src/data/api-idempotency.db.ts). Types seulement. Les lectures et
 * écritures métier (commandes, messages, notifications, profil) sont dans les
 * contrats de leurs domaines, étendus pour l'API.
 */

/** Ce que l'inscription écrit : profil validé, parrain et communauté déjà RÉSOLUS par la source. */
export type CustomerSignup = {
  email: string;
  fullName: string;
  phone: string;
  addressLine: string | null;
  city: string;
  postalCode: string;
  consents: { offers: boolean; orderStatus: boolean; marketing: boolean };
  /** Code de parrainage saisi, à résoudre ; null si aucun. */
  referralCode: string | null;
  /** Communauté demandée, qui doit être publique et active ; null si aucune. */
  communityId: string | null;
};

export type SignupOutcome =
  | { outcome: "created"; customer: Customer; session: CustomerSession }
  | { outcome: "email_taken" }
  | { outcome: "referral_code_unknown" }
  | { outcome: "community_not_joinable" };

/**
 * Ce qu'une requête authentifiée sait du client en UNE requête (session
 * jointe au client) : de quoi décider sans relire la fiche complète.
 */
export type AuthenticatedCustomer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine: string | null;
  city: string;
  postalCode: string;
  communityId: string | null;
  notifyOrderStatus: boolean;
  anonymized: boolean;
};

export type ApiAuthSource = {
  /** Émet un code (HMAC) pour l'adresse : purge des codes expirés, consommation du code actif précédent, insertion. */
  issueLoginCode(input: {
    email: string;
    codeHash: string;
    requestedIp: string | null;
    now: Date;
  }): Promise<CustomerLoginCode>;
  findActiveLoginCode(email: string): Promise<CustomerLoginCode | null>;
  /** Un essai de plus, atomique ; renvoie le total. */
  recordLoginCodeAttempt(id: string): Promise<number>;
  /** Consommation conditionnelle : vrai une seule fois. */
  consumeLoginCode(id: string, at: Date): Promise<boolean>;
  openSession(
    customerId: string,
    tokenHash: string,
    now: Date,
  ): Promise<CustomerSession>;
  /** Inscription et ouverture de session en une transaction. */
  signupCustomer(
    signup: CustomerSignup,
    tokenHash: string,
    now: Date,
  ): Promise<SignupOutcome>;
  findSession(tokenHash: string): Promise<{
    session: CustomerSession;
    customer: AuthenticatedCustomer;
  } | null>;
  touchSession(id: string, at: Date): Promise<void>;
  /** Révocation conditionnelle : vrai si la session était encore ouverte. */
  revokeSession(id: string, at: Date): Promise<boolean>;
  /** Toutes les sessions d'une personne (export RGPD), de la plus ancienne à la plus récente. */
  listCustomerSessions(customerId: string): Promise<CustomerSession[]>;
};

/** Résultat de la prise d'une clé d'idempotence. */
export type IdempotencyClaim =
  | { state: "claimed" }
  | { state: "in_progress" }
  | { state: "mismatch" }
  | { state: "replay"; status: number; body: unknown };

export type IdempotencySource = {
  /** Prend la clé (INSERT … ON CONFLICT DO NOTHING) ou dit ce qu'elle porte déjà. */
  claim(input: {
    customerId: string;
    key: string;
    requestHash: string;
    now: Date;
    ttlMs: number;
  }): Promise<IdempotencyClaim>;
  /** Mémorise la réponse à rejouer. */
  complete(input: {
    customerId: string;
    key: string;
    status: number;
    body: unknown;
  }): Promise<void>;
  /** Rend la clé après un échec : l'application pourra réessayer. */
  release(customerId: string, key: string): Promise<void>;
};
