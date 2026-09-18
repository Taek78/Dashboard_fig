import { RECOVERY_CODE_LENGTH } from "@/domain/auth/types";

/*
 * API HTTP du dashboard pour l'application FIG (décision du 2026-09-17,
 * question 14 : le dashboard reste le seul propriétaire du schéma, l'application
 * passe par lui). Ce fichier ne contient que des CONSTANTES et des bornes :
 * les entrées sont validées par schemas.ts, les réponses décrites par
 * responses.ts, la documentation générée par openapi.ts.
 *
 * Deux appelants :
 * - un CLIENT de l'application, identifié par un jeton de session délivré
 *   après un code reçu par mail (session.ts) ;
 * - le SERVEUR de l'application, identifié par la clé de service
 *   (API_SERVICE_KEY), pour la file des notifications.
 */
export const API_VERSION = "v1";
export const API_BASE_PATH = `/api/${API_VERSION}`;

/** Corps JSON accepté : au-delà, 413 sans lire le corps. */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

/** Listes paginées par curseur : taille par défaut et plafond. */
export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 50;
/** Articles publiés : lus d'un bloc (contenu éditorial, quelques dizaines). */
export const ARTICLES_LIMIT_DEFAULT = 50;
export const ARTICLES_LIMIT_MAX = 100;
/** File des notifications lue par le serveur de l'application. */
export const PENDING_NOTIFICATIONS_LIMIT_DEFAULT = 100;
export const PENDING_NOTIFICATIONS_LIMIT_MAX = 500;

/** Clé d'idempotence (en-tête Idempotency-Key) : un identifiant choisi par l'appelant. */
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
/** Une réponse mémorisée se rejoue pendant 24 heures, puis la clé est oubliée. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Code de connexion : six chiffres, comme le code de récupération du back-office. */
export const LOGIN_CODE_LENGTH = RECOVERY_CODE_LENGTH;

/** Profil d'un client (inscription et modification). */
export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 120;
export const PHONE_MIN_LENGTH = 6;
export const PHONE_MAX_LENGTH = 30;
export const PHONE_PATTERN = /^[+\d][\d .-]*$/;
export const ADDRESS_LINE_MAX_LENGTH = 160;
export const CITY_MAX_LENGTH = 80;
/** Code postal français à cinq chiffres (la livraison est en France). */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
export const REFERRAL_CODE_MAX_LENGTH = 60;

/** Commande : lignes et quantités (grammes ou pièces selon le produit). */
export const ORDER_MAX_LINES = 50;
export const MAX_LINE_QUANTITY = { g: 100_000, piece: 500 } as const;
/** Un créneau se réserve jusqu'à trente jours à l'avance. */
export const ORDER_BOOKING_HORIZON_DAYS = 30;
export const PAYMENT_REFERENCE_MAX_LENGTH = 100;

/** Message « Nous contacter ». */
export const MESSAGE_BODY_MAX_LENGTH = 4000;
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 200;
export const ATTACHMENT_MAX_BYTES = 50_000_000;
export const ATTACHMENT_URL_MAX_LENGTH = 2000;

/** Limitation de débit en mémoire (par instance) : requêtes par minute. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_PER_IP = 600;
export const RATE_LIMIT_PER_SESSION = 120;

/** Cache public du catalogue et des articles (secondes). */
export const PUBLIC_CACHE_MAX_AGE_S = 60;
export const PUBLIC_CACHE_STALE_S = 300;
