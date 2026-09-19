import Image from "next/image";
import { Download, FileText, Paperclip } from "lucide-react";
import { AttachmentMenu } from "@/components/messages/attachment-menu";
import {
  ATTACHMENT_FORMAT_LABELS,
  attachmentDownloadHref,
  attachmentHref,
  hasHostedAttachment,
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
 * La pastille est un bouton (AttachmentPill → AttachmentMenu, 2026-09-18)
 * qui propose « Télécharger les pièces jointes » (archive ZIP), dès qu'il y a
 * au moins un fichier hébergé ; sinon elle reste une étiquette.
 *
 * Les fichiers sont hébergés par le dashboard (2026-09-18) et servis par
 * /messages/fichiers/[id], qui vérifie la session et le rôle : on affiche
 * l'aperçu d'une image et une vignette « document » pour un PDF. Chaque tuile
 * porte DEUX liens côte à côte, jamais l'un dans l'autre (un lien imbriqué est
 * du HTML invalide, et le clavier n'atteindrait pas le second) : la tuile
 * ouvre le fichier dans un nouvel onglet, l'icône de coin le télécharge
 * (?telecharger=1). `unoptimized` : l'optimiseur de Next rechargerait le
 * fichier sans le cookie de session et serait refusé. Jamais d'objet embarqué
 * (object-src 'none'), d'où un lien et non un <embed>.
 *
 * rel="noopener noreferrer" : la page ouverte ne peut ni manipuler la nôtre par
 * window.opener, ni lire d'où vient le clic.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

/** « 2 pièces jointes » en pastille violette, sans action ; rien sans pièce jointe. */
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

/**
 * La pastille d'un message : un bouton qui ouvre le menu de téléchargement
 * s'il y a au moins un fichier hébergé, sinon une simple étiquette (une pièce
 * antérieure n'a pas d'octets ici : le menu serait vide). Rien sans pièce jointe.
 */
export function AttachmentPill({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: readonly MessageAttachment[];
}) {
  if (attachments.length === 0) return null;
  return hasHostedAttachment(attachments) ? (
    <AttachmentMenu messageId={messageId} count={attachments.length} />
  ) : (
    <AttachmentBadge count={attachments.length} />
  );
}

/** Icône ronde « Télécharger » posée dans le coin d'une pièce jointe. */
export function AttachmentDownloadLink({
  file,
  className,
}: {
  file: MessageAttachment;
  className?: string;
}) {
  const href = attachmentDownloadHref(file);
  if (href === null) return null;
  return (
    <a
      href={href}
      download={file.fileName}
      aria-label={`Télécharger ${file.fileName}`}
      title={`Télécharger ${file.fileName}`}
      className={cn(
        "bg-card/90 text-attachment ring-attachment/40 hover:bg-attachment hover:text-card focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-none shadow-sm ring-1 backdrop-blur-sm transition-colors outline-none focus-visible:ring-3",
        className,
      )}
    >
      <Download className="size-4" aria-hidden="true" />
    </a>
  );
}

export function MessageAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: readonly MessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section className="border-attachment/40 bg-attachment/5 flex flex-col gap-3 rounded-none border p-3">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <AttachmentPill messageId={messageId} attachments={attachments} />
      </h3>
      <ul className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-3 @4xl/main:grid-cols-4">
        {attachments.map((file) => {
          const href = attachmentHref(file);
          if (href === null) return null;
          return (
            <li key={file.id} className="relative">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={`${file.fileName} (${file.contentType})`}
                className="bg-card ring-attachment/40 hover:bg-attachment/10 focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-none ring-1 transition-colors focus-visible:ring-3"
              >
                <span className="bg-attachment/10 relative flex h-24 items-center justify-center">
                  {isPreviewableImage(file.contentType) ? (
                    <Image
                      src={href}
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
              <AttachmentDownloadLink
                file={file}
                className="absolute top-1.5 right-1.5"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
