import { toIso } from "@/lib/days";

/*
 * Durées de conservation des données personnelles (RGPD, article 5.1.e : pas
 * plus longtemps que nécessaire). Ce sont des HYPOTHÈSES à faire valider par
 * le client, responsable du traitement (question 18 du backlog) :
 * - un client sans aucune activité depuis 3 ans est anonymisé (référentiel
 *   « gestion commerciale » de la CNIL) ; ses commandes restent ;
 * - le journal de sécurité (e-mails, adresses IP) est gardé 12 mois (la CNIL
 *   recommande 6 mois à 1 an pour les journaux), sauf les preuves des demandes
 *   RGPD traitées, gardées jusqu'à ce que leur durée soit fixée ;
 * - une tentative de connexion échouée est oubliée après 24 heures, sauf
 *   verrou encore actif (choix technique, pas une recommandation) ;
 * - API de l'application (2026-09-17) : un code de connexion est oublié
 *   24 heures après son expiration, une session 30 jours après son expiration
 *   ou sa révocation, une clé d'idempotence dès son expiration (choix
 *   techniques ; la session vit 180 jours, domain/api/session.ts).
 * Appliquées par `npm run rgpd:purge` (scripts/rgpd-purge.ts), jamais en
 * silence : aperçu d'abord, --apply pour écrire.
 */
export const RETENTION = {
  inactiveCustomerYears: 3,
  securityEventMonths: 12,
  loginAttemptHours: 24,
  customerLoginCodeHours: 24,
  customerSessionDays: 30,
} as const;

export type Retention = { [K in keyof typeof RETENTION]: number };

export type RetentionCutoffs = {
  /** Jour "AAAA-MM-JJ" : un client sans activité depuis ce jour inclus est inactif. */
  customerActivitySince: string;
  /** Événements du journal de sécurité antérieurs : supprimés. */
  securityEventsBefore: Date;
  /** Tentatives de connexion dont le dernier échec est antérieur : supprimées. */
  loginAttemptsBefore: Date;
  /** Codes de connexion de l'application expirés avant : supprimés. */
  customerLoginCodesBefore: Date;
  /** Sessions de l'application expirées ou révoquées avant : supprimées. */
  customerSessionsBefore: Date;
  /** Clés d'idempotence expirées avant : supprimées (l'instant même). */
  idempotencyKeysBefore: Date;
};

/**
 * Bornes de conservation à l'instant `now`, en UTC. Un 29 février reculé d'un
 * an tombe le 1er mars (règle de Date) : un jour d'écart, sans conséquence.
 */
export function retentionCutoffs(
  now: Date,
  retention: Retention = RETENTION,
): RetentionCutoffs {
  const customers = new Date(now);
  customers.setUTCFullYear(
    customers.getUTCFullYear() - retention.inactiveCustomerYears,
  );
  const events = new Date(now);
  events.setUTCMonth(events.getUTCMonth() - retention.securityEventMonths);
  return {
    customerActivitySince: toIso(customers),
    securityEventsBefore: events,
    loginAttemptsBefore: new Date(
      now.getTime() - retention.loginAttemptHours * 3_600_000,
    ),
    customerLoginCodesBefore: new Date(
      now.getTime() - retention.customerLoginCodeHours * 3_600_000,
    ),
    customerSessionsBefore: new Date(
      now.getTime() - retention.customerSessionDays * 86_400_000,
    ),
    idempotencyKeysBefore: new Date(now),
  };
}

/**
 * Vrai si le client n'a plus d'activité depuis `since` : ni création de compte
 * ni jour de livraison (même futur, même annulée) à partir de ce jour, et
 * aucune commande encore en préparation ou expédiée (l'anonymisation la
 * refuserait). Règle pure reproduite en SQL par findInactiveCustomers
 * (src/db/privacy.ts) et testée contre elle.
 */
export function isCustomerInactive(
  customer: {
    createdAt: string;
    lastDeliveryDate: string | null;
    hasOpenOrders?: boolean;
  },
  since: string,
): boolean {
  if (customer.hasOpenOrders) return false;
  const created = customer.createdAt.slice(0, 10);
  const last =
    customer.lastDeliveryDate !== null && customer.lastDeliveryDate > created
      ? customer.lastDeliveryDate
      : created;
  return last < since;
}
