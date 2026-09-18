import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { withIdempotency } from "@/app/api/v1/_lib/idempotency";
import { createMessage, listCustomerMessages } from "@/data/messages";
import { getOrder } from "@/data/orders";
import { logSecurity } from "@/data/security-log";
import { createMessageSchema, listQuerySchema } from "@/domain/api/schemas";
import { messageView, pageView } from "@/domain/api/views";
import { decodeCursor } from "@/lib/api/cursor";
import { ApiError } from "@/lib/api/errors";
import { parseJson, readJsonText, readQuery } from "@/lib/api/request";
import { AttachmentUnavailableError } from "@/lib/attachment-error";

/*
 * GET /api/v1/messages?limit=&cursor= : mes demandes « Nous contacter », les
 * plus récentes d'abord, avec leur état de traitement.
 * POST /api/v1/messages (Idempotency-Key obligatoire) : dépose une demande
 * (objet, texte, commande jointe qui doit être la mienne, pièces jointes :
 * identifiants de fichiers déjà téléversés par POST /fichiers, dix au plus,
 * chacun à moi et joint à rien d'autre).
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET", "POST"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { limit, cursor } = readQuery(call.request.url, listQuerySchema);
  const page = await listCustomerMessages(customer.id, {
    limit,
    after: decodeCursor(cursor),
  });
  return json(call, pageView(page, messageView));
});

export const POST = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const text = await readJsonText(call.request);
  return withIdempotency(call, customer.id, text, async () => {
    const input = parseJson(text, createMessageSchema);
    const orderId = input.orderId ?? null;
    if (orderId !== null) {
      const order = await getOrder(orderId);
      if (!order || order.customer.id !== customer.id) {
        throw new ApiError(
          422,
          "order_not_owned",
          "La commande jointe n'existe pas ou n'est pas la vôtre.",
        );
      }
    }
    const message = await createMessage({
      customerId: customer.id,
      subject: input.subject,
      body: input.body,
      orderId,
      uploadIds: input.fileIds ?? [],
    }).catch((error: unknown) => {
      if (error instanceof AttachmentUnavailableError) {
        throw new ApiError(
          422,
          "attachment_unavailable",
          "Un fichier joint est introuvable, n'est pas le vôtre ou est déjà joint à un autre message.",
          { details: { fileIds: error.uploadIds } },
        );
      }
      throw error;
    });
    logSecurity({
      type: "api_message_created",
      customerId: customer.id,
      messageId: message.id,
    });
    return { status: 201, body: messageView(message) };
  });
});
