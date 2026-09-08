import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

/* Clients et support (jalon A5) : état vide en attendant. */
export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Comptes clients et historique de leurs commandes."
      />
      <ComingSoon feature="La gestion des clients" />
    </>
  );
}
