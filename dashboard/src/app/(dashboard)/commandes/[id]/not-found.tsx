import Link from "next/link";
import { PackageSearch } from "lucide-react";
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
 * Affiché par notFound() depuis page.tsx (id invalide ou commande absente), avec
 * un code 404. Composant serveur sans props. Pas de PageHeader : rien à titrer
 * pour une ressource qui n'existe pas.
 */
export default function CommandeNotFound() {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
          <PackageSearch />
        </EmptyMedia>
        <EmptyTitle>Commande introuvable</EmptyTitle>
        <EmptyDescription>
          Cette commande n&apos;existe pas ou n&apos;est plus disponible.
          Vérifiez la référence ou revenez à la liste.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/commandes" />}>
          Retour aux commandes
        </Button>
      </EmptyContent>
    </Empty>
  );
}
