import { communitiesFixtures } from "@/domain/communities/fixtures";
import type { Community, CommunityRef } from "@/domain/communities/types";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD,
} from "@/domain/customers/loyalty";
import { scenarioCustomers } from "@/domain/customers/scenario";
import type { Customer } from "@/domain/customers/types";
import type { StaffRef } from "@/domain/orders/assignment";
import type { Cancellation } from "@/domain/orders/cancellation";
import {
  discountAmountCents,
  type OrderDiscount,
} from "@/domain/orders/discount";
import { scenarioOrders } from "@/domain/orders/scenario";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order, OrderLine } from "@/domain/orders/types";
import { productsFixtures } from "@/domain/products/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";
import { staffFullName } from "@/domain/staff/rules";
import type { StaffMember } from "@/domain/staff/types";

/*
 * Historique factice réaliste sur deux ans (N-1 et N), du 1er janvier 2025 au
 * 14 septembre 2026, généré de façon DÉTERMINISTE (générateur pseudo-aléatoire
 * à graine fixe : le même jeu à chaque exécution, sous Vitest comme au seed).
 *
 * Réalisme visé :
 * - volume qui croît doucement (≈ 3 commandes par jour début 2025, ≈ 9 fin
 *   2026), plus fort du jeudi au samedi, faible le dimanche, creux en août ;
 * - une clientèle de fond (les douze clients du scénario, très fidèles) et une
 *   centaine de clients générés dont quelques-uns commandent souvent ;
 * - produits de saison plus présents (fruits d'été de mai à septembre, légumes
 *   d'hiver d'octobre à mars), paniers de 2 à 5 lignes, prix du catalogue ;
 * - statuts vraisemblables : le passé est livré (5 % d'annulations motivées),
 *   la journée en cours est en préparation ou expédiée ;
 * - l'équipe (src/domain/staff/fixtures.ts) affectée aux commandes à partir
 *   de la date d'entrée de chacun : préparateur dès la préparation, livreur
 *   dès la livraison ;
 * - trois communautés (src/domain/communities/fixtures.ts) dont les membres
 *   sont livrés au point de retrait avec la remise de la communauté ;
 * - la fidélité : après huit commandes d'affilée, la suivante porte la remise
 *   de 15 % (src/domain/customers/loyalty.ts), hors communautés.
 *
 * La fenêtre du 5 au 9 septembre 2026 est laissée aux commandes du scénario
 * (src/domain/orders/scenario.ts), écrites à la main pour les tests et la démo.
 * Aucune personne réelle : e-mails en @example.invalid, téléphones dans la
 * tranche de fiction 06 39 98 xx xx, adresses réduites à ville et code postal.
 */
export const HISTORY_FROM = "2025-01-01";
export const HISTORY_TO = "2026-09-14";
/** Jours réservés au scénario : aucune commande générée. */
export const SCENARIO_WINDOW = { from: "2026-09-05", to: "2026-09-09" };

/* ---------- Générateur pseudo-aléatoire déterministe (mulberry32) ---------- */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Dates (chaînes AAAA-MM-JJ, calcul en UTC) ---------- */
const DAY_MS = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) =>
  toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/* ---------- Clientèle générée ---------- */
const FIRST_NAMES = [
  "Inès",
  "Karim",
  "Léa",
  "Mathis",
  "Nora",
  "Yanis",
  "Chloé",
  "Sofiane",
  "Manon",
  "Adam",
  "Jade",
  "Rayan",
  "Louise",
  "Ibrahim",
  "Camille",
  "Noah",
  "Sarah",
  "Hugo",
  "Lina",
  "Enzo",
  "Zoé",
  "Mehdi",
  "Alice",
  "Tom",
  "Maya",
  "Louis",
  "Anna",
  "Bilal",
  "Rose",
  "Samuel",
  "Ambre",
  "Nathan",
  "Farah",
  "Jules",
  "Lucie",
  "Ismaël",
  "Eva",
  "Gabriel",
  "Salma",
  "Paul",
];
const LAST_NAMES = [
  "Martin",
  "Bernard",
  "Haddad",
  "Petit",
  "Nguyen",
  "Durand",
  "Diallo",
  "Moreau",
  "Kaci",
  "Laurent",
  "Ferreira",
  "Simon",
  "Bensaïd",
  "Michel",
  "Okafor",
  "Garcia",
  "Roux",
  "Cohen",
  "Fontaine",
  "Traoré",
  "Chevalier",
  "Lopez",
  "Mercier",
  "Gauthier",
  "Yildiz",
  "Robin",
  "Rossi",
  "Lambert",
  "Ndiaye",
  "Girard",
];
const CITIES = [
  ["75001", "Paris"],
  ["75003", "Paris"],
  ["75004", "Paris"],
  ["75005", "Paris"],
  ["75009", "Paris"],
  ["75010", "Paris"],
  ["75011", "Paris"],
  ["75012", "Paris"],
  ["75013", "Paris"],
  ["75014", "Paris"],
  ["75015", "Paris"],
  ["75017", "Paris"],
  ["75018", "Paris"],
  ["75019", "Paris"],
  ["75020", "Paris"],
  ["92100", "Boulogne-Billancourt"],
  ["92130", "Issy-les-Moulineaux"],
  ["92170", "Vanves"],
  ["92300", "Levallois-Perret"],
  ["93100", "Montreuil"],
  ["93170", "Bagnolet"],
  ["93260", "Les Lilas"],
  ["93500", "Pantin"],
  ["94120", "Fontenay-sous-Bois"],
  ["94160", "Saint-Mandé"],
  ["94200", "Ivry-sur-Seine"],
  ["94300", "Vincennes"],
] as const;

/**
 * Membres des communautés : rangs (parmi les 110 clients générés) rattachés à
 * chaque communauté. Les autres clients sont des particuliers.
 */
const COMMUNITY_MEMBER_RANKS: Record<string, readonly number[]> = {
  "com-0001": [20, 21, 22, 23, 24, 25, 26, 27, 28],
  "com-0002": [40, 41, 42, 43, 44, 45, 46, 47],
  "com-0003": [70, 71, 72, 73, 74, 75, 76],
};

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ /g, "")
    .toLowerCase();
}

type Draft = Omit<Customer, "createdAt" | "notes" | "anonymizedAt"> & {
  weight: number;
};

function communityFor(rank: number): Community | null {
  for (const community of communitiesFixtures) {
    if (COMMUNITY_MEMBER_RANKS[community.id]?.includes(rank)) return community;
  }
  return null;
}

function buildCustomers(random: () => number): Draft[] {
  const drafts: Draft[] = scenarioCustomers.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    city: c.city,
    postalCode: c.postalCode,
    community: null,
    // Les clients du scénario sont la clientèle fidèle de départ.
    weight: 4,
  }));
  const seen = new Set(drafts.map((d) => d.email));
  for (let i = 0; i < 110; i += 1) {
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]!;
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]!;
    let email = `${slug(first)}.${slug(last)}@example.invalid`;
    let suffix = 2;
    while (seen.has(email)) {
      email = `${slug(first)}.${slug(last)}${suffix}@example.invalid`;
      suffix += 1;
    }
    seen.add(email);
    const [postalCode, city] = CITIES[Math.floor(random() * CITIES.length)]!;
    const n = 100 + i; // 06 39 98 01 00 … : tranche réservée à la fiction
    const community = communityFor(i);
    drafts.push({
      id: `cli-g-${pad(i + 1, 3)}`,
      fullName: `${first} ${last}`,
      email,
      phone: `06 39 98 ${pad(Math.floor(n / 100))} ${pad(n % 100)}`,
      city,
      postalCode,
      community: community ? { id: community.id, name: community.name } : null,
      // Quelques clients très réguliers, beaucoup d'occasionnels ; les membres
      // d'une communauté commandent régulièrement.
      weight: community ? 1.2 + random() : 0.3 + 3 * random() ** 2,
    });
  }
  return drafts;
}

/* ---------- Saisonnalité des produits ---------- */
const SUMMER = new Set(["🍓", "🍑", "🍒", "🍈", "🍇", "🍅", "🥒", "🫑"]);
const WINTER = new Set(["🍊", "🍐", "🥬", "🥔", "🧅", "🌱", "🥕"]);

function productWeight(illustration: string, month: number): number {
  const summer = month >= 5 && month <= 9;
  const winter = month >= 10 || month <= 3;
  if (SUMMER.has(illustration)) return summer ? 2.2 : 0.35;
  if (WINTER.has(illustration)) return winter ? 1.8 : 0.8;
  return 1;
}

function pickWeighted<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: () => number,
): T {
  const total = items.reduce((s, item) => s + weight(item), 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= weight(item);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1]!;
}

const SLOTS = [
  ["09:00", "11:00"],
  ["11:00", "13:00"],
  ["14:00", "16:00"],
  ["16:00", "18:00"],
  ["18:00", "20:00"],
] as const;
const GRAMS = [500, 750, 1000, 1500, 2000, 3000];
const OTHER_DETAILS = [
  "Client absent au créneau convenu",
  "Adresse introuvable, client injoignable",
  "Doublon de commande signalé par le client",
  "Commande passée par erreur",
];

function buildLines(month: number, random: () => number): OrderLine[] {
  const count = 2 + Math.floor(random() * 4); // 2 à 5 lignes
  const chosen = new Set<string>();
  const lines: OrderLine[] = [];
  while (lines.length < count) {
    const product = pickWeighted(
      productsFixtures,
      (p) => productWeight(p.illustration, month),
      random,
    );
    if (chosen.has(product.id)) continue;
    chosen.add(product.id);
    const quantity =
      product.unit === "g"
        ? GRAMS[Math.floor(random() * GRAMS.length)]!
        : 1 + Math.floor(random() * 6);
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unit: product.unit,
      lineTotalCents:
        product.unit === "g"
          ? Math.round((product.priceCents * quantity) / 1000)
          : product.priceCents * quantity,
    });
  }
  return lines;
}

/** Nombre de commandes attendu un jour donné : tendance, semaine, saison, bruit. */
function dailyVolume(
  iso: string,
  progress: number,
  random: () => number,
): number {
  const date = toDate(iso);
  const weekday = date.getUTCDay(); // 0 = dimanche
  const month = date.getUTCMonth() + 1;
  const base = 3 + 6.5 * progress;
  const weekly = [0.3, 0.8, 1, 1, 1.1, 1.3, 1.4][weekday]!;
  const seasonal =
    month === 8 ? 0.7 : month === 12 ? 1.15 : month === 1 ? 0.85 : 1;
  return Math.round(base * weekly * seasonal * (0.8 + 0.4 * random()));
}

function statusFor(
  iso: string,
  random: () => number,
): { status: OrderStatus; cancellation: Cancellation | null } {
  if (iso < HISTORY_TO) {
    if (random() < 0.05) {
      const r = random();
      const reason = r < 0.4 ? "stock" : r < 0.8 ? "delivery" : "other";
      return {
        status: "cancelled",
        cancellation: {
          reason,
          detail:
            reason === "other"
              ? OTHER_DETAILS[Math.floor(random() * OTHER_DETAILS.length)]!
              : null,
        },
      };
    }
    return { status: "delivered", cancellation: null };
  }
  const r = random();
  const status: OrderStatus = r < 0.65 ? "preparing" : "delivering";
  return { status, cancellation: null };
}

/* ---------- Équipe ---------- */
const PREPARED_STATUSES: readonly OrderStatus[] = [
  "preparing",
  "delivering",
  "delivered",
];
const DRIVEN_STATUSES: readonly OrderStatus[] = ["delivering", "delivered"];
/** Une personne inactive n'est plus affectée à partir de cette date (départ). */
const INACTIVE_UNTIL = "2026-03-01";

function toRef(member: StaffMember): StaffRef {
  return { id: member.id, name: staffFullName(member) };
}

/** Une personne du métier, entrée dans l'équipe avant ce jour ; null sinon. */
function pickStaff(
  kind: StaffMember["kind"],
  day: string,
  random: () => number,
): StaffRef | null {
  const pool = staffFixtures.filter(
    (m) =>
      m.kind === kind &&
      m.startedAt <= day &&
      (m.active || day < INACTIVE_UNTIL),
  );
  if (pool.length === 0) return null;
  return toRef(pool[Math.floor(random() * pool.length)]!);
}

/* ---------- Fidélité ---------- */
/**
 * Seconde passe : pour chaque client hors communauté, rejoue ses commandes
 * dans l'ordre de passation (createdAt, la règle de loyaltyStatus) et pose la
 * remise fidélité sur la commande qui suit huit commandes d'affilée. Modifie
 * les commandes en place (discount et totalCents).
 */
function applyLoyalty(orders: Order[]): void {
  const byCustomer = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.community) continue;
    byCustomer.set(o.customer.id, [
      ...(byCustomer.get(o.customer.id) ?? []),
      o,
    ]);
  }
  for (const list of byCustomer.values()) {
    let streak = 0;
    for (const o of list.toSorted(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )) {
      if (streak >= LOYALTY_THRESHOLD) {
        const subtotal = o.totalCents;
        o.discount = {
          kind: "loyalty",
          percent: LOYALTY_DISCOUNT_PERCENT,
          amountCents: discountAmountCents(subtotal, LOYALTY_DISCOUNT_PERCENT),
        };
        o.totalCents = subtotal - o.discount.amountCents;
        streak = 0;
      } else if (o.status === "cancelled") {
        streak = 0;
      } else {
        streak += 1;
      }
    }
  }
}

/* ---------- Construction ---------- */
function build(): { customers: Customer[]; orders: Order[] } {
  const random = rng(20260914);
  const drafts = buildCustomers(random);
  const orders: Order[] = [];
  const firstOrderDate = new Map<string, string>();
  const totalDays =
    (toDate(HISTORY_TO).getTime() - toDate(HISTORY_FROM).getTime()) / DAY_MS;
  let index = 0;

  for (let day = HISTORY_FROM; day <= HISTORY_TO; day = addDays(day, 1)) {
    if (day >= SCENARIO_WINDOW.from && day <= SCENARIO_WINDOW.to) continue;
    const progress =
      (toDate(day).getTime() - toDate(HISTORY_FROM).getTime()) /
      DAY_MS /
      totalDays;
    const volume = dailyVolume(day, progress, random);
    const month = toDate(day).getUTCMonth() + 1;
    for (let seq = 1; seq <= volume; seq += 1) {
      const customer = pickWeighted(drafts, (d) => d.weight, random);
      const community = customer.community
        ? (communitiesFixtures.find((c) => c.id === customer.community?.id) ??
          null)
        : null;
      // Le créneau est choisi à chaque commande dans l'application, retrait
      // en communauté compris ; pour un membre il est tiré sans consommer
      // l'aléa, pour garder le reste du jeu de données identique.
      const [start, end] = community
        ? SLOTS[(index + seq) % SLOTS.length]!
        : SLOTS[Math.floor(random() * SLOTS.length)]!;
      const slot = { start, end };
      const createdDay = addDays(day, -(1 + Math.floor(random() * 3)));
      const createdHour = 7 + Math.floor(random() * 14);
      const lines = buildLines(month, random);
      const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
      const { status, cancellation } = statusFor(day, random);

      // Remise de communauté ici ; la fidélité est posée en seconde passe
      // (applyLoyalty), dans l'ordre où les commandes ont été passées.
      const discount: OrderDiscount | null = community
        ? {
            kind: "community",
            percent: community.discountPercent,
            amountCents: discountAmountCents(
              subtotal,
              community.discountPercent,
            ),
          }
        : null;

      index += 1;
      if (!firstOrderDate.has(customer.id))
        firstOrderDate.set(customer.id, createdDay);
      const communityRef: CommunityRef | null = community
        ? { id: community.id, name: community.name }
        : null;
      orders.push({
        id: `cmd-g-${pad(index, 5)}`,
        reference: `FIG-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-${pad(seq, 3)}`,
        createdAt: `${createdDay}T${pad(createdHour)}:${pad(Math.floor(random() * 60))}:00.000Z`,
        status,
        cancellation,
        customer: {
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
        },
        deliverySlot: { date: day, start: slot.start, end: slot.end },
        deliveryCity: community ? community.pickupCity : customer.city,
        deliveryPostalCode: community
          ? community.pickupPostalCode
          : customer.postalCode,
        lines,
        totalCents: subtotal - (discount?.amountCents ?? 0),
        community: communityRef,
        discount,
        preparer: PREPARED_STATUSES.includes(status)
          ? pickStaff("preparateur", day, random)
          : null,
        driver: DRIVEN_STATUSES.includes(status)
          ? pickStaff("livreur", day, random)
          : null,
      });
    }
  }

  applyLoyalty(orders);

  // Seuls les clients générés ayant commandé existent ; créés peu avant leur première commande.
  const scenarioIds = new Set(scenarioCustomers.map((c) => c.id));
  const customers: Customer[] = drafts
    .filter((d) => !scenarioIds.has(d.id) && firstOrderDate.has(d.id))
    .map((d) => ({
      id: d.id,
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      city: d.city,
      postalCode: d.postalCode,
      createdAt: `${addDays(firstOrderDate.get(d.id)!, -(5 + Math.floor(random() * 55)))}T09:00:00.000Z`,
      community: d.community,
      notes: [],
      anonymizedAt: null,
    }));
  return { customers, orders };
}

const history = build();

/** Clients générés (hors les douze du scénario), tous avec au moins une commande. */
export const generatedCustomers: readonly Customer[] = history.customers;
/** Commandes générées sur deux ans, hors fenêtre du scénario. */
export const generatedOrders: readonly Order[] = history.orders;

/** Les commandes du scénario comprises : vérifie qu'aucune n'est en double. */
export const historyOrderCount = generatedOrders.length + scenarioOrders.length;
