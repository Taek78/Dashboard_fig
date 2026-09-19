import type {
  AlertFeed,
  AlertKind,
  AlertPrefs,
  AlertReadKind,
  AlertNotice,
  AlertWatch,
  MessageAlertItem,
  OrderAlertItem,
  StockAlertItem,
  StockLevel,
} from "@/domain/alerts/types";
import { MESSAGE_SUBJECT_LABELS } from "@/domain/messages/subject";
import { isLowStock } from "@/domain/products/rules";
import { formatEuros, formatQuantity } from "@/lib/format";

/*
 * Règles pures des alertes en direct, testées dans
 * test/domain/alerts/rules.test.ts : niveau de stock, texte de chaque
 * notification, et comparaison d'un relevé avec le précédent (readAlertFeed).
 * Aucun module zod ici : le composant client qui relève le flux importe ce
 * fichier.
 */

/** À 0 (ou moins) : rupture ; sous le seuil de son unité : critique ; sinon normal. */
export function stockLevel(
  product: Pick<StockAlertItem, "unit" | "stockQuantity">,
): StockLevel {
  if (product.stockQuantity <= 0) return "out";
  return isLowStock(product) ? "low" : "ok";
}

const LEVEL_RANK: Record<StockLevel, number> = { ok: 0, low: 1, out: 2 };

/** « 12 rue des Lilas, 75011 Paris » ; sans rue connue, « 75011 Paris ». */
export function orderAlertAddress(
  order: Pick<OrderAlertItem, "addressLine" | "postalCode" | "city">,
): string {
  return `${order.addressLine ? `${order.addressLine}, ` : ""}${order.postalCode} ${order.city}`;
}

/** Une commande : le client, le total et l'adresse ; plus la référence (2026-09-19). */
export function orderNotice(order: OrderAlertItem): AlertNotice {
  const total = formatEuros(order.totalCents);
  const address = orderAlertAddress(order);
  return {
    key: `order:${order.id}`,
    kind: "order",
    title: "Nouvelle commande",
    body: `${order.customerName} · ${total} · ${address}`,
    order: { customerName: order.customerName, total, address },
    href: `/commandes/${order.id}`,
  };
}

export function messageNotice(message: MessageAlertItem): AlertNotice {
  return {
    key: `message:${message.id}`,
    kind: "message",
    title: "Nouveau message client",
    body: `${MESSAGE_SUBJECT_LABELS[message.subject]} · ${message.customerName}`,
    href: `/messages/${message.id}`,
  };
}

/** Un produit qui vient de passer en stock critique ou à 0. */
export function stockNotice(
  product: StockAlertItem,
  level: Exclude<StockLevel, "ok">,
): AlertNotice {
  return level === "out"
    ? {
        key: `stock_out:${product.id}`,
        kind: "stock_out",
        title: "Rupture de stock",
        body: `${product.name} : stock à 0`,
        href: `/catalogue/${product.id}`,
      }
    : {
        key: `stock_low:${product.id}:${product.stockQuantity}`,
        kind: "stock_low",
        title: "Stock critique",
        body: `${product.name} : plus que ${formatQuantity(product.stockQuantity, product.unit)}`,
        href: `/catalogue/${product.id}`,
      };
}

/**
 * Compare un relevé au précédent. Le PREMIER relevé (watch null) sert de point
 * de départ : tout ce qu'il contient est déjà là à l'ouverture de la page, rien
 * n'est notifié. Ensuite :
 * - une commande ou un message jamais vu → une notification, du plus ancien au
 *   plus récent ;
 * - un produit dont le niveau EMPIRE (normal → critique → rupture, ou normal →
 *   rupture) → une notification ; un stock qui remonte ne dit rien, mais il
 *   pourra réalerter s'il redescend.
 * Le nouvel état ne retient que ce que le relevé contient : il reste borné, et
 * le recouvrement des relevés (ALERT_OVERLAP_MS) évite de rater une ligne.
 */
export function readAlertFeed(
  watch: AlertWatch,
  feed: Pick<AlertFeed, "orders" | "messages" | "stock">,
): { watch: NonNullable<AlertWatch>; notices: AlertNotice[] } {
  const stock = new Map<string, Exclude<StockLevel, "ok">>();
  for (const product of feed.stock) {
    const level = stockLevel(product);
    if (level !== "ok") stock.set(product.id, level);
  }
  const next = {
    orders: new Set(feed.orders.map((o) => o.id)),
    messages: new Set(feed.messages.map((m) => m.id)),
    stock,
  };
  if (watch === null) return { watch: next, notices: [] };

  const notices: AlertNotice[] = [
    ...feed.orders
      .filter((o) => !watch.orders.has(o.id))
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(orderNotice),
    ...feed.messages
      .filter((m) => !watch.messages.has(m.id))
      .toSorted((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      .map(messageNotice),
    ...feed.stock.flatMap((product) => {
      const level = stock.get(product.id);
      const before = watch.stock.get(product.id) ?? "ok";
      return level !== undefined && LEVEL_RANK[level] > LEVEL_RANK[before]
        ? [stockNotice(product, level)]
        : [];
    }),
  ];
  return { watch: next, notices };
}

/* ---------- Une seule notification (demande du 2026-09-18) ---------- */

/** Ordre d'importance : la couleur d'une notification groupée est celle de la plus importante. */
const KIND_PRIORITY: readonly AlertKind[] = [
  "order",
  "stock_out",
  "message",
  "stock_low",
];

const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`;

/** « A, B, C et 2 autres » : trois éléments au plus, puis le reste compté. */
function shortList(items: readonly string[]): string {
  const shown = items.slice(0, 3).join(", ");
  const rest = items.length - 3;
  return rest > 0 ? `${shown} et ${plural(rest, "autre", "autres")}` : shown;
}

/**
 * Toutes les nouveautés en UNE notification : une seule s'affiche à la fois,
 * qu'il arrive 1, 2 ou 5 commandes. Seule, une nouveauté garde son texte et son
 * lien ; plusieurs de même nature se comptent (« 3 nouvelles commandes », lien
 * vers la liste) ; de natures mêlées, le titre compte tout et le détail
 * ventile (« 2 commandes · 1 message · 1 alerte de stock »). La couleur et le
 * lien sont ceux de la nature la plus importante (commande, rupture, message,
 * stock critique).
 */
export function summarizeNotices(
  notices: readonly AlertNotice[],
): AlertNotice | null {
  if (notices.length === 0) return null;
  if (notices.length === 1) return notices[0]!;
  const of = (kinds: readonly AlertKind[]) =>
    notices.filter((n) => kinds.includes(n.kind));
  const orders = of(["order"]);
  const messages = of(["message"]);
  const stock = of(["stock_low", "stock_out"]);
  const kind = KIND_PRIORITY.find((k) => notices.some((n) => n.kind === k))!;
  const key = notices.map((n) => n.key).join("|");
  const href =
    orders.length > 0
      ? "/commandes"
      : messages.length > 0
        ? "/messages"
        : "/catalogue";
  // Plusieurs commandes : les noms des clients.
  const customerName = (n: AlertNotice) =>
    n.order?.customerName ?? n.body.split(" · ")[0]!;
  const productName = (n: AlertNotice) => n.body.split(" : ")[0]!;

  if (orders.length === notices.length) {
    return {
      key,
      kind,
      title: plural(orders.length, "nouvelle commande", "nouvelles commandes"),
      body: shortList(orders.map(customerName)),
      href,
    };
  }
  if (messages.length === notices.length) {
    return {
      key,
      kind,
      title: plural(
        messages.length,
        "nouveau message client",
        "nouveaux messages clients",
      ),
      body: shortList(messages.map((n) => n.body)),
      href,
    };
  }
  if (stock.length === notices.length) {
    return {
      key,
      kind,
      title: plural(stock.length, "alerte de stock", "alertes de stock"),
      body: shortList(stock.map(productName)),
      href,
    };
  }
  const parts = [
    orders.length > 0 ? plural(orders.length, "commande", "commandes") : null,
    messages.length > 0 ? plural(messages.length, "message", "messages") : null,
    stock.length > 0
      ? plural(stock.length, "alerte de stock", "alertes de stock")
      : null,
  ].filter((part): part is string => part !== null);
  return {
    key,
    kind,
    title: plural(notices.length, "nouveauté", "nouveautés"),
    body: parts.join(" · "),
    href,
  };
}

/** Vrai si une notification annonce une commande : c'est elle qui sonne. */
export function hasOrderNotice(notices: readonly AlertNotice[]): boolean {
  return notices.some((n) => n.kind === "order");
}

/* ---------- Préférences et compteurs non lus ---------- */

/**
 * Les nouveautés qui méritent une NOTIFICATION (bandeau, son, notification
 * système) selon les préférences du compte : commandes et messages selon
 * leur case, le stock toujours. Les compteurs et badges « Nouveau » ne passent
 * pas par ici : ils restent actifs quoi qu'il arrive.
 */
export function noticesForPrefs(
  notices: readonly AlertNotice[],
  prefs: Pick<AlertPrefs, "orders" | "messages">,
): AlertNotice[] {
  return notices.filter(
    (n) =>
      (n.kind !== "order" || prefs.orders) &&
      (n.kind !== "message" || prefs.messages),
  );
}

/** Le fil dont une section du menu porte le compteur ; null pour les autres sections. */
export function readKindOfSection(href: string): AlertReadKind | null {
  if (href === "/commandes") return "orders";
  if (href === "/messages") return "messages";
  if (href === "/catalogue") return "stock";
  return null;
}

/** Ce que désigne une notification de commande ou de message (badge « Nouveau ») ; null pour le stock. */
export function noticeTarget(
  notice: Pick<AlertNotice, "kind" | "key">,
): { kind: "orders" | "messages"; id: string } | null {
  if (notice.kind === "order") {
    return { kind: "orders", id: notice.key.slice("order:".length) };
  }
  if (notice.kind === "message") {
    return { kind: "messages", id: notice.key.slice("message:".length) };
  }
  return null;
}

/**
 * La page affichée liste-t-elle ces nouveautés (pour la rafraîchir quand il
 * en arrive) ? Commandes : la liste et le tableau de bord (commandes en
 * préparation) ; messages : la boîte de réception. Jamais une fiche ou un
 * formulaire, pour ne rien déranger.
 */
export function listShows(
  pathname: string,
  kind: "orders" | "messages",
): boolean {
  return kind === "orders"
    ? pathname === "/" || pathname === "/commandes"
    : pathname === "/messages";
}
