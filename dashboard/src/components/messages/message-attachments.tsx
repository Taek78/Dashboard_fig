import Image from "next/image";
import { FileText, Paperclip } from "lucide-react";
import {
  ATTACHMENT_FORMAT_LABELS,
  isPreviewableImage,
} from "@/domain/messages/attachment";
import type { MessageAttachment } from "@/domain/messages/types";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Pièces jointes d'un message (serveur) : dix au plus, photos et PDF.
 *
 * Leur présence a sa couleur (token --attachment, violet, réservé à cet
 * usage) : une pastille sur la carte et sur l'en-tête de la fiche, un anneau
 * autour de chaque vignette. Demande du client : « qu'elle ne se rate pas ».
 * La couleur n'est jamais seule : le nombre et le trombone la disent aussi.
 *
 * Les fichiers sont hébergés par l'application FIG (question 22) : on affiche
 * l'aperçu d'une image et une vignette « document » pour un PDF, et chaque
 * tuile est un lien qui ouvre le fichier dans un nouvel onglet. `unoptimized`
 * parce que l'optimiseur de Next ne connaît pas ces hôtes ; la CSP autorise
 * déjà les images en https (src/lib/csp.ts), jamais les objets embarqués
 * (object-src 'none'), d'où un lien et non un <embed> pour les PDF.
 *
 * rel="noopener noreferrer" : la page ouverte ne peut ni manipuler la nôtre par
 * window.opener, ni lire d'où vient le clic.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

/** « 2 pièces jointes » en pastille violette ; rien sans pièce jointe. */
export function AttachmentBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "bg-attachment/15 text-attachment ring-attachment/40 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ring-1",
        className,
      )}
    >
      <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
      {count} pièce{plural(count)} jointe{plural(count)}
    </span>
  );
}

export function MessageAttachments({
  attachments,
}: {
  attachments: readonly MessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section className="border-attachment/40 bg-attachment/5 flex flex-col gap-3 rounded-xl border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AttachmentBadge count={attachments.length} />
        <span className="text-muted-foreground font-normal">
          envoyée{plural(attachments.length)} par le client
        </span>
      </h3>
      <ul className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-3 @4xl/main:grid-cols-4">
        {attachments.map((file) => (
          <li key={file.id}>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${file.fileName} (${file.contentType})`}
              className="bg-card ring-attachment/40 hover:bg-attachment/10 focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-xl ring-1 transition-colors focus-visible:ring-3"
            >
              <span className="bg-attachment/10 relative flex h-24 items-center justify-center">
                {isPreviewableImage(file.contentType) ? (
                  <Image
                    src={file.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 200px, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <FileText
                    className="text-attachment size-8"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 p-2">
                <span className="truncate text-sm font-medium">
                  {file.fileName}
                </span>
                <span className="text-muted-foreground text-xs">
                  {ATTACHMENT_FORMAT_LABELS[file.contentType]} ·{" "}
                  {formatFileSize(file.sizeBytes)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
