/*
 * Anonymisation d'un client (RGPD, droit à l'effacement). On n'efface pas la
 * ligne : ses commandes sont conservées comme pièces comptables (hypothèse à
 * confirmer avec le comptable du client, question 18) et la clé étrangère
 * l'interdit (RESTRICT). On remplace donc ce qui identifie la personne, sans
 * copie gardée :
 * - nom, e-mail, téléphone, rue, ville, code postal → valeurs neutres ;
 * - adhésion à une communauté → retirée ;
 * - code de parrainage et parrain → effacés (le code contient le nom) ;
 * - autorisations de notification et de marketing → retirées ;
 * - notes internes, messages « Nous contacter », notifications déposées →
 *   supprimés ;
 * - rue de livraison des commandes et précisions libres des annulations →
 *   effacées (texte saisi à la main, susceptible de nommer quelqu'un).
 * Restent : l'identifiant technique, la date de création, les commandes
 * (produits, montants, créneaux, ville et code postal de livraison) et leur
 * historique. Au sens strict du RGPD (considérant 26), ces commandes restent
 * PSEUDONYMES tant que l'identifiant existe ailleurs (application FIG,
 * sauvegardes) : elles sont traitées comme des données personnelles conservées
 * au titre d'une obligation légale (docs/rgpd.md).
 * Refusée tant qu'une commande est en préparation ou expédiée : la livraison
 * a besoin des coordonnées, et une annulation postérieure pourrait écrire un
 * texte nominatif que plus rien n'effacerait.
 * Pas de zod ici : le mot de confirmation est lu par un composant client.
 */
export const ANONYMIZE_CONFIRM_WORD = "ANONYMISER";

export const ANONYMIZED_CUSTOMER_NAME = "Client anonymisé";

/**
 * Colonnes d'un client anonymisé (noms des colonnes Drizzle). L'e-mail garde
 * l'unicité exigée par la base (index sur lower(email)) grâce à
 * l'identifiant, sans rien révéler ; le domaine .invalid ne peut recevoir
 * aucun message.
 */
export function anonymizedCustomerFields(customerId: string) {
  return {
    fullName: ANONYMIZED_CUSTOMER_NAME,
    email: `anonyme-${customerId}@anonyme.invalid`,
    phone: "",
    addressLine: null,
    city: "",
    postalCode: "",
    referralCode: null,
    referredById: null,
    notifyOffers: false,
    notifyOrderStatus: false,
    marketingConsent: false,
    consentsUpdatedAt: null,
  };
}

export function isAnonymized(customer: {
  anonymizedAt: string | null;
}): boolean {
  return customer.anonymizedAt !== null;
}

/**
 * Résultat d'une anonymisation : faite ; déjà faite auparavant (le nettoyage
 * des textes libres est rejoué) ; refusée car une commande est encore en
 * préparation ou expédiée ; client inconnu.
 */
export type AnonymizeOutcome =
  "anonymized" | "already_anonymized" | "open_orders" | "not_found";
