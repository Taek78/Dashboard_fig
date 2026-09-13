import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* Création d'un produit : le même formulaire que la fiche, sans produit. */
export const metadata: Metadata = { title: "Nouveau produit" };

export default function NouveauProduitPage() {
  return (
    <>
      <PageHeader
        title="Nouveau produit"
        description="Renseignez la fiche ; vous pourrez tout modifier ensuite."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/catalogue" />}
          >
            <ArrowLeft />
            Retour au catalogue
          </Button>
        }
      />
      <Card>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </>
  );
}
