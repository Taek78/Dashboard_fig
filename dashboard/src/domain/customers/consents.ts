import type { CustomerConsents } from "@/domain/customers/types";

/*
 * Les trois autorisations qu'un client donne dans l'application FIG, dans
 * l'ordre d'affichage, avec leurs libellés. Les clés sont celles de
 * CustomerConsents ; les colonnes Postgres s'appellent notify_offers,
 * notify_order_status et marketing_consent.
 */
export const CONSENT_KEYS = ["offers", "orderStatus", "marketing"] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export const CONSENT_LABELS: Record<ConsentKey, string> = {
  offers: "Offres et promos",
  orderStatus: "État de la commande",
  marketing: "Marketing",
};

/** Ce que chaque autorisation permet, en une phrase, pour l'infobulle et la fiche. */
export const CONSENT_DESCRIPTIONS: Record<ConsentKey, string> = {
  offers: "Notifications d'offres, de promotions et de liquidations.",
  orderStatus:
    "Notification à chaque changement d'état de sa commande : le dashboard la dépose automatiquement.",
  marketing: "Communications marketing (lettres, campagnes).",
};

/** Aucune autorisation : la valeur d'un client dont l'application n'a rien transmis. */
export const NO_CONSENTS: CustomerConsents = {
  offers: false,
  orderStatus: false,
  marketing: false,
  updatedAt: null,
};

/** Nombre d'autorisations données, sur trois. */
export function grantedConsentCount(consents: CustomerConsents): number {
  return CONSENT_KEYS.filter((key) => consents[key]).length;
}
