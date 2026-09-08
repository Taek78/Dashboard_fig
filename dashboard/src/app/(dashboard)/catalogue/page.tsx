import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

/* Catalogue et stocks (jalon A4) : état vide en attendant. */
export const metadata: Metadata = { title: "Catalogue" };

export default function CataloguePage() {
  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Produits, prix et stocks proposés dans l'application."
      />
      <ComingSoon feature="Le catalogue" />
    </>
  );
}
