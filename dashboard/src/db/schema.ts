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
 * Schéma de la base FIG, conçue et possédée par le dashboard. Source de vérité des migrations :
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
export const staffKindEnum = pgEnum("staff_kind", [
  "livreur",
  "preparateur",
  "gestionnaire",
]);
export const staffShiftEnum = pgEnum("staff_shift", [
  "matin",
  "apres_midi",
  "soir",
  "journee",
]);
export const staffAvailabilityEnum = pgEnum("staff_availability", [
  "disponible",
  "indisponible",
  "conge",
]);
export const communityKindEnum = pgEnum("community_kind", [
  "creche",
  "ecole",
  "entreprise",
  "association",
  "autre",
]);
export const discountKindEnum = pgEnum("discount_kind", [
  "community",
  "loyalty",
]);
export const messageSubjectEnum = pgEnum("message_subject", [
  "missing_or_damaged",
  "delivery_issue",
  "order_error",
  "product_question",
  "refund",
  "other",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "untreated",
  "treated",
]);
/**
 * Formats acceptés en pièce jointe. C'est une LISTE BLANCHE tenue par la base,
 * et non par un formulaire : les messages sont écrits par l'application FIG,
 * qui écrira peut-être directement ici (question 14). Ni vidéo ni audio, par
 * décision du client.
 */
export const attachmentContentTypeEnum = pgEnum("attachment_content_type", [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
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

/* ---------- Équipe du client (personnel) ---------- */
export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    kind: staffKindEnum("kind").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    shift: staffShiftEnum("shift").notNull(),
    availability: staffAvailabilityEnum("availability").notNull(),
    /** Jours travaillés, clés "lun".."dim" du domaine. */
    workDays: text("work_days").array().notNull(),
    startedAt: date("started_at", { mode: "string" }).notNull(),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_email_lower_idx").on(sql`lower(${t.email})`),
    index("staff_kind_idx").on(t.kind),
  ],
);

/* ---------- Communautés (créées par l'application FIG) ---------- */
export const communities = pgTable("communities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: communityKindEnum("kind").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  pickupPlace: text("pickup_place").notNull(),
  pickupCity: text("pickup_city").notNull(),
  pickupPostalCode: text("pickup_postal_code").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestampTz("created_at").notNull().defaultNow(),
});

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
    /** Adhésion gérée par l'application ; une communauté supprimée libère ses membres. */
    communityId: text("community_id").references(() => communities.id, {
      onDelete: "set null",
    }),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
    /**
     * Anonymisation RGPD (droit à l'effacement ou durée de conservation
     * dépassée, src/db/privacy.ts) : identité et coordonnées remplacées,
     * notes supprimées, commandes conservées. null = données intactes.
     */
    anonymizedAt: timestampTz("anonymized_at"),
    /**
     * Recherche des commandes, calculée par la base à chaque écriture : nom et
     * e-mail normalisés (fig_normalize, migration 0006), séparés par chr(1)
     * qu'aucune saisie ne contient ; chiffres du téléphone à part.
     */
    searchText: text("search_text")
      .notNull()
      .generatedAlwaysAs(
        sql`fig_normalize(full_name) || chr(1) || fig_normalize(email)`,
      ),
    phoneDigits: text("phone_digits")
      .notNull()
      .generatedAlwaysAs(sql`regexp_replace(phone, '[^0-9]', '', 'g')`),
  },
  (t) => [
    uniqueIndex("customers_email_lower_idx").on(sql`lower(${t.email})`),
    index("customers_community_idx").on(t.communityId),
  ],
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
    status: orderStatusEnum("status").notNull().default("preparing"),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
    deliveryStart: text("delivery_start").notNull(),
    deliveryEnd: text("delivery_end").notNull(),
    deliveryCity: text("delivery_city").notNull(),
    deliveryPostalCode: text("delivery_postal_code").notNull(),
    /** Total dû : sous-total des lignes moins la remise. */
    totalCents: integer("total_cents").notNull(),
    cancellationReason: cancellationReasonEnum("cancellation_reason"),
    cancellationDetail: text("cancellation_detail"),
    /** Communauté de retrait ; remise appliquée par l'application (jamais par le dashboard). */
    communityId: text("community_id").references(() => communities.id, {
      onDelete: "set null",
    }),
    discountKind: discountKindEnum("discount_kind"),
    discountPercent: integer("discount_percent"),
    discountCents: integer("discount_cents").notNull().default(0),
    /** Affectations de l'équipe ; une personne supprimée libère ses commandes. */
    preparerId: text("preparer_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    driverId: text("driver_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    /**
     * Recherche libre, calculée par la base : référence, ville et code postal
     * normalisés. Index trigramme (pg_trgm) : « contient » sans parcourir la table.
     */
    searchText: text("search_text")
      .notNull()
      .generatedAlwaysAs(
        sql`fig_normalize(reference) || chr(1) || fig_normalize(delivery_city) || chr(1) || fig_normalize(delivery_postal_code)`,
      ),
  },
  (t) => [
    uniqueIndex("orders_reference_idx").on(t.reference),
    index("orders_search_trgm_idx").using(
      "gin",
      t.searchText.op("gin_trgm_ops"),
    ),
    index("orders_delivery_date_idx").on(t.deliveryDate),
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_community_idx").on(t.communityId),
    index("orders_preparer_idx").on(t.preparerId),
    index("orders_driver_idx").on(t.driverId),
    check(
      "orders_discount_consistent",
      sql`(${t.discountKind} IS NULL) = (${t.discountPercent} IS NULL) AND ${t.discountCents} >= 0`,
    ),
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

/* ---------- Boîte de réception « Nous contacter » ---------- */
/*
 * Messages envoyés par les clients depuis l'application FIG. Le dashboard ne
 * les crée ni ne les modifie : il ne pose que les trois marques de l'équipe
 * (`status`, `pinned_at`, `important`). `order_id` est le contexte que le
 * client a choisi d'attacher à sa demande.
 *
 * RGPD : le corps est du texte libre écrit par la personne sur elle-même. Il
 * entre dans son export (droit d'accès) et disparaît à son anonymisation
 * (src/db/privacy.ts), avec ses pièces jointes par cascade.
 */
export const customerMessages = pgTable(
  "customer_messages",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    subject: messageSubjectEnum("subject").notNull(),
    body: text("body").notNull(),
    /** Commande associée par le client ; une commande effacée ne perd pas le message. */
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    status: messageStatusEnum("status").notNull().default("untreated"),
    receivedAt: timestampTz("received_at").notNull().defaultNow(),
    /** Épinglé en haut de la liste par l'équipe, sinon NULL. */
    pinnedAt: timestampTz("pinned_at"),
    important: boolean("important").notNull().default(false),
    /** Dernier changement de statut : instant et nom, posés par la Server Action. */
    handledAt: timestampTz("handled_at"),
    handledByName: text("handled_by_name"),
    /** Recherche dans le corps, normalisée par la base (fig_normalize, migration 0006). */
    searchText: text("search_text")
      .notNull()
      .generatedAlwaysAs(sql`fig_normalize(body)`),
  },
  (t) => [
    index("customer_messages_received_idx").on(t.receivedAt),
    index("customer_messages_customer_idx").on(t.customerId),
    index("customer_messages_status_idx").on(t.status),
    index("customer_messages_order_idx").on(t.orderId),
    check(
      "customer_messages_handled_consistent",
      sql`(${t.handledAt} IS NULL) = (${t.handledByName} IS NULL)`,
    ),
  ],
);

/*
 * Pièces jointes : seulement des MÉTADONNÉES. Le fichier lui-même est stocké
 * par l'application FIG, qui écrit ici son URL (question 22) ; le dashboard ne
 * téléverse rien et n'héberge rien.
 *
 * La limite de dix documents par message est tenue par la base, et non par un
 * écran : `position` bornée à 0..9 et unique par message. Elle doit rester
 * égale à MAX_ATTACHMENTS (src/domain/messages/attachment.ts).
 */
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => customerMessages.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: attachmentContentTypeEnum("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    url: text("url").notNull(),
  },
  (t) => [
    uniqueIndex("message_attachments_position_idx").on(t.messageId, t.position),
    check(
      "message_attachments_position_range",
      sql`${t.position} >= 0 AND ${t.position} < 10`,
    ),
    check("message_attachments_size_positive", sql`${t.sizeBytes} > 0`),
    check("message_attachments_url_https", sql`${t.url} ~ '^https://'`),
  ],
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

/* ---------- Journal de sécurité ---------- */
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

/*
 * ---------- Tentatives de connexion (limitation de débit) ----------
 * Une ligne par clé surveillée (« email:… » ou « ip:… ») : l'état partagé par
 * toutes les instances du dashboard. Les règles (seuils, verrous) restent dans
 * src/lib/rate-limit.ts ; les lignes expirées sont purgées à chaque échec.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: text("key").primaryKey(),
    failures: integer("failures").notNull(),
    lastFailureAt: timestampTz("last_failure_at").notNull(),
    lockedUntil: timestampTz("locked_until"),
  },
  (t) => [index("login_attempts_last_failure_idx").on(t.lastFailureAt)],
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
