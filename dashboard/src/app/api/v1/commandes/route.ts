import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { orderContextFor } from "@/app/api/v1/_lib/customers";
import { withIdempotency } from "@/app/api/v1/_lib/idempotency";
import { createOrder, listCustomerOrders } from "@/data/orders";
import { logSecurity } from "@/data/security-log";
import { createOrderSchema, listQuerySchema } from "@/domain/api/schemas";
import { orderView, pageView, quoteView } from "@/domain/api/views";
import { buildQuote, isSlotBookable } from "@/domain/orders/quote";
import { decodeCursor } from "@/lib/api/cursor";
import { ApiError } from "@/lib/api/errors";
import { parseJson, readJsonText, readQuery } from "@/lib/api/request";

/*
 * GET /api/v1/commandes?limit=&cursor= : mes commandes, les plus récentes
 * d'abord, par curseur.
 * POST /api/v1/commandes (Idempotency-Key obligatoire) : crée une commande
 * déjà PAYÉE dans l'application. Le dashboard recalcule le devis (jamais
 * confiance aux prix reçus), vérifie le créneau et l'adresse, et refuse si le
 * total payé (expectedTotalCents) diffère du sien (409 total_mismatch, avec le
 * devis à jour) : la commande entre en préparation avec le prix que le
 * dashboard a calculé. Adresse : le lieu de retrait pour un membre de
 * communauté, sinon la rue de la personne (obligatoire).
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET", "POST"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { limit, cursor } = readQuery(call.request.url, listQuerySchema);
  const page = await listCustomerOrders(customer.id, {
    limit,
    after: decodeCursor(cursor),
  });
  return json(call, pageView(page, orderView));
});

export const POST = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const text = await readJsonText(call.request);
  return withIdempotency(call, customer.id, text, async () => {
    const input = parseJson(text, createOrderSchema);
    const context = await orderContextFor(customer);
    const result = buildQuote(input.lines, context);
    if (!result.ok) {
      throw new ApiError(
        422,
        "quote_invalid",
        "Le panier contient des lignes invalides.",
        { details: { problems: result.problems } },
      );
    }
    if (!isSlotBookable(input.deliverySlot, call.now)) {
      throw new ApiError(
        422,
        "slot_unavailable",
        "Ce créneau ne peut pas être réservé : une heure pile entre 10:00 et 20:00, d'aujourd'hui (deux heures de délai) à trente jours.",
      );
    }
    const { quote } = result;
    if (quote.totalCents !== input.expectedTotalCents) {
      throw new ApiError(
        409,
        "total_mismatch",
        "Le total a changé depuis le devis : refaites un devis avant de payer.",
        { details: { quote: quoteView(quote) } },
      );
    }
    const community = context.communityDetails;
    if (!community && customer.addressLine === null) {
      throw new ApiError(
        422,
        "address_required",
        "Renseignez votre adresse de livraison (rue) avant de commander.",
      );
    }
    const order = await createOrder({
      customerId: customer.id,
      deliverySlot: input.deliverySlot,
      deliveryAddressLine: community
        ? community.pickupPlace
        : customer.addressLine,
      deliveryCity: community ? community.pickupCity : customer.city,
      deliveryPostalCode: community
        ? community.pickupPostalCode
        : customer.postalCode,
      lines: quote.lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unit: line.unit,
        lineTotalCents: line.lineTotalCents,
      })),
      deliveryFeeCents: quote.deliveryFeeCents,
      totalCents: quote.totalCents,
      communityId: community?.id ?? null,
      discount: quote.discount,
      paymentReference: input.paymentReference ?? null,
    });
    logSecurity({
      type: "api_order_created",
      customerId: customer.id,
      orderId: order.id,
    });
    return { status: 201, body: orderView(order) };
  });
});
