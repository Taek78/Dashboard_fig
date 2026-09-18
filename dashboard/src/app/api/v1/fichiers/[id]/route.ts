import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, preflight } from "@/app/api/v1/_lib/context";
import { getUploadFile } from "@/data/message-uploads";
import { apiIdSchema } from "@/domain/api/schemas";
import { attachmentHeaders } from "@/domain/messages/upload";
import { corsHeaders } from "@/lib/api/cors";
import { notFound } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";

/*
 * GET /api/v1/fichiers/{id} : un de MES fichiers, pour que l'application
 * réaffiche les pièces jointes de mes messages. Le fichier d'une autre
 * personne répond 404 comme un fichier inconnu : on ne dit pas qu'il existe.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute<{ id: string }>(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const id = apiIdSchema.safeParse(call.params.id);
  const file = id.success ? await getUploadFile(id.data) : null;
  if (!file || file.customerId !== customer.id) {
    throw notFound("Fichier introuvable.");
  }
  return new Response(Buffer.from(file.bytes), {
    headers: {
      ...attachmentHeaders(file),
      ...corsHeaders(call.origin, getEnv().API_CORS_ORIGINS ?? [], METHODS),
    },
  });
});
