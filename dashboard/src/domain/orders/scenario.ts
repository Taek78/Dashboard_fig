import type { Order } from "@/domain/orders/types";

/*
 * Commandes du SCÉNARIO : quatorze commandes écrites à la main autour du
 * 7 septembre 2026 (FIXTURE_TODAY), qui couvrent tous les statuts et servent
 * aux tests et aux parcours navigateur. L'historique sur deux ans est généré à
 * côté (history.ts) ; fixtures.ts assemble les deux.
 *
 * Déterministes : aucune date calculée (pas de new Date(), Date.now(),
 * Math.random()), sinon un test passe un jour et échoue le lendemain.
 *
 * Aucune personne réelle : emails en @example.invalid (RFC 2606), téléphones
 * 06 39 98 00 xx (tranche réservée à la fiction), adresses réduites à ville + code
 * postal. Deux clientes reviennent (cli-0001, cli-0005) pour la future page Clients.
 * Vérifié par test/domain/orders/fixtures.test.ts.
 */
export const FIXTURE_TODAY = "2026-09-07";

/** Personnes de src/domain/staff/fixtures.ts, telles que portées par une commande. */
const PREPARER_JULIEN = { id: "stf-0005", name: "Julien Carpentier" };
const PREPARER_FATOU = { id: "stf-0006", name: "Fatou Ndiaye" };
const DRIVER_MALIK = { id: "stf-0001", name: "Malik Dembélé" };
const DRIVER_SOPHIE = { id: "stf-0002", name: "Sophie Renard" };

/** Les champs d'équipe, de communauté et de remise sont posés plus bas. */
type ScenarioSeed = Omit<
  Order,
  "community" | "discount" | "preparer" | "driver"
>;

const seeds: readonly ScenarioSeed[] = [
  {
    id: "cmd-0001",
    reference: "FIG-260907-001",
    createdAt: "2026-09-07T08:15:00.000Z",
    status: "pending",
    cancellation: null,
    customer: {
      id: "cli-0001",
      fullName: "Amel Benali",
      email: "amel.benali@example.invalid",
      phone: "06 39 98 00 01",
    },
    deliverySlot: { date: "2026-09-07", start: "09:00", end: "11:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75011",
    lines: [
      {
        productId: "prd-0001",
        productName: "Carottes",
        quantity: 1000,
        unit: "g",
        lineTotalCents: 290,
      },
      {
        productId: "prd-0002",
        productName: "Pommes Gala",
        quantity: 1500,
        unit: "g",
        lineTotalCents: 525,
      },
      {
        productId: "prd-0006",
        productName: "Salade batavia",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 180,
      },
    ],
    totalCents: 995,
  },
  {
    id: "cmd-0002",
    reference: "FIG-260907-002",
    createdAt: "2026-09-07T08:42:00.000Z",
    status: "confirmed",
    cancellation: null,
    customer: {
      id: "cli-0002",
      fullName: "Théo Marchand",
      email: "theo.marchand@example.invalid",
      phone: "06 39 98 00 02",
    },
    deliverySlot: { date: "2026-09-07", start: "09:00", end: "11:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75020",
    lines: [
      {
        productId: "prd-0003",
        productName: "Bananes",
        quantity: 1200,
        unit: "g",
        lineTotalCents: 300,
      },
      {
        productId: "prd-0007",
        productName: "Avocat",
        quantity: 3,
        unit: "piece",
        lineTotalCents: 450,
      },
    ],
    totalCents: 750,
  },
  {
    id: "cmd-0003",
    reference: "FIG-260907-003",
    createdAt: "2026-09-07T07:05:00.000Z",
    status: "preparing",
    cancellation: null,
    customer: {
      id: "cli-0003",
      fullName: "Inès Rocher",
      email: "ines.rocher@example.invalid",
      phone: "06 39 98 00 03",
    },
    deliverySlot: { date: "2026-09-07", start: "11:00", end: "13:00" },
    deliveryCity: "Montreuil",
    deliveryPostalCode: "93100",
    lines: [
      {
        productId: "prd-0004",
        productName: "Tomates cœur de bœuf",
        quantity: 800,
        unit: "g",
        lineTotalCents: 560,
      },
      {
        productId: "prd-0005",
        productName: "Courgettes",
        quantity: 600,
        unit: "g",
        lineTotalCents: 210,
      },
      {
        productId: "prd-0008",
        productName: "Citron",
        quantity: 4,
        unit: "piece",
        lineTotalCents: 240,
      },
      {
        productId: "prd-0009",
        productName: "Fraises (barquette)",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 700,
      },
    ],
    totalCents: 1710,
  },
  {
    id: "cmd-0004",
    reference: "FIG-260907-004",
    createdAt: "2026-09-07T06:30:00.000Z",
    status: "delivering",
    cancellation: null,
    customer: {
      id: "cli-0004",
      fullName: "Karim Lefèvre",
      email: "karim.lefevre@example.invalid",
      phone: "06 39 98 00 04",
    },
    deliverySlot: { date: "2026-09-07", start: "11:00", end: "13:00" },
    deliveryCity: "Vincennes",
    deliveryPostalCode: "94300",
    lines: [
      {
        productId: "prd-0010",
        productName: "Pommes de terre",
        quantity: 2500,
        unit: "g",
        lineTotalCents: 500,
      },
      {
        productId: "prd-0011",
        productName: "Oignons jaunes",
        quantity: 500,
        unit: "g",
        lineTotalCents: 120,
      },
      {
        productId: "prd-0012",
        productName: "Poireaux",
        quantity: 700,
        unit: "g",
        lineTotalCents: 315,
      },
    ],
    totalCents: 935,
  },
  {
    id: "cmd-0005",
    reference: "FIG-260906-001",
    createdAt: "2026-09-06T09:10:00.000Z",
    status: "delivered",
    cancellation: null,
    customer: {
      id: "cli-0005",
      fullName: "Lucie Gauthier",
      email: "lucie.gauthier@example.invalid",
      phone: "06 39 98 00 05",
    },
    deliverySlot: { date: "2026-09-06", start: "14:00", end: "16:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75012",
    lines: [
      {
        productId: "prd-0013",
        productName: "Melon",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 390,
      },
      {
        productId: "prd-0014",
        productName: "Raisin",
        quantity: 600,
        unit: "g",
        lineTotalCents: 420,
      },
    ],
    totalCents: 810,
  },
  {
    id: "cmd-0006",
    reference: "FIG-260906-002",
    createdAt: "2026-09-06T10:25:00.000Z",
    status: "cancelled",
    cancellation: { reason: "stock", detail: null },
    customer: {
      id: "cli-0006",
      fullName: "Nadia Ferreira",
      email: "nadia.ferreira@example.invalid",
      phone: "06 39 98 00 06",
    },
    deliverySlot: { date: "2026-09-06", start: "16:00", end: "18:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75019",
    lines: [
      {
        productId: "prd-0015",
        productName: "Concombre",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 260,
      },
      {
        productId: "prd-0016",
        productName: "Poivron rouge",
        quantity: 3,
        unit: "piece",
        lineTotalCents: 540,
      },
      {
        productId: "prd-0006",
        productName: "Salade batavia",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 180,
      },
    ],
    totalCents: 980,
  },
  {
    id: "cmd-0007",
    reference: "FIG-260906-003",
    createdAt: "2026-09-06T07:50:00.000Z",
    status: "delivered",
    cancellation: null,
    customer: {
      id: "cli-0007",
      fullName: "Samuel Nkemelu",
      email: "samuel.nkemelu@example.invalid",
      phone: "06 39 98 00 07",
    },
    deliverySlot: { date: "2026-09-06", start: "09:00", end: "11:00" },
    deliveryCity: "Saint-Mandé",
    deliveryPostalCode: "94160",
    lines: [
      {
        productId: "prd-0001",
        productName: "Carottes",
        quantity: 500,
        unit: "g",
        lineTotalCents: 145,
      },
      {
        productId: "prd-0003",
        productName: "Bananes",
        quantity: 800,
        unit: "g",
        lineTotalCents: 200,
      },
      {
        productId: "prd-0002",
        productName: "Pommes Gala",
        quantity: 1000,
        unit: "g",
        lineTotalCents: 350,
      },
      {
        productId: "prd-0008",
        productName: "Citron",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 120,
      },
      {
        productId: "prd-0007",
        productName: "Avocat",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 300,
      },
    ],
    totalCents: 1115,
  },
  {
    id: "cmd-0008",
    reference: "FIG-260906-004",
    createdAt: "2026-09-06T11:40:00.000Z",
    status: "delivered",
    cancellation: null,
    customer: {
      id: "cli-0005",
      fullName: "Lucie Gauthier",
      email: "lucie.gauthier@example.invalid",
      phone: "06 39 98 00 05",
    },
    deliverySlot: { date: "2026-09-06", start: "11:00", end: "13:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75012",
    lines: [
      {
        productId: "prd-0009",
        productName: "Fraises (barquette)",
        quantity: 3,
        unit: "piece",
        lineTotalCents: 1050,
      },
      {
        productId: "prd-0013",
        productName: "Melon",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 780,
      },
    ],
    totalCents: 1830,
  },
  {
    id: "cmd-0009",
    reference: "FIG-260907-005",
    createdAt: "2026-09-07T12:05:00.000Z",
    status: "pending",
    cancellation: null,
    customer: {
      id: "cli-0008",
      fullName: "Élise Moreau",
      email: "elise.moreau@example.invalid",
      phone: "06 39 98 00 08",
    },
    deliverySlot: { date: "2026-09-08", start: "09:00", end: "11:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75003",
    lines: [
      {
        productId: "prd-0004",
        productName: "Tomates cœur de bœuf",
        quantity: 1200,
        unit: "g",
        lineTotalCents: 840,
      },
      {
        productId: "prd-0015",
        productName: "Concombre",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 130,
      },
      {
        productId: "prd-0006",
        productName: "Salade batavia",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 360,
      },
    ],
    totalCents: 1330,
  },
  {
    id: "cmd-0010",
    reference: "FIG-260907-006",
    createdAt: "2026-09-07T13:20:00.000Z",
    status: "pending",
    cancellation: null,
    customer: {
      id: "cli-0009",
      fullName: "Yanis Cohen",
      email: "yanis.cohen@example.invalid",
      phone: "06 39 98 00 09",
    },
    deliverySlot: { date: "2026-09-08", start: "11:00", end: "13:00" },
    deliveryCity: "Bagnolet",
    deliveryPostalCode: "93170",
    lines: [
      {
        productId: "prd-0010",
        productName: "Pommes de terre",
        quantity: 1500,
        unit: "g",
        lineTotalCents: 300,
      },
      {
        productId: "prd-0011",
        productName: "Oignons jaunes",
        quantity: 1000,
        unit: "g",
        lineTotalCents: 240,
      },
      {
        productId: "prd-0012",
        productName: "Poireaux",
        quantity: 500,
        unit: "g",
        lineTotalCents: 225,
      },
      {
        productId: "prd-0005",
        productName: "Courgettes",
        quantity: 900,
        unit: "g",
        lineTotalCents: 315,
      },
    ],
    totalCents: 1080,
  },
  {
    id: "cmd-0011",
    reference: "FIG-260907-007",
    createdAt: "2026-09-07T14:00:00.000Z",
    status: "confirmed",
    cancellation: null,
    customer: {
      id: "cli-0010",
      fullName: "Chloé Da Silva",
      email: "chloe.dasilva@example.invalid",
      phone: "06 39 98 00 10",
    },
    deliverySlot: { date: "2026-09-08", start: "14:00", end: "16:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75010",
    lines: [
      {
        productId: "prd-0014",
        productName: "Raisin",
        quantity: 500,
        unit: "g",
        lineTotalCents: 350,
      },
      {
        productId: "prd-0003",
        productName: "Bananes",
        quantity: 600,
        unit: "g",
        lineTotalCents: 150,
      },
    ],
    totalCents: 500,
  },
  {
    id: "cmd-0012",
    reference: "FIG-260907-008",
    createdAt: "2026-09-07T15:35:00.000Z",
    status: "confirmed",
    cancellation: null,
    customer: {
      id: "cli-0001",
      fullName: "Amel Benali",
      email: "amel.benali@example.invalid",
      phone: "06 39 98 00 01",
    },
    deliverySlot: { date: "2026-09-08", start: "16:00", end: "18:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75011",
    lines: [
      {
        productId: "prd-0007",
        productName: "Avocat",
        quantity: 4,
        unit: "piece",
        lineTotalCents: 600,
      },
      {
        productId: "prd-0008",
        productName: "Citron",
        quantity: 6,
        unit: "piece",
        lineTotalCents: 360,
      },
      {
        productId: "prd-0016",
        productName: "Poivron rouge",
        quantity: 2,
        unit: "piece",
        lineTotalCents: 360,
      },
      {
        productId: "prd-0004",
        productName: "Tomates cœur de bœuf",
        quantity: 500,
        unit: "g",
        lineTotalCents: 350,
      },
      {
        productId: "prd-0001",
        productName: "Carottes",
        quantity: 1000,
        unit: "g",
        lineTotalCents: 290,
      },
    ],
    totalCents: 1960,
  },
  {
    id: "cmd-0013",
    reference: "FIG-260907-009",
    createdAt: "2026-09-07T09:55:00.000Z",
    status: "cancelled",
    cancellation: { reason: "other", detail: "Client absent, injoignable" },
    customer: {
      id: "cli-0011",
      fullName: "Mathis Petit",
      email: "mathis.petit@example.invalid",
      phone: "06 39 98 00 11",
    },
    deliverySlot: { date: "2026-09-08", start: "09:00", end: "11:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75020",
    lines: [
      {
        productId: "prd-0013",
        productName: "Melon",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 390,
      },
      {
        productId: "prd-0009",
        productName: "Fraises (barquette)",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 350,
      },
    ],
    totalCents: 740,
  },
  {
    id: "cmd-0014",
    reference: "FIG-260907-010",
    createdAt: "2026-09-07T05:45:00.000Z",
    status: "delivering",
    cancellation: null,
    customer: {
      id: "cli-0012",
      fullName: "Sofia Haddad",
      email: "sofia.haddad@example.invalid",
      phone: "06 39 98 00 12",
    },
    deliverySlot: { date: "2026-09-07", start: "09:00", end: "11:00" },
    deliveryCity: "Paris",
    deliveryPostalCode: "75012",
    lines: [
      {
        productId: "prd-0002",
        productName: "Pommes Gala",
        quantity: 2000,
        unit: "g",
        lineTotalCents: 700,
      },
      {
        productId: "prd-0005",
        productName: "Courgettes",
        quantity: 400,
        unit: "g",
        lineTotalCents: 140,
      },
      {
        productId: "prd-0015",
        productName: "Concombre",
        quantity: 1,
        unit: "piece",
        lineTotalCents: 130,
      },
    ],
    totalCents: 970,
  },
];

/*
 * Affectations du scénario : la commande en préparation a son préparateur, les
 * deux en livraison leur livreur, les livrées de la veille les deux. Aucune
 * remise ni communauté dans le scénario : l'historique généré en porte.
 */
const ASSIGNMENTS: Record<string, Pick<Order, "preparer" | "driver">> = {
  "cmd-0003": { preparer: PREPARER_JULIEN, driver: null },
  "cmd-0004": { preparer: PREPARER_FATOU, driver: DRIVER_MALIK },
  "cmd-0005": { preparer: PREPARER_JULIEN, driver: DRIVER_SOPHIE },
  "cmd-0007": { preparer: PREPARER_JULIEN, driver: DRIVER_MALIK },
  "cmd-0008": { preparer: PREPARER_FATOU, driver: DRIVER_MALIK },
  "cmd-0014": { preparer: PREPARER_JULIEN, driver: DRIVER_MALIK },
};

export const scenarioOrders: readonly Order[] = seeds.map((seed) => ({
  ...seed,
  community: null,
  discount: null,
  ...(ASSIGNMENTS[seed.id] ?? { preparer: null, driver: null }),
}));
