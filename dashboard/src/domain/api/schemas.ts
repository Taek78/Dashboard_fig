import { FAILURE_REASON_MAX_LENGTH } from "@/domain/notifications/types";
import { z } from "zod";
import {
  ADDRESS_LINE_MAX_LENGTH,
  ARTICLES_LIMIT_DEFAULT,
  ARTICLES_LIMIT_MAX,
  CITY_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IDEMPOTENCY_KEY_PATTERN,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  LOGIN_CODE_LENGTH,
  MAX_LINE_QUANTITY,
  MESSAGE_BODY_MAX_LENGTH,
  ORDER_MAX_LINES,
  PAYMENT_REFERENCE_MAX_LENGTH,
  PENDING_NOTIFICATIONS_LIMIT_DEFAULT,
  PENDING_NOTIFICATIONS_LIMIT_MAX,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  PHONE_PATTERN,
  POSTAL_CODE_PATTERN,
  REFERRAL_CODE_MAX_LENGTH,
} from "@/domain/api/types";
import { MAX_ATTACHMENTS } from "@/domain/messages/attachment";
import { MESSAGE_SUBJECTS } from "@/domain/messages/subject";
import { CANCELLATION_DETAIL_MAX_LENGTH } from "@/domain/orders/cancellation";
import { slotEndFor } from "@/domain/orders/slot";

/*
 * Schémas zod des ENTRÉES de l'API (corps JSON, paramètres de requête,
 * en-têtes). Régime STRICT partout : une valeur invalide vaut 422 avec la
 * liste des champs en cause ; jamais de valeur reçue reflétée dans un message.
 * Ces schémas servent aussi à générer la documentation (openapi.ts).
 */
export const apiIdSchema = z.string().trim().min(1).max(64);

const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());

/* ---------- Accès ---------- */

export const requestCodeSchema = z.object({ email });

const loginCode = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`));

export const consentsSchema = z.object({
  offers: z.boolean(),
  orderStatus: z.boolean(),
  marketing: z.boolean(),
});

const fullName = z
  .string()
  .trim()
  .min(FULL_NAME_MIN_LENGTH)
  .max(FULL_NAME_MAX_LENGTH);
const phone = z
  .string()
  .trim()
  .min(PHONE_MIN_LENGTH)
  .max(PHONE_MAX_LENGTH)
  .regex(PHONE_PATTERN);
const addressLine = z.string().trim().min(1).max(ADDRESS_LINE_MAX_LENGTH);
const city = z.string().trim().min(1).max(CITY_MAX_LENGTH);
const postalCode = z.string().trim().regex(POSTAL_CODE_PATTERN);

/** Profil complet à l'inscription : identité, coordonnées, trois autorisations, parrain et communauté publique facultatifs. */
export const signupSchema = z.object({
  fullName,
  phone,
  addressLine: addressLine.nullable().optional(),
  city,
  postalCode,
  consents: consentsSchema,
  referralCode: z
    .string()
    .trim()
    .min(1)
    .max(REFERRAL_CODE_MAX_LENGTH)
    .optional(),
  communityId: apiIdSchema.optional(),
});

export const openSessionSchema = z.object({
  email,
  code: loginCode,
  signup: signupSchema.optional(),
});

/* ---------- Profil ---------- */

/** Modification partielle : au moins un champ ; l'e-mail ne se change pas (c'est l'identifiant). */
export const updateProfileSchema = z
  .object({
    fullName: fullName.optional(),
    phone: phone.optional(),
    addressLine: addressLine.nullable().optional(),
    city: city.optional(),
    postalCode: postalCode.optional(),
    consents: consentsSchema.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: "Aucun champ à modifier",
  });

export const joinCommunitySchema = z.object({ communityId: apiIdSchema });

/* ---------- Commandes ---------- */

const cartLineSchema = z.object({
  productId: apiIdSchema,
  quantity: z
    .number()
    .int()
    .min(1)
    .max(Math.max(MAX_LINE_QUANTITY.g, MAX_LINE_QUANTITY.piece)),
});

export const quoteSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(ORDER_MAX_LINES),
});

/** Créneau demandé : jour et heure de début ; la fin est déduite (une heure pile). */
export const deliverySlotSchema = z
  .object({
    date: z.iso.date(),
    start: z.string().regex(/^([01]\d|2[0-3]):00$/),
  })
  .transform(({ date, start }) => ({ date, start, end: slotEndFor(start) }));

export const createOrderSchema = quoteSchema.extend({
  deliverySlot: deliverySlotSchema,
  /** Le total que l'application a fait payer : refusé s'il diffère du devis recalculé. */
  expectedTotalCents: z.number().int().min(0),
  paymentReference: z
    .string()
    .trim()
    .min(1)
    .max(PAYMENT_REFERENCE_MAX_LENGTH)
    .nullable()
    .optional(),
});

export const cancelOrderSchema = z.object({
  detail: z.string().trim().max(CANCELLATION_DETAIL_MAX_LENGTH).optional(),
});

/** Échec d'envoi d'une notification, déclaré par le serveur de l'application. */
export const notificationFailureSchema = z.object({
  raison: z.string().trim().min(1).max(FAILURE_REASON_MAX_LENGTH).optional(),
});

/* ---------- Messages ---------- */

export const createMessageSchema = z.object({
  subject: z.enum(MESSAGE_SUBJECTS),
  body: z.string().trim().min(1).max(MESSAGE_BODY_MAX_LENGTH),
  orderId: apiIdSchema.nullable().optional(),
  /**
   * Fichiers déjà téléversés par POST /fichiers (2026-09-18), dans l'ordre
   * d'affichage ; chacun doit être à la personne et n'être joint à rien.
   */
  fileIds: z.array(apiIdSchema).max(MAX_ATTACHMENTS).optional(),
  /*
   * Ancienne forme (métadonnées et URL chez l'application), REFUSÉE et non
   * ignorée : un client pas encore à jour verrait sinon son message créé sans
   * ses pièces jointes, en croyant les avoir envoyées.
   */
  attachments: z
    .never({
      error:
        "Les pièces jointes se téléversent d'abord par POST /fichiers, puis se citent dans fileIds.",
    })
    .optional(),
});

/* ---------- Listes et en-têtes ---------- */

const limit = (defaultValue: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(defaultValue);

/** ?limit=&cursor= des listes paginées par curseur. */
export const listQuerySchema = z.object({
  limit: limit(LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX),
  cursor: z.string().min(1).max(300).optional(),
});

export const articlesQuerySchema = z.object({
  limit: limit(ARTICLES_LIMIT_DEFAULT, ARTICLES_LIMIT_MAX),
});

export const pendingNotificationsQuerySchema = z.object({
  limit: limit(
    PENDING_NOTIFICATIONS_LIMIT_DEFAULT,
    PENDING_NOTIFICATIONS_LIMIT_MAX,
  ),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)
  .regex(IDEMPOTENCY_KEY_PATTERN);

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
