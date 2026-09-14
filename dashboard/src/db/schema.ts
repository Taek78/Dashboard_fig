import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/*
 * Schéma de la base FIG, conçue PAR le dashboard (décision client du 2026-09-14 :
 * la base n'existe pas, on la crée). Source de vérité des migrations :
 * `npm run db:generate` produit le SQL dans ./drizzle, `npm run db:migrate`
 * l'applique. Le schéma est modifié ICI, jamais à la main en base.
 *
 * Conventions :
 * - tables et colonnes en snake_case, ids en texte (générés par l'application,
 *   mêmes valeurs que les fixtures pour le seed : "cmd-0001") ;
 * - montants en centimes entiers, quantités en unité de base (grammes ou pièces) ;
 * - instants en timestamptz, jours en date, heures de créneau en texte "HH:mm" ;
 * - les listes de valeurs sont des enums Postgres dont les valeurs DOIVENT rester
 *   identiques aux constantes du domaine (test/db/schema.test.ts le vérifie ; ce
 *   fichier n'importe pas le domaine pour rester chargeable par drizzle-kit).
 * - une ligne de commande garde le NOM et le prix du produit au moment de l'achat
 *   (instantané) : supprimer un produit ne touche pas aux commandes passées.
 */
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
]);
export const cancellationReasonEnum = pgEnum("cancellation_reason", [
  "stock",
  "delivery",
  "other",
]);
export const productCategoryEnum = pgEnum("product_category", [
  "fruit",
  "vegetable",
]);
export const productUnitEnum = pgEnum("product_unit", ["piece", "g"]);
export const containerEnum = pgEnum("container", [
  "none",
  "tray",
  "parcel",
  "crate",
  "bag",
]);
export const articleCategoryEnum = pgEnum("article_category", [
  "nutrition",
  "recipe",
  "science",
  "news",
]);
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "gestionnaire",
  "lecture",
  "livreur",
]);

const timestampTz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/* ---------- Comptes du back-office ---------- */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

/* ---------- Clients de l'application ---------- */
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (t) => [index("customer_notes_customer_idx").on(t.customerId)],
);

/* ---------- Catalogue ---------- */
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    variety: text("variety"),
    category: productCategoryEnum("category").notNull(),
    unit: productUnitEnum("unit").notNull(),
    priceCents: integer("price_cents").notNull(),
    unitWeightGrams: integer("unit_weight_grams"),
    container: containerEnum("container").notNull().default("none"),
    originCountry: text("origin_country").notNull().default("FR"),
    originRegion: text("origin_region"),
    caliberMinMm: integer("caliber_min_mm"),
    caliberMaxMm: integer("caliber_max_mm"),
    organic: boolean("organic").notNull().default(false),
    inSeason: boolean("in_season").notNull().default(false),
    available: boolean("available").notNull().default(true),
    visible: boolean("visible").notNull().default(true),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    illustration: text("illustration").notNull(),
    imageUrl: text("image_url"),
    updatedAt: timestampTz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("products_price_positive", sql`${t.priceCents} > 0`),
    check("products_stock_non_negative", sql`${t.stockQuantity} >= 0`),
    check(
      "products_caliber_both_or_none",
      sql`(${t.caliberMinMm} IS NULL) = (${t.caliberMaxMm} IS NULL)`,
    ),
  ],
);

/* ---------- Commandes ---------- */
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
    status: orderStatusEnum("status").notNull().default("pending"),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
    deliveryStart: text("delivery_start").notNull(),
    deliveryEnd: text("delivery_end").notNull(),
    deliveryCity: text("delivery_city").notNull(),
    deliveryPostalCode: text("delivery_postal_code").notNull(),
    totalCents: integer("total_cents").notNull(),
    cancellationReason: cancellationReasonEnum("cancellation_reason"),
    cancellationDetail: text("cancellation_detail"),
  },
  (t) => [
    uniqueIndex("orders_reference_idx").on(t.reference),
    index("orders_delivery_date_idx").on(t.deliveryDate),
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
    check(
      "orders_slot_format",
      sql`${t.deliveryStart} ~ '^[0-9]{2}:[0-9]{2}$' AND ${t.deliveryEnd} ~ '^[0-9]{2}:[0-9]{2}$'`,
    ),
    check(
      "orders_cancellation_consistent",
      sql`(${t.status} = 'cancelled') = (${t.cancellationReason} IS NOT NULL)`,
    ),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Instantané : pas de clé étrangère, un produit supprimé ne casse rien. */
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unit: productUnitEnum("unit").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.position] }),
    check("order_lines_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status").notNull(),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    cancellationReason: cancellationReasonEnum("cancellation_reason"),
    cancellationDetail: text("cancellation_detail"),
    at: timestampTz("at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.at)],
);

/* ---------- Articles « à lire » ---------- */
export const articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: articleCategoryEnum("category").notNull(),
    illustration: text("illustration").notNull(),
    imageUrl: text("image_url"),
    publishedAt: date("published_at", { mode: "string" }).notNull(),
    visible: boolean("visible").notNull().default(true),
    updatedAt: timestampTz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("articles_published_idx").on(t.publishedAt)],
);

/* ---------- Journal de sécurité (2026-09-14) ---------- */
export const securityEvents = pgTable(
  "security_events",
  {
    id: text("id").primaryKey(),
    at: timestampTz("at").notNull().defaultNow(),
    type: text("type").notNull(),
    /** Le reste de l'événement (identifiants, adresse IP, cible) ; jamais de secret. */
    details: jsonb("details").notNull().$type<Record<string, unknown>>(),
  },
  (t) => [
    index("security_events_at_idx").on(t.at),
    index("security_events_type_idx").on(t.type),
  ],
);

/* ---------- Usage de l'application, par mois civil ---------- */
export const engagementMonthly = pgTable(
  "engagement_monthly",
  {
    month: text("month").primaryKey(),
    downloads: integer("downloads").notNull().default(0),
    signups: integer("signups").notNull().default(0),
    complaints: integer("complaints").notNull().default(0),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count").notNull().default(0),
  },
  (t) => [
    check("engagement_month_format", sql`${t.month} ~ '^[0-9]{4}-[0-9]{2}$'`),
  ],
);
