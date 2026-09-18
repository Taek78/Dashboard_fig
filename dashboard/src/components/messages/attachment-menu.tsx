"use client";

import { ChevronDown, Download, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { attachmentsArchiveHref } from "@/domain/messages/attachment";
import { cn } from "@/lib/utils";

/*
 * La pastille violette « 2 pièces jointes », devenue un BOUTON qui ouvre un
 * menu (demande du 2026-09-18) : « Télécharger les pièces jointes », l'archive
 * ZIP des fichiers hébergés du message. (L'option « Visualiser » a été retirée
 * le même jour, à la demande de l'auteur : les tuiles de la fiche suffisent.)
 * Le parent n'affiche ce bouton que s'il y a au moins un fichier hébergé ;
 * sinon la pastille reste une simple étiquette (AttachmentBadge), jamais un
 * menu vide.
 * Composant client (le menu vit dans le navigateur) dans son propre module :
 * un loading.tsx ne doit jamais importer un module qui en contient un (CSP).
 * Le libellé accessible dit ce que fait le bouton, pas seulement le nombre.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

export function AttachmentMenu({
  messageId,
  count,
  className,
}: {
  messageId: string;
  count: number;
  className?: string;
}) {
  const label = `${count} pièce${plural(count)} jointe${plural(count)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} : télécharger`}
        className={cn(
          "bg-attachment/15 text-attachment ring-attachment/40 hover:bg-attachment/25 focus-visible:ring-ring data-popup-open:bg-attachment/25 inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ring-1 transition-colors outline-none focus-visible:ring-3",
          className,
        )}
      >
        <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem href={attachmentsArchiveHref(messageId)} download>
          <Download className="text-attachment" aria-hidden="true" />
          Télécharger les pièces jointes
        </DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
