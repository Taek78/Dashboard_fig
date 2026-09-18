import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { getOrder } from "@/data/orders";
import { apiIdSchema } from "@/domain/api/schemas";
import { orderView } from "@/domain/api/views";
import { notFound } from "@/lib/api/errors";

/* GET /api/v1/commandes/{id} : une de MES commandes ; celle d'un autre client est « introuvable ». */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute<{ id: string }>(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const id = apiIdSchema.safeParse(call.params.id);
  const order = id.success ? await getOrder(id.data) : null;
  if (!order || order.customer.id !== customer.id) {
    throw notFound("Commande introuvable.");
  }
  return json(call, orderView(order));
});
