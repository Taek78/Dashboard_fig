import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/*
 * Affiché par notFound() depuis page.tsx (identifiant invalide, message absent,
 * ou client supprimé entre deux lectures), avec un code 404. Un message
 * disparaît aussi quand son auteur est anonymisé (RGPD) : ce n'est pas une
 * erreur, d'où le texte qui l'explique plutôt qu'un simple « introuvable ».
 */
export default function MessageNotFound() {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-none border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>Message introuvable</EmptyTitle>
        <EmptyDescription>
          Ce message n&apos;existe pas, ou il a été supprimé avec les données de
          son auteur lors d&apos;une anonymisation RGPD.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/messages" />}>
          Retour aux messages
        </Button>
      </EmptyContent>
    </Empty>
  );
}
