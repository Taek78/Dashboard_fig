import type { Customer } from "@/domain/customers/types";

/*
 * Clients factices : les 12 personnes présentes dans src/domain/orders/fixtures.ts,
 * mêmes ids, noms, e-mails (@example.invalid) et téléphones (06 39 98 00 xx),
 * vérifié par test/domain/customers/fixtures.test.ts. Deux clientes ont des notes
 * internes pour la démo. Déterministe : dates fixes.
 */
const c = (
  n: number,
  fullName: string,
  email: string,
  postalCode: string,
  city: string,
  createdAt: string,
  notes: Customer["notes"] = [],
): Customer => ({
  id: `cli-${String(n).padStart(4, "0")}`,
  fullName,
  email,
  phone: `06 39 98 00 ${String(n).padStart(2, "0")}`,
  city,
  postalCode,
  createdAt,
  notes,
});

export const customersFixtures: readonly Customer[] = [
  c(
    1,
    "Amel Benali",
    "amel.benali@example.invalid",
    "75011",
    "Paris",
    "2026-03-12T10:00:00.000Z",
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
    "75020",
    "Paris",
    "2026-04-02T08:30:00.000Z",
  ),
  c(
    3,
    "Inès Rocher",
    "ines.rocher@example.invalid",
    "93100",
    "Montreuil",
    "2026-04-18T17:05:00.000Z",
  ),
  c(
    4,
    "Karim Lefèvre",
    "karim.lefevre@example.invalid",
    "94300",
    "Vincennes",
    "2026-05-06T11:20:00.000Z",
  ),
  c(
    5,
    "Lucie Gauthier",
    "lucie.gauthier@example.invalid",
    "75012",
    "Paris",
    "2026-05-21T09:45:00.000Z",
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
    "75019",
    "Paris",
    "2026-06-10T16:10:00.000Z",
  ),
  c(
    7,
    "Samuel Nkemelu",
    "samuel.nkemelu@example.invalid",
    "94160",
    "Saint-Mandé",
    "2026-06-25T12:00:00.000Z",
  ),
  c(
    8,
    "Élise Moreau",
    "elise.moreau@example.invalid",
    "75003",
    "Paris",
    "2026-07-08T08:00:00.000Z",
  ),
  c(
    9,
    "Yanis Cohen",
    "yanis.cohen@example.invalid",
    "93170",
    "Bagnolet",
    "2026-07-19T19:30:00.000Z",
  ),
  c(
    10,
    "Chloé Da Silva",
    "chloe.dasilva@example.invalid",
    "75010",
    "Paris",
    "2026-08-02T13:15:00.000Z",
  ),
  c(
    11,
    "Mathis Petit",
    "mathis.petit@example.invalid",
    "75020",
    "Paris",
    "2026-08-15T10:50:00.000Z",
  ),
  c(
    12,
    "Sofia Haddad",
    "sofia.haddad@example.invalid",
    "75012",
    "Paris",
    "2026-08-30T15:25:00.000Z",
  ),
];
