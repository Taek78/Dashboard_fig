import { z } from "zod";
import {
  articleResponse,
  catalogResponse,
  codeSentResponse,
  communityResponse,
  customerResponse,
  errorResponse,
  listOf,
  messageResponse,
  notificationResponse,
  okResponse,
  orderResponse,
  pendingNotificationResponse,
  quoteProblemResponse,
  quoteResponse,
  sessionResponse,
} from "@/domain/api/responses";
import {
  articlesQuerySchema,
  cancelOrderSchema,
  createMessageSchema,
  createOrderSchema,
  joinCommunitySchema,
  listQuerySchema,
  openSessionSchema,
  pendingNotificationsQuerySchema,
  quoteSchema,
  requestCodeSchema,
  updateProfileSchema,
} from "@/domain/api/schemas";
import { API_ERROR_CODES } from "@/lib/api/errors";
import {
  API_BASE_PATH,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_MIN_LENGTH,
  IDEMPOTENCY_KEY_PATTERN,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  MAX_JSON_BODY_BYTES,
  RATE_LIMIT_PER_IP,
  RATE_LIMIT_PER_SESSION,
} from "@/domain/api/types";
import {
  CUSTOMER_SESSION_TTL_MS,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_VALIDITY,
} from "@/domain/api/session";

/*
 * Document OpenAPI 3.1 de l'API, CONSTRUIT depuis les schémas zod des entrées
 * (schemas.ts, forme d'entrée) et des réponses (responses.ts, forme de
 * sortie) : la documentation ne peut pas dériver du code. Écrit dans
 * docs/api/openapi.json par `npm run api:openapi` (un test vérifie que le
 * fichier commité est à jour) et servi par GET /api/v1/openapi.json.
 * Le guide humain est docs/api.md.
 */
type JsonSchema = Record<string, unknown>;

function schemaOf(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
  }) as JsonSchema;
  delete json.$schema;
  return json;
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schema: JsonSchema | { $ref: string }) => ({
  "application/json": { schema },
});

const body = (schema: z.ZodType, description: string) => ({
  required: true,
  description,
  content: jsonContent(schemaOf(schema, "input")),
});

const okJson = (
  schema: JsonSchema | { $ref: string },
  description: string,
) => ({ description, content: jsonContent(schema) });

const errorRef = (description: string) => ({
  description,
  content: jsonContent(ref("Error")),
});

/** Paramètres de requête d'un schéma zod d'objet, chacun en `in: query`. */
function queryParameters(schema: z.ZodObject): unknown[] {
  const json = schemaOf(schema, "input");
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }));
}

const idParameter = (description: string) => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "string", minLength: 1, maxLength: 64 },
});

const IDEMPOTENCY_HEADER = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  description: `Clé choisie par l'application pour cette création (${IDEMPOTENCY_KEY_MIN_LENGTH} à ${IDEMPOTENCY_KEY_MAX_LENGTH} caractères, ${IDEMPOTENCY_KEY_PATTERN.source}) : la même clé avec le même corps rejoue la réponse mémorisée pendant 24 heures (en-tête Idempotent-Replayed: true) ; avec un autre corps, 422 idempotency_key_reused ; en cours de traitement, 409 idempotency_in_progress.`,
  schema: {
    type: "string",
    minLength: IDEMPOTENCY_KEY_MIN_LENGTH,
    maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
    pattern: IDEMPOTENCY_KEY_PATTERN.source,
  },
};

const IF_NONE_MATCH = {
  name: "If-None-Match",
  in: "header",
  required: false,
  description: "L'ETag reçu précédemment : 304 sans corps si rien n'a changé.",
  schema: { type: "string" },
};

const SESSION = [{ sessionToken: [] }];
const SERVICE = [{ serviceKey: [] }];

const COMMON_ERRORS = {
  "429": errorRef(
    `Trop de requêtes (rate_limited) : ${RATE_LIMIT_PER_IP} par minute et par adresse IP, ${RATE_LIMIT_PER_SESSION} par minute et par session ; en-tête Retry-After.`,
  ),
  "500": errorRef("Erreur interne (internal_error), sans détail."),
};

const AUTH_ERRORS = {
  "401": errorRef(
    "Jeton absent, invalide, expiré ou révoqué (unauthenticated).",
  ),
  "403": errorRef("Compte clôturé, données effacées (account_closed)."),
};

const VALIDATION_ERRORS = {
  "400": errorRef("JSON illisible (bad_request)."),
  "413": errorRef(
    `Corps de plus de ${MAX_JSON_BODY_BYTES} octets (payload_too_large).`,
  ),
  "415": errorRef(
    "Content-Type autre que application/json (unsupported_media_type).",
  ),
  "422": errorRef(
    "Champs invalides (validation_failed) : details.issues liste chaque champ (path) et son message.",
  ),
};

const DESCRIPTION = `API HTTP du back-office FIG pour l'application (clients) et son serveur (notifications). Toutes les réponses sont en JSON UTF-8 ; les montants en centimes d'euro, les quantités en grammes (unit « g ») ou en pièces (unit « piece »), les instants en ISO 8601 UTC, les jours AAAA-MM-JJ et les heures HH:mm (Europe/Paris). Chaque clé de vocabulaire (statut, objet, catégorie…) est accompagnée de son libellé français.

Accès des clients : POST /auth/code envoie un code à six chiffres par mail (valable ${LOGIN_CODE_VALIDITY}, ${LOGIN_CODE_MAX_ATTEMPTS} essais) ; POST /auth/session l'échange contre un jeton de session (${CUSTOMER_SESSION_TTL_MS / 86_400_000} jours), à envoyer en « Authorization: Bearer <jeton> » ; une adresse inconnue s'inscrit dans le même appel (champ signup). Le serveur de l'application utilise la clé de service (API_SERVICE_KEY) sur les routes /service.

Erreurs : { "error": { "code", "message", "details"? } }, code stable parmi ${API_ERROR_CODES.join(", ")} ; message en français, affichable tel quel.

Listes : ?limit= (${LIST_LIMIT_DEFAULT} par défaut, ${LIST_LIMIT_MAX} au plus) et ?cursor= (valeur nextCursor de la page précédente ; null à la fin). Lectures publiques (catalogue, articles, communautés) : Cache-Control public d'une minute et ETag (If-None-Match → 304). Réponses authentifiées : Cache-Control: private, no-store.`;

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "API FIG",
      version: "1.0.0",
      description: DESCRIPTION,
      contact: { name: "Équipe FIG" },
    },
    servers: [
      { url: API_BASE_PATH, description: "Même hôte que le dashboard." },
    ],
    tags: [
      {
        name: "Accès",
        description: "Code de connexion par mail, sessions, inscription.",
      },
      {
        name: "Catalogue",
        description:
          "Produits, barèmes, créneaux ; articles ; communautés publiques.",
      },
      {
        name: "Profil",
        description:
          "La personne connectée : fiche, autorisations, communauté, notifications reçues.",
      },
      {
        name: "Commandes",
        description: "Devis, création d'une commande payée, suivi, annulation.",
      },
      {
        name: "Messages",
        description: "Demandes « Nous contacter » et leurs pièces jointes.",
      },
      {
        name: "Service",
        description:
          "Serveur de l'application : file des notifications à envoyer.",
      },
    ],
    components: {
      securitySchemes: {
        sessionToken: {
          type: "http",
          scheme: "bearer",
          description:
            "Jeton de session d'un client, obtenu par POST /auth/session ; remis une seule fois.",
        },
        serviceKey: {
          type: "http",
          scheme: "bearer",
          description:
            "Clé du serveur de l'application (API_SERVICE_KEY du dashboard).",
        },
      },
      schemas: {
        Error: schemaOf(errorResponse, "output"),
        Ok: schemaOf(okResponse, "output"),
        CodeSent: schemaOf(codeSentResponse, "output"),
        Session: schemaOf(sessionResponse, "output"),
        Customer: schemaOf(customerResponse, "output"),
        Catalog: schemaOf(catalogResponse, "output"),
        Article: schemaOf(articleResponse, "output"),
        ArticleList: schemaOf(listOf(articleResponse), "output"),
        Community: schemaOf(communityResponse, "output"),
        CommunityList: schemaOf(listOf(communityResponse), "output"),
        Quote: schemaOf(quoteResponse, "output"),
        QuoteProblem: schemaOf(quoteProblemResponse, "output"),
        Order: schemaOf(orderResponse, "output"),
        OrderList: schemaOf(listOf(orderResponse), "output"),
        Message: schemaOf(messageResponse, "output"),
        MessageList: schemaOf(listOf(messageResponse), "output"),
        Notification: schemaOf(notificationResponse, "output"),
        NotificationList: schemaOf(listOf(notificationResponse), "output"),
        PendingNotificationList: schemaOf(
          listOf(pendingNotificationResponse),
          "output",
        ),
      },
    },
    paths: {
      "/auth/code": {
        post: {
          tags: ["Accès"],
          operationId: "requestLoginCode",
          summary: "Envoyer un code de connexion par mail",
          description:
            "Adresse connue ou non (c'est aussi le chemin de l'inscription) : la réponse est la même. Quotas : 3 demandes par quart d'heure et par adresse, 30 par adresse IP.",
          requestBody: body(
            requestCodeSchema,
            "L'adresse e-mail de la personne.",
          ),
          responses: {
            "202": okJson(
              ref("CodeSent"),
              "Code envoyé (ou adresse inconnue : même réponse).",
            ),
            ...VALIDATION_ERRORS,
            ...COMMON_ERRORS,
          },
        },
      },
      "/auth/session": {
        post: {
          tags: ["Accès"],
          operationId: "openSession",
          summary:
            "Échanger le code contre un jeton de session (et s'inscrire)",
          description:
            "Adresse connue : ouvre une session (200). Adresse inconnue sans `signup` : 404 signup_required ; avec `signup` : crée le compte et la session (201). Le jeton n'est remis qu'une fois.",
          requestBody: body(
            openSessionSchema,
            "E-mail, code reçu et, pour une inscription, le profil.",
          ),
          responses: {
            "200": okJson(ref("Session"), "Session ouverte."),
            "201": okJson(ref("Session"), "Compte créé et session ouverte."),
            "401": errorRef(
              "Code incorrect ou expiré (code_invalid) ; annulé après cinq essais (code_locked).",
            ),
            "403": errorRef("Compte clôturé (account_closed)."),
            "404": errorRef(
              "Aucun compte pour cette adresse : envoyer `signup` (signup_required).",
            ),
            "409": errorRef("Adresse déjà inscrite entre-temps (email_taken)."),
            ...VALIDATION_ERRORS,
            "422": errorRef(
              "Champs invalides (validation_failed), code de parrainage inconnu (referral_code_unknown) ou communauté non ouverte (community_not_joinable).",
            ),
            ...COMMON_ERRORS,
          },
        },
        delete: {
          tags: ["Accès"],
          operationId: "closeSession",
          summary: "Se déconnecter (révoquer le jeton)",
          security: SESSION,
          responses: {
            "204": { description: "Session révoquée." },
            ...AUTH_ERRORS,
            ...COMMON_ERRORS,
          },
        },
      },
      "/catalogue": {
        get: {
          tags: ["Catalogue"],
          operationId: "getCatalog",
          summary: "Le catalogue : produits visibles, barèmes, créneaux",
          description:
            "Produits visibles avec leur statut de vente (en_vente, rupture, indisponible), le paramètre « vente à stock 0 », le barème des frais de livraison, les paliers de remise, les créneaux réservables. Public, cache d'une minute, ETag.",
          parameters: [IF_NONE_MATCH],
          responses: {
            "200": okJson(ref("Catalog"), "Le catalogue (en-tête ETag)."),
            "304": { description: "Inchangé depuis l'ETag fourni." },
            ...COMMON_ERRORS,
          },
        },
      },
      "/articles": {
        get: {
          tags: ["Catalogue"],
          operationId: "listArticles",
          summary: "Les articles « à lire » parus",
          parameters: queryParameters(articlesQuerySchema),
          responses: {
            "200": okJson(
              ref("ArticleList"),
              "Les plus récents d'abord (nextCursor toujours null).",
            ),
            "422": VALIDATION_ERRORS["422"],
            ...COMMON_ERRORS,
          },
        },
      },
      "/articles/{id}": {
        get: {
          tags: ["Catalogue"],
          operationId: "getArticle",
          summary: "Un article paru",
          parameters: [idParameter("Identifiant de l'article.")],
          responses: {
            "200": okJson(ref("Article"), "L'article."),
            "404": errorRef(
              "Article introuvable, masqué ou pas encore paru (not_found).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/communautes": {
        get: {
          tags: ["Catalogue"],
          operationId: "listCommunities",
          summary: "Les communautés publiques ouvertes à l'adhésion",
          description:
            "Sans les coordonnées des référents. Une communauté privée n'est jamais listée.",
          responses: {
            "200": okJson(
              ref("CommunityList"),
              "Les communautés publiques et actives.",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/me": {
        get: {
          tags: ["Profil"],
          operationId: "getMe",
          summary:
            "Ma fiche : coordonnées, autorisations, fidélité, communauté",
          security: SESSION,
          responses: {
            "200": okJson(ref("Customer"), "La fiche."),
            ...AUTH_ERRORS,
            ...COMMON_ERRORS,
          },
        },
        patch: {
          tags: ["Profil"],
          operationId: "updateMe",
          summary: "Modifier mon profil ou mes autorisations",
          description:
            "Modification partielle ; `consents` remplace les trois autorisations et date le choix. L'e-mail ne se modifie pas.",
          security: SESSION,
          requestBody: body(
            updateProfileSchema,
            "Les champs à modifier (au moins un).",
          ),
          responses: {
            "200": okJson(ref("Customer"), "La fiche à jour."),
            ...AUTH_ERRORS,
            ...VALIDATION_ERRORS,
            ...COMMON_ERRORS,
          },
        },
      },
      "/me/communaute": {
        put: {
          tags: ["Profil"],
          operationId: "joinCommunity",
          summary: "Rejoindre une communauté publique",
          security: SESSION,
          requestBody: body(joinCommunitySchema, "La communauté choisie."),
          responses: {
            "200": okJson(ref("Customer"), "La fiche à jour."),
            ...AUTH_ERRORS,
            ...VALIDATION_ERRORS,
            "422": errorRef(
              "Champs invalides (validation_failed) ou communauté privée, inactive ou inconnue (community_not_joinable).",
            ),
            ...COMMON_ERRORS,
          },
        },
        delete: {
          tags: ["Profil"],
          operationId: "leaveCommunity",
          summary: "Quitter ma communauté",
          security: SESSION,
          responses: {
            "200": okJson(ref("Customer"), "La fiche à jour."),
            ...AUTH_ERRORS,
            ...COMMON_ERRORS,
          },
        },
      },
      "/me/notifications": {
        get: {
          tags: ["Profil"],
          operationId: "listMyNotifications",
          summary: "Les notifications d'état déposées pour moi",
          security: SESSION,
          parameters: queryParameters(listQuerySchema),
          responses: {
            "200": okJson(
              ref("NotificationList"),
              "Les plus récentes d'abord.",
            ),
            ...AUTH_ERRORS,
            "422": VALIDATION_ERRORS["422"],
            ...COMMON_ERRORS,
          },
        },
      },
      "/commandes/devis": {
        post: {
          tags: ["Commandes"],
          operationId: "quoteOrder",
          summary: "Le prix d'un panier (devis)",
          description:
            "Lignes instantanées, meilleure remise (fidélité ou communauté), frais au barème (offerts à une communauté), total. À afficher avant le paiement ; le total est celui que POST /commandes attend.",
          security: SESSION,
          requestBody: body(quoteSchema, "Le panier."),
          responses: {
            "200": okJson(ref("Quote"), "Le devis."),
            ...AUTH_ERRORS,
            ...VALIDATION_ERRORS,
            "422": errorRef(
              "Champs invalides (validation_failed) ou panier refusé (quote_invalid) : details.problems liste chaque ligne fautive (QuoteProblem).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/commandes": {
        get: {
          tags: ["Commandes"],
          operationId: "listMyOrders",
          summary: "Mes commandes",
          security: SESSION,
          parameters: queryParameters(listQuerySchema),
          responses: {
            "200": okJson(
              ref("OrderList"),
              "Les plus récentes d'abord, par curseur.",
            ),
            ...AUTH_ERRORS,
            "422": VALIDATION_ERRORS["422"],
            ...COMMON_ERRORS,
          },
        },
        post: {
          tags: ["Commandes"],
          operationId: "createOrder",
          summary: "Créer une commande payée",
          description:
            "Le dashboard recalcule le devis et refuse un total différent de `expectedTotalCents` (409 total_mismatch, avec le devis à jour). Créneau d'une heure pile entre 10:00 et 20:00, d'aujourd'hui (deux heures de délai) à trente jours. Adresse : le lieu de retrait pour un membre de communauté, sinon la rue du profil (obligatoire). Idempotency-Key obligatoire.",
          security: SESSION,
          parameters: [IDEMPOTENCY_HEADER],
          requestBody: body(
            createOrderSchema,
            "Panier, créneau, total payé et référence du paiement.",
          ),
          responses: {
            "201": okJson(ref("Order"), "Commande créée, en préparation."),
            "400": errorRef(
              "JSON illisible (bad_request) ou en-tête absent (idempotency_key_required).",
            ),
            "409": errorRef(
              "Total différent du devis (total_mismatch, details.quote) ou même clé en cours de traitement (idempotency_in_progress).",
            ),
            ...AUTH_ERRORS,
            "413": VALIDATION_ERRORS["413"],
            "415": VALIDATION_ERRORS["415"],
            "422": errorRef(
              "Champs invalides (validation_failed), panier refusé (quote_invalid, details.problems), créneau non réservable (slot_unavailable), adresse manquante (address_required) ou clé réutilisée avec un autre corps (idempotency_key_reused).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/commandes/{id}": {
        get: {
          tags: ["Commandes"],
          operationId: "getMyOrder",
          summary: "Une de mes commandes",
          security: SESSION,
          parameters: [idParameter("Identifiant de la commande.")],
          responses: {
            "200": okJson(ref("Order"), "La commande."),
            ...AUTH_ERRORS,
            "404": errorRef(
              "Commande introuvable ou d'un autre client (not_found).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/commandes/{id}/annulation": {
        post: {
          tags: ["Commandes"],
          operationId: "cancelMyOrder",
          summary: "Annuler ma commande en préparation",
          description:
            "Possible tant que la commande est en préparation ; motif « Annulée par le client », précision facultative. Idempotent : rejouer l'annulation renvoie 200.",
          security: SESSION,
          parameters: [idParameter("Identifiant de la commande.")],
          requestBody: {
            required: false,
            description: "Précision facultative.",
            content: jsonContent(schemaOf(cancelOrderSchema, "input")),
          },
          responses: {
            "200": okJson(ref("Order"), "La commande annulée."),
            ...AUTH_ERRORS,
            "404": errorRef(
              "Commande introuvable ou d'un autre client (not_found).",
            ),
            "409": errorRef(
              "Plus en préparation (not_cancellable) ou modifiée entre-temps (conflict).",
            ),
            ...VALIDATION_ERRORS,
            ...COMMON_ERRORS,
          },
        },
      },
      "/messages": {
        get: {
          tags: ["Messages"],
          operationId: "listMyMessages",
          summary: "Mes demandes « Nous contacter »",
          security: SESSION,
          parameters: queryParameters(listQuerySchema),
          responses: {
            "200": okJson(
              ref("MessageList"),
              "Les plus récentes d'abord, par curseur.",
            ),
            ...AUTH_ERRORS,
            "422": VALIDATION_ERRORS["422"],
            ...COMMON_ERRORS,
          },
        },
        post: {
          tags: ["Messages"],
          operationId: "createMessage",
          summary: "Déposer une demande « Nous contacter »",
          description:
            "Objet, texte, commande jointe (la mienne) et pièces jointes hébergées par l'application (métadonnées et URL https, dix au plus, formats PDF et images). Idempotency-Key obligatoire.",
          security: SESSION,
          parameters: [IDEMPOTENCY_HEADER],
          requestBody: body(createMessageSchema, "La demande."),
          responses: {
            "201": okJson(ref("Message"), "Demande déposée."),
            "400": errorRef(
              "JSON illisible (bad_request) ou en-tête absent (idempotency_key_required).",
            ),
            "409": errorRef(
              "Même clé en cours de traitement (idempotency_in_progress).",
            ),
            ...AUTH_ERRORS,
            "413": VALIDATION_ERRORS["413"],
            "415": VALIDATION_ERRORS["415"],
            "422": errorRef(
              "Champs invalides (validation_failed), commande jointe inconnue ou d'un autre client (order_not_owned) ou clé réutilisée avec un autre corps (idempotency_key_reused).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/service/notifications": {
        get: {
          tags: ["Service"],
          operationId: "listPendingNotifications",
          summary: "La file des notifications à envoyer",
          description:
            "Dans l'ordre de dépôt. Après envoi par son canal, le serveur appelle POST /service/notifications/{id}/envoi.",
          security: SERVICE,
          parameters: queryParameters(pendingNotificationsQuerySchema),
          responses: {
            "200": okJson(
              ref("PendingNotificationList"),
              "Les notifications en attente (nextCursor toujours null).",
            ),
            "401": errorRef(
              "Clé de service absente ou fausse (unauthenticated).",
            ),
            "422": VALIDATION_ERRORS["422"],
            "503": errorRef(
              "Clé de service non configurée sur le serveur (service_unavailable).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
      "/service/notifications/{id}/envoi": {
        post: {
          tags: ["Service"],
          operationId: "markNotificationSent",
          summary: "Accuser l'envoi d'une notification",
          security: SERVICE,
          parameters: [idParameter("Identifiant de la notification.")],
          responses: {
            "200": okJson(ref("Ok"), "Envoi enregistré (sent_at posé)."),
            "401": errorRef(
              "Clé de service absente ou fausse (unauthenticated).",
            ),
            "404": errorRef("Notification introuvable (not_found)."),
            "409": errorRef("Déjà marquée envoyée (already_sent)."),
            "503": errorRef(
              "Clé de service non configurée sur le serveur (service_unavailable).",
            ),
            ...COMMON_ERRORS,
          },
        },
      },
    },
  };
}
