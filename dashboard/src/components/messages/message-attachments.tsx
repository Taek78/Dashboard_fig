import Image from "next/image";
import { FileText, Paperclip } from "lucide-react";
import {
  ATTACHMENT_FORMAT_LABELS,
  isPreviewableImage,
} from "@/domain/messages/attachment";
import type { MessageAttachment } from "@/domain/messages/types";
import { formatFileSize } from "@/lib/format";

/*
 * Pièces jointes d'un message (serveur) : dix au plus, photos et PDF.
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
export function MessageAttachments({
  attachments,
}: {
  attachments: readonly MessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Paperclip className="size-4" aria-hidden="true" />
        {attachments.length} pièce{attachments.length > 1 ? "s" : ""} jointe
        {attachments.length > 1 ? "s" : ""}
      </h3>
      <ul className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-3 @4xl/main:grid-cols-4">
        {attachments.map((file) => (
          <li key={file.id}>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${file.fileName} (${file.contentType})`}
              className="bg-card ring-foreground/10 hover:bg-muted/50 focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-xl ring-1 transition-colors focus-visible:ring-3"
            >
              <span className="bg-muted/40 relative flex h-24 items-center justify-center">
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
                    className="text-muted-foreground size-8"
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
