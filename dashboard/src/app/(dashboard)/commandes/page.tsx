import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

/* Commandes : la liste et ses états arrivent en A1.6, l'en-tête seul d'ici là. */
export const metadata: Metadata = { title: "Commandes" };

export default function CommandesPage() {
  return (
    <PageHeader
      title="Commandes"
      description="Suivez et préparez les commandes à livrer."
    />
  );
}
