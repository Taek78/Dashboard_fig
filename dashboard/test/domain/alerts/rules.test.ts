import { describe, expect, it } from "vitest";
import {
  hasOrderNotice,
  messageNotice,
  orderNotice,
  readAlertFeed,
  stockLevel,
  stockNotice,
  listShows,
  noticesForPrefs,
  noticeTarget,
  readKindOfSection,
  summarizeNotices,
} from "@/domain/alerts/rules";
import type {
  MessageAlertItem,
  OrderAlertItem,
  StockAlertItem,
} from "@/domain/alerts/types";
import { formatEuros } from "@/lib/format";

const order = (id: string, createdAt: string): OrderAlertItem => ({
  id,
  customerName: `Client ${id}`,
  totalCents: 2490,
  addressLine: "12 rue des Lilas",
  postalCode: "75011",
  city: "Paris",
  createdAt,
});
const message = (id: string, receivedAt: string): MessageAlertItem => ({
  id,
  subject: "missing_or_damaged",
  customerName: "Camille Martin",
  receivedAt,
});
const product = (
  id: string,
  stockQuantity: number,
  unit: StockAlertItem["unit"] = "piece",
): StockAlertItem => ({ id, name: `Produit ${id}`, unit, stockQuantity });

const empty = { orders: [], messages: [], stock: [] };

describe("stockLevel", () => {
  it("0 = rupture, sous le seuil de l'unité = critique, sinon normal", () => {
    expect(stockLevel(product("a", 0))).toBe("out");
    expect(stockLevel(product("a", 9))).toBe("low");
    expect(stockLevel(product("a", 10))).toBe("ok");
    expect(stockLevel(product("a", 1999, "g"))).toBe("low");
    expect(stockLevel(product("a", 2000, "g"))).toBe("ok");
  });
});

describe("textes des notifications", () => {
  it("commande : client, total et adresse, sans la référence ; lien vers la commande", () => {
    expect(orderNotice(order("001", "2026-09-18T10:00:00Z"))).toEqual({
      key: "order:001",
      kind: "order",
      title: "Nouvelle commande",
      body: `Client 001 · ${formatEuros(2490)} · 12 rue des Lilas, 75011 Paris`,
      order: {
        customerName: "Client 001",
        total: formatEuros(2490),
        address: "12 rue des Lilas, 75011 Paris",
      },
      href: "/commandes/001",
    });
  });

  it("message : objet et client ; lien vers le message", () => {
    expect(
      messageNotice(message("msg-1", "2026-09-18T10:00:00Z")),
    ).toMatchObject({
      kind: "message",
      title: "Nouveau message client",
      body: "Produit manquant ou abîmé · Camille Martin",
      href: "/messages/msg-1",
    });
  });

  it("stock : critique avec la quantité restante, rupture à 0 ; lien vers le produit", () => {
    expect(stockNotice(product("p1", 3), "low")).toMatchObject({
      kind: "stock_low",
      title: "Stock critique",
      body: "Produit p1 : plus que 3 pièces",
      href: "/catalogue/p1",
    });
    expect(stockNotice(product("p1", 0), "out")).toMatchObject({
      kind: "stock_out",
      title: "Rupture de stock",
      body: "Produit p1 : stock à 0",
    });
  });
});

describe("readAlertFeed", () => {
  it("le premier relevé est un point de départ : rien n'est notifié", () => {
    const { notices, watch } = readAlertFeed(null, {
      orders: [order("1", "2026-09-18T10:00:00Z")],
      messages: [message("m", "2026-09-18T10:00:00Z")],
      stock: [product("p", 0)],
    });
    expect(notices).toEqual([]);
    expect([...watch.orders]).toEqual(["1"]);
    expect(watch.stock.get("p")).toBe("out");
  });

  it("notifie ce qui n'a jamais été vu, du plus ancien au plus récent, commandes puis messages", () => {
    const first = readAlertFeed(null, {
      ...empty,
      orders: [order("1", "2026-09-18T10:00:00Z")],
    });
    const { notices } = readAlertFeed(first.watch, {
      orders: [
        order("3", "2026-09-18T10:00:20Z"),
        order("2", "2026-09-18T10:00:10Z"),
        order("1", "2026-09-18T10:00:00Z"),
      ],
      messages: [message("m", "2026-09-18T10:00:05Z")],
      stock: [],
    });
    expect(notices.map((n) => n.key)).toEqual([
      "order:2",
      "order:3",
      "message:m",
    ]);
    expect(hasOrderNotice(notices)).toBe(true);
    expect(hasOrderNotice(notices.filter((n) => n.kind !== "order"))).toBe(
      false,
    );
  });

  it("stock : seul un niveau qui EMPIRE alerte ; remonté, il peut réalerter", () => {
    const start = readAlertFeed(null, empty).watch;
    const low = readAlertFeed(start, { ...empty, stock: [product("p", 5)] });
    expect(low.notices.map((n) => n.kind)).toEqual(["stock_low"]);
    // Toujours critique, même à une autre quantité : rien.
    const lower = readAlertFeed(low.watch, {
      ...empty,
      stock: [product("p", 4)],
    });
    expect(lower.notices).toEqual([]);
    const out = readAlertFeed(lower.watch, {
      ...empty,
      stock: [product("p", 0)],
    });
    expect(out.notices.map((n) => n.kind)).toEqual(["stock_out"]);
    // Réassort partiel (critique) : ce n'est pas pire, rien.
    const refilled = readAlertFeed(out.watch, {
      ...empty,
      stock: [product("p", 6)],
    });
    expect(refilled.notices).toEqual([]);
    // Réassort complet (sort du flux), puis retour à 0 : alerte directe.
    const ok = readAlertFeed(refilled.watch, empty);
    expect(ok.watch.stock.size).toBe(0);
    const again = readAlertFeed(ok.watch, {
      ...empty,
      stock: [product("p", 0)],
    });
    expect(again.notices.map((n) => n.kind)).toEqual(["stock_out"]);
  });

  it("l'état ne garde que le dernier relevé (borné)", () => {
    const first = readAlertFeed(null, {
      ...empty,
      orders: [order("1", "2026-09-18T10:00:00Z")],
    });
    const next = readAlertFeed(first.watch, empty);
    expect(next.watch.orders.size).toBe(0);
  });
});

describe("summarizeNotices (une seule notification)", () => {
  const o = (id: string) => orderNotice(order(id, "2026-09-18T10:00:00Z"));
  const m = (id: string) => messageNotice(message(id, "2026-09-18T10:00:00Z"));

  it("rien → rien ; une seule → elle-même", () => {
    expect(summarizeNotices([])).toBeNull();
    expect(summarizeNotices([o("001")])).toEqual(o("001"));
  });

  it("plusieurs commandes : comptées, clients listés (trois au plus), lien vers la liste", () => {
    const two = summarizeNotices([o("001"), o("002")]);
    expect(two).toMatchObject({
      kind: "order",
      title: "2 nouvelles commandes",
      body: "Client 001, Client 002",
      href: "/commandes",
    });
    expect(two?.order).toBeUndefined();
    expect(
      summarizeNotices(["001", "002", "003", "004", "005"].map(o))?.body,
    ).toBe("Client 001, Client 002, Client 003 et 2 autres");
  });

  it("plusieurs messages ou alertes de stock : même principe", () => {
    expect(summarizeNotices([m("a"), m("b")])).toMatchObject({
      kind: "message",
      title: "2 nouveaux messages clients",
      href: "/messages",
    });
    expect(
      summarizeNotices([
        stockNotice(product("p1", 3), "low"),
        stockNotice(product("p2", 0), "out"),
      ]),
    ).toMatchObject({
      kind: "stock_out",
      title: "2 alertes de stock",
      body: "Produit p1, Produit p2",
      href: "/catalogue",
    });
  });

  it("natures mêlées : le titre compte tout, la couleur et le lien suivent la plus importante", () => {
    expect(
      summarizeNotices([
        m("a"),
        stockNotice(product("p1", 0), "out"),
        o("001"),
        o("002"),
      ]),
    ).toMatchObject({
      kind: "order",
      title: "4 nouveautés",
      body: "2 commandes · 1 message · 1 alerte de stock",
      href: "/commandes",
    });
    expect(
      summarizeNotices([m("a"), stockNotice(product("p1", 0), "out")]),
    ).toMatchObject({ kind: "stock_out", href: "/messages" });
  });
});

describe("noticesForPrefs / readKindOfSection", () => {
  it("une case décochée coupe la notification de son fil ; le stock reste", () => {
    const notices = [
      orderNotice(order("001", "2026-09-18T10:00:00Z")),
      messageNotice(message("m", "2026-09-18T10:00:00Z")),
      stockNotice(product("p", 0), "out"),
    ];
    expect(
      noticesForPrefs(notices, { orders: false, messages: true }).map(
        (n) => n.kind,
      ),
    ).toEqual(["message", "stock_out"]);
    expect(
      noticesForPrefs(notices, { orders: true, messages: false }).map(
        (n) => n.kind,
      ),
    ).toEqual(["order", "stock_out"]);
  });

  it("Commandes, Messages et Catalogue portent un compteur, pas les autres sections", () => {
    expect(readKindOfSection("/commandes")).toBe("orders");
    expect(readKindOfSection("/messages")).toBe("messages");
    expect(readKindOfSection("/catalogue")).toBe("stock");
    expect(readKindOfSection("/clients")).toBeNull();
    expect(readKindOfSection("/")).toBeNull();
  });
});

describe("noticeTarget / listShows (badge « Nouveau »)", () => {
  it("désigne la commande ou le message, rien pour le stock", () => {
    expect(
      noticeTarget(orderNotice(order("abc", "2026-09-18T10:00:00Z"))),
    ).toEqual({ kind: "orders", id: "abc" });
    expect(
      noticeTarget(messageNotice(message("m-1", "2026-09-18T10:00:00Z"))),
    ).toEqual({ kind: "messages", id: "m-1" });
    expect(noticeTarget(stockNotice(product("p", 0), "out"))).toBeNull();
  });

  it("rafraîchit les listes seulement, jamais une fiche", () => {
    expect(listShows("/commandes", "orders")).toBe(true);
    expect(listShows("/", "orders")).toBe(true);
    expect(listShows("/commandes/cmd-1", "orders")).toBe(false);
    expect(listShows("/messages", "messages")).toBe(true);
    expect(listShows("/messages", "orders")).toBe(false);
  });
});
