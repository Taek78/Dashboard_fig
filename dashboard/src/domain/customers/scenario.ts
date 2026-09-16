import { referralCodeFor } from "@/domain/customers/referral";
import type { Customer, CustomerConsents } from "@/domain/customers/types";

/*
 * Clients du SCÉNARIO : les 12 personnes des commandes de
 * src/domain/orders/scenario.ts, mêmes ids, noms, e-mails (@example.invalid) et
 * téléphones (06 39 98 00 xx). Deux clientes ont des notes internes pour la
 * démo. Déterministe : dates fixes. Les clients de l'historique généré sont
 * dans src/domain/orders/history.ts ; fixtures.ts assemble les deux.
 *
 * Adresses inventées (rues réelles de quartier, numéros arbitraires, aucune
 * personne réelle). Les autorisations sont datées de la création du compte :
 * c'est là que l'application les demande. Le code de parrainage suit la règle
 * de customers/referral.ts ; quatre clients ont été parrainés (REFERRED_BY).
 */
const c = (
  n: number,
  fullName: string,
  email: string,
  addressLine: string,
  postalCode: string,
  city: string,
  createdAt: string,
  consents: Omit<CustomerConsents, "updatedAt">,
  notes: Customer["notes"] = [],
): Customer => ({
  id: `cli-${String(n).padStart(4, "0")}`,
  fullName,
  email,
  phone: `06 39 98 00 ${String(n).padStart(2, "0")}`,
  addressLine,
  city,
  postalCode,
  createdAt,
  community: null,
  consents: { ...consents, updatedAt: createdAt },
  referralCode: referralCodeFor(fullName, n),
  referredBy: null,
  notes,
  anonymizedAt: null,
});

const ALL = { offers: true, orderStatus: true, marketing: true };
const ORDERS_ONLY = { offers: false, orderStatus: true, marketing: false };
const OFFERS_AND_ORDERS = { offers: true, orderStatus: true, marketing: false };
const OFFERS_ONLY = { offers: true, orderStatus: false, marketing: false };
const NONE = { offers: false, orderStatus: false, marketing: false };

const base: readonly Customer[] = [
  c(
    1,
    "Amel Benali",
    "amel.benali@example.invalid",
    "12 rue des Lilas",
    "75011",
    "Paris",
    "2026-03-12T10:00:00.000Z",
    ALL,
    [
      {
        id: "note-0001",
        text: "Préfère une livraison avant 10 h, code d'entrée dans le commentaire de commande.",
        authorName: "Utilisateur démo",
        createdAt: "2026-08-20T09:15:00.000Z",
      },
      {
        id: "note-0002",
        text: "A signalé des fraises abîmées le 2 septembre : geste commercial fait.",
        authorName: "Utilisateur démo",
        createdAt: "2026-09-03T14:40:00.000Z",
      },
    ],
  ),
  c(
    2,
    "Théo Marchand",
    "theo.marchand@example.invalid",
    "8 avenue Gambetta",
    "75020",
    "Paris",
    "2026-04-02T08:30:00.000Z",
    OFFERS_AND_ORDERS,
  ),
  c(
    3,
    "Inès Rocher",
    "ines.rocher@example.invalid",
    "27 rue de Paris",
    "93100",
    "Montreuil",
    "2026-04-18T17:05:00.000Z",
    ORDERS_ONLY,
  ),
  c(
    4,
    "Karim Lefèvre",
    "karim.lefevre@example.invalid",
    "3 allée des Tilleuls",
    "94300",
    "Vincennes",
    "2026-05-06T11:20:00.000Z",
    OFFERS_ONLY,
  ),
  c(
    5,
    "Lucie Gauthier",
    "lucie.gauthier@example.invalid",
    "45 rue de Reuilly",
    "75012",
    "Paris",
    "2026-05-21T09:45:00.000Z",
    ALL,
    [
      {
        id: "note-0003",
        text: "Allergie aux fruits à coque : ne jamais proposer de substitution avec des noix.",
        authorName: "Utilisateur démo",
        createdAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  ),
  c(
    6,
    "Nadia Ferreira",
    "nadia.ferreira@example.invalid",
    "19 rue Manin",
    "75019",
    "Paris",
    "2026-06-10T16:10:00.000Z",
    NONE,
  ),
  c(
    7,
    "Samuel Nkemelu",
    "samuel.nkemelu@example.invalid",
    "6 avenue du Général-de-Gaulle",
    "94160",
    "Saint-Mandé",
    "2026-06-25T12:00:00.000Z",
    OFFERS_AND_ORDERS,
  ),
  c(
    8,
    "Élise Moreau",
    "elise.moreau@example.invalid",
    "14 rue de Bretagne",
    "75003",
    "Paris",
    "2026-07-08T08:00:00.000Z",
    { offers: false, orderStatus: true, marketing: true },
  ),
  c(
    9,
    "Yanis Cohen",
    "yanis.cohen@example.invalid",
    "31 rue Sadi-Carnot",
    "93170",
    "Bagnolet",
    "2026-07-19T19:30:00.000Z",
    OFFERS_ONLY,
  ),
  c(
    10,
    "Chloé Da Silva",
    "chloe.dasilva@example.invalid",
    "22 rue du Faubourg-Saint-Denis",
    "75010",
    "Paris",
    "2026-08-02T13:15:00.000Z",
    OFFERS_AND_ORDERS,
  ),
  c(
    11,
    "Mathis Petit",
    "mathis.petit@example.invalid",
    "5 rue des Pyrénées",
    "75020",
    "Paris",
    "2026-08-15T10:50:00.000Z",
    NONE,
  ),
  c(
    12,
    "Sofia Haddad",
    "sofia.haddad@example.invalid",
    "9 boulevard de Picpus",
    "75012",
    "Paris",
    "2026-08-30T15:25:00.000Z",
    ALL,
  ),
];

/** Filleul → parrain (le code saisi à l'inscription). Amel a deux filleuls. */
const REFERRED_BY: Record<string, string> = {
  "cli-0002": "cli-0001",
  "cli-0009": "cli-0003",
  "cli-0011": "cli-0001",
  "cli-0012": "cli-0005",
};

export const scenarioCustomers: readonly Customer[] = base.map((customer) => {
  const referrerId = REFERRED_BY[customer.id];
  if (referrerId === undefined) return customer;
  const referrer = base.find((c) => c.id === referrerId);
  if (!referrer)
    throw new Error(`Fixture client : parrain ${referrerId} absent`);
  return {
    ...customer,
    referredBy: { id: referrer.id, fullName: referrer.fullName },
  };
});
