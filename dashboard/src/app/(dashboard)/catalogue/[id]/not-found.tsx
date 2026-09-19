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

export default function ProduitNotFound() {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-none border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
          <PackageSearch />
        </EmptyMedia>
        <EmptyTitle>Produit introuvable</EmptyTitle>
        <EmptyDescription>
          Ce produit n&apos;existe pas ou n&apos;est plus au catalogue.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/catalogue" />}>
          Retour au catalogue
        </Button>
      </EmptyContent>
    </Empty>
  );
}
