import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getOrders } from "@/data/orders";
import { readSimulationMode } from "@/lib/simulation";

/*
 * Liste des commandes. Composant serveur async : lit l'URL, charge via la façade
 * (@/data/orders, jamais le mock), rend le tableau ou l'état vide.
 * ?simuler=vide|erreur ne fonctionne qu'en développement (readSimulationMode).
 * Un tableau vide est « vrai » en JS : on teste orders.length, pas orders.
 */
export const metadata: Metadata = { title: "Commandes" };

export default async function CommandesPage({
  searchParams,
}: PageProps<"/commandes">) {
  const { simuler } = await searchParams;
  const mode = readSimulationMode(
    simuler,
    process.env.NODE_ENV === "development",
  );
  if (mode === "erreur") throw new Error("Simulation d'erreur");
  const orders = mode === "vide" ? [] : await getOrders();

  return (
    <>
      <PageHeader
        title="Commandes"
        description="Suivez et préparez les commandes à livrer."
      />
      {orders.length === 0 ? (
        <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
            >
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>Aucune commande</EmptyTitle>
            <EmptyDescription>
              Les commandes passées dans l&apos;application FIG apparaîtront
              ici.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </>
  );
}
