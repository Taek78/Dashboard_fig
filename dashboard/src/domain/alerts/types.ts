import type { MessageSubject } from "@/domain/messages/subject";
import type { Product } from "@/domain/products/types";

/*
 * Alertes en direct du back-office (demande du 2026-09-18) : une nouvelle
 * commande, un nouveau message d'un client, un produit qui passe en stock
 * critique ou à 0. Le navigateur relève régulièrement le FLUX (AlertFeed,
 * GET /alertes) et le compare au relevé précédent (domain/alerts/rules.ts) :
 * seul ce qui est NOUVEAU depuis l'ouverture de la page déclenche une
 * notification. Rien n'est stocké en base pour ces alertes.
 */

/** Une commande récente, ce qu'il faut pour la notification. */
export type OrderAlertItem = {
  id: string;
  reference: string;
  customerName: string;
  totalCents: number;
  /** ISO 8601. */
  createdAt: string;
};

/** Un message « Nous contacter » récent. */
export type MessageAlertItem = {
  id: string;
  subject: MessageSubject;
  customerName: string;
  /** ISO 8601. */
  receivedAt: string;
};

/** Un produit sous son seuil de stock (critique ou à 0). */
export type StockAlertItem = Pick<
  Product,
  "id" | "name" | "unit" | "stockQuantity"
>;

/**
 * Le flux relevé par le navigateur. Chaque liste n'est remplie que pour un
 * rôle qui voit la section correspondante (sinon vide) ; `now` est l'horloge
 * du serveur, point de départ du relevé suivant.
 */
export type AlertFeed = {
  now: string;
  orders: OrderAlertItem[];
  messages: MessageAlertItem[];
  stock: StockAlertItem[];
};

/** Ce que le flux contient pour un rôle (sections qu'il peut ouvrir). */
export type AlertScope = {
  orders: boolean;
  messages: boolean;
  stock: boolean;
};

/** Nature d'une notification : elle donne sa couleur et son icône. */
export const ALERT_KINDS = [
  "order",
  "message",
  "stock_low",
  "stock_out",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type AlertNotice = {
  /** Unique : la même alerte n'est jamais affichée deux fois. */
  key: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Ce vers quoi mène un clic sur la notification. */
  href: string;
};

/** Niveau de stock suivi : seul un passage vers un niveau PIRE alerte. */
export type StockLevel = "ok" | "low" | "out";

/**
 * Ce que le navigateur retient entre deux relevés : les commandes et messages
 * déjà vus et le niveau de chaque produit sous son seuil. null = pas encore de
 * relevé (le premier sert de point de départ, sans notification).
 */
export type AlertWatch = {
  orders: ReadonlySet<string>;
  messages: ReadonlySet<string>;
  stock: ReadonlyMap<string, Exclude<StockLevel, "ok">>;
} | null;

/** Relevé toutes les 5 s quand l'onglet est visible. */
export const ALERT_POLL_MS = 5_000;
/**
 * Onglet caché ou fenêtre réduite : toutes les 15 s (le navigateur peut
 * espacer davantage), pour que la barre des tâches signale quand même une
 * nouveauté (demande du 2026-09-18).
 */
export const ALERT_HIDDEN_POLL_MS = 15_000;
/** Durée d'affichage d'une notification (demande : 4 s). */
export const ALERT_DISPLAY_MS = 4_000;
/**
 * Recouvrement entre deux relevés : une ligne créée juste avant l'instant du
 * relevé précédent mais validée après reste attrapée ; les doublons sont
 * écartés par les identifiants déjà vus.
 */
export const ALERT_OVERLAP_MS = 60_000;
/** Un relevé ne remonte jamais plus loin (paramètre ?depuis= borné). */
export const ALERT_MAX_LOOKBACK_MS = 10 * 60_000;
/** Au plus tant de commandes et de messages par relevé. */
export const ALERT_FEED_LIMIT = 20;
