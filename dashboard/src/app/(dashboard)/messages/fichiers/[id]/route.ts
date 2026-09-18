import { getUploadFile } from "@/data/message-uploads";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { canReadMessageFiles } from "@/domain/auth/roles";
import { DOWNLOAD_PARAM } from "@/domain/messages/attachment";
import { uploadIdSchema } from "@/domain/messages/schemas";
import { attachmentHeaders } from "@/domain/messages/upload";
import { isCrossSiteRequest } from "@/lib/fetch-site";

/*
 * GET /messages/fichiers/[id] : une pièce jointe hébergée, pour le
 * back-office (vignette de la fiche d'un message, ou le fichier ouvert dans
 * un onglet). Route Handler : une balise <img> ou un lien suffisent, sans
 * JavaScript.
 * Session (redirection sans session) → rôle (quiconque lit la boîte de
 * réception ; refus journalisé) → autre site refusé (une image intégrée
 * ailleurs ne sort rien) → zod → lecture. Une image s'affiche, un PDF se
 * télécharge (attachmentHeaders) ; ?telecharger=1 télécharge aussi une image
 * (icône « Télécharger » de la tuile). Consulter n'est pas journalisé : c'est la
 * lecture ordinaire d'un message.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  request: Request,
  ctx: RouteContext<"/messages/fichiers/[id]">,
) {
  const user = await getCurrentUser();
  const crossSite = isCrossSiteRequest(request.headers);
  if (!canReadMessageFiles(user.role) || crossSite) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: crossSite ? "readMessageFile:cross-site" : "readMessageFile",
    });
    return new Response("Accès refusé à cette pièce jointe.", {
      status: 403,
      headers: NO_STORE,
    });
  }

  const parsed = uploadIdSchema.safeParse((await ctx.params).id);
  const file = parsed.success ? await getUploadFile(parsed.data) : null;
  if (!file) {
    return new Response("Pièce jointe introuvable.", {
      status: 404,
      headers: NO_STORE,
    });
  }
  const download =
    new URL(request.url).searchParams.get(DOWNLOAD_PARAM) === "1";
  return new Response(Buffer.from(file.bytes), {
    headers: attachmentHeaders(file, { download }),
  });
}
