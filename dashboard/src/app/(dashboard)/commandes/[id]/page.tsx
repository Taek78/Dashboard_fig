import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderDetail } from "@/components/orders/order-detail";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getOrder, getOrderEvents } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import { orderIdSchema } from "@/domain/orders/schemas";
import { assignmentOptions } from "@/domain/staff/rules";
import { formatSlot } from "@/lib/format";

/*
 * Détail d'une commande : route dynamique, /commandes/cmd-0001 rend cette page avec
 * params = { id: "cmd-0001" }. En Next 16, params est une Promise : await.
 *
 * - `params.id` est une entrée hostile comme un FormData : validé par orderIdSchema.
 * - notFound() lève et affiche not-found.tsx (404) : pas de return devant, jamais
 *   dans un try/catch.
 * - La session permet de masquer le formulaire au rôle lecture ;
 *   ce n'est qu'un confort, l'action revérifie le rôle.
 * - Titre statique : un titre avec la référence exigerait un second getOrder (parking).
 */
export const metadata: Metadata = { title: "Détail de la commande" };

export default async function CommandePage({
  params,
}: PageProps<"/commandes/[id]">) {
  const { id } = await params;
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const order = await getOrder(parsed.data);
  if (!order) notFound();
  const [events, user, staff] = await Promise.all([
    getOrderEvents(order.id),
    getCurrentUser(),
    listStaff(),
  ]);

  return (
    <>
      <PageHeader
        title={`Commande ${order.reference}`}
        description={`${order.customer.fullName} · ${formatSlot(order.deliverySlot)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/commandes" />}
          >
            <ArrowLeft />
            Retour aux commandes
          </Button>
        }
      />
      <OrderDetail
        order={order}
        events={events}
        canEdit={canChangeOrderStatus(user.role)}
        canAssign={canAssignStaff(user.role)}
        options={assignmentOptions(staff)}
      />
    </>
  );
}
