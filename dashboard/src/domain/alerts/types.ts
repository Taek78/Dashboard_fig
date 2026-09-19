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

/**
 * Une commande récente, ce qu'il faut pour la notification : le client, le
 * total et l'adresse de livraison (ou de retrait), sans la référence
 * (demande du 2026-09-19).
 */
export type OrderAlertItem = {
  id: string;
  customerName: string;
  totalCents: number;
  addressLine: string | null;
  postalCode: string;
  city: string;
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
  /** Compteurs du menu : nouveautés depuis la dernière visite de chaque section. */
  unread: UnreadCounts;
  /** Préférences du compte : le navigateur y règle notification et son. */
  prefs: AlertPrefs;
};

/*
 * Compteurs NON LUS du menu (demande du 2026-09-18) : commandes créées et
 * messages reçus depuis la dernière visite de la section, produits passés en
 * stock critique ou à 0 (modifiés) depuis la dernière visite du catalogue.
 * La dernière visite est enregistrée sur le compte (users.*_seen_at) : les
 * compteurs survivent au rechargement et suivent la personne d'un poste à
 * l'autre. 0 pour ce que le rôle ou les préférences excluent.
 */
export type UnreadCounts = { orders: number; messages: number; stock: number };

/** Les trois fils suivis ; chacun a sa section du menu et sa dernière visite. */
export const ALERT_KINDS_READ = ["orders", "messages", "stock"] as const;
export type AlertReadKind = (typeof ALERT_KINDS_READ)[number];

/** Section du menu de chaque fil (son compteur s'affiche à côté). */
export const SECTION_OF_READ_KIND: Record<AlertReadKind, string> = {
  orders: "/commandes",
  messages: "/messages",
  stock: "/catalogue",
};

/**
 * Préférences cochées dans « Mon profil » (2026-09-18) : notifications de
 * commandes et de messages, et « Désactiver le son ». Décochée, une
 * notification ne produit plus ni bandeau, ni son, ni notification système ;
 * les COMPTEURS du menu et les badges « Nouveau » des cartes restent, eux,
 * toujours actifs. `muted` coupe le son seul ; il retombe à faux quand les
 * deux notifications sont désactivées (il n'y a plus rien à faire sonner).
 */
export type AlertPrefs = { orders: boolean; messages: boolean; muted: boolean };
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  orders: true,
  messages: true,
  muted: false,
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
  /** Texte d'une ligne : notification système, lecteurs d'écran. */
  body: string;
  /**
   * UNE commande : ce que la notification met en forme (nom en clair, total
   * en grand, adresse). Absent pour un regroupement ou une autre nature.
   */
  order?: { customerName: string; total: string; address: string };
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
/** Durée d'affichage d'une notification (demande du 2026-09-19 : 15 s). */
export const ALERT_DISPLAY_MS = 15_000;
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
