import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

/* Métriques et pilotage (jalon A6) : état vide en attendant. */
export const metadata: Metadata = { title: "Métriques" };

export default function MetriquesPage() {
  return (
    <>
      <PageHeader
        title="Métriques"
        description="Chiffres clés pour piloter l'activité."
      />
      <ComingSoon feature="Les métriques" />
    </>
  );
}
