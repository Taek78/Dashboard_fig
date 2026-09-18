import { getMessage } from "@/data/messages";
import { getUploadFiles } from "@/data/message-uploads";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { canReadMessageFiles } from "@/domain/auth/roles";
import { attachmentsArchiveName } from "@/domain/messages/attachment";
import { messageIdSchema } from "@/domain/messages/schemas";
import { isCrossSiteRequest } from "@/lib/fetch-site";
import { buildZip, uniqueNames } from "@/lib/zip";

/*
 * GET /messages/[id]/pieces-jointes/archive : toutes les pièces jointes
 * HÉBERGÉES d'un message en une archive ZIP (« Télécharger les pièces
 * jointes » du menu de la pastille). Mêmes gardes que la route d'un fichier :
 * session → rôle qui lit la boîte de réception (refus journalisé) → autre
 * site refusé → zod → relecture du message. Seuls les fichiers de CE message
 * entrent dans l'archive, dans l'ordre d'envoi ; une pièce jointe antérieure
 * (URL chez l'application) n'a pas d'octets ici et n'y figure pas.
 * Dix fichiers de 5 Mo au plus : l'archive se construit en mémoire.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  request: Request,
  ctx: RouteContext<"/messages/[id]/pieces-jointes/archive">,
) {
  const user = await getCurrentUser();
  const crossSite = isCrossSiteRequest(request.headers);
  if (!canReadMessageFiles(user.role) || crossSite) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: crossSite
        ? "downloadMessageFiles:cross-site"
        : "downloadMessageFiles",
    });
    return new Response("Accès refusé à ces pièces jointes.", {
      status: 403,
      headers: NO_STORE,
    });
  }

  const parsed = messageIdSchema.safeParse((await ctx.params).id);
  const message = parsed.success ? await getMessage(parsed.data) : null;
  if (!message) {
    return new Response("Message introuvable.", {
      status: 404,
      headers: NO_STORE,
    });
  }
  const uploadIds = message.attachments.flatMap((file) =>
    file.uploadId === null ? [] : [file.uploadId],
  );
  const files = await getUploadFiles(uploadIds);
  if (files.length === 0) {
    return new Response("Aucune pièce jointe à télécharger pour ce message.", {
      status: 404,
      headers: NO_STORE,
    });
  }

  const receivedAt = new Date(message.receivedAt);
  const names = uniqueNames(files.map((file) => file.fileName));
  const zip = buildZip(
    files.map((file, i) => ({
      name: names[i]!,
      bytes: file.bytes,
      modifiedAt: receivedAt,
    })),
  );
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="${attachmentsArchiveName(message)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
