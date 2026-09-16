import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerCard } from "@/components/customers/customer-card";
import { MessageDetail } from "@/components/messages/message-detail";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCustomer } from "@/data/customers";
import { getMessage } from "@/data/messages";
import { getDirectoryStats } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canHandleMessages } from "@/domain/auth/roles";
import { buildCustomerEntries } from "@/domain/customers/directory";
import { messageIdSchema } from "@/domain/messages/schemas";

/*
 * Message complet, avec LA FICHE DU CLIENT JUSTE AU-DESSUS : on répond mieux à
 * une réclamation en voyant d'un coup d'œil qui écrit, depuis quand, combien de
 * commandes et sa dernière livraison.
 *
 * La fiche réutilise la CustomerCard de l'annuaire (mêmes chiffres, mêmes
 * couleurs, même bouton « Voir le détail ») : un seul composant à maintenir, et
 * l'équipe retrouve exactement ce qu'elle connaît. Ses chiffres sont agrégés
 * par la base pour ce client seul (getDirectoryStats({ customerId })).
 *
 * Un client anonymisé (RGPD) n'a plus ni nom ni coordonnées : la carte le dit
 * d'elle-même. Le message, lui, aurait disparu avec l'anonymisation.
 */
export const metadata: Metadata = { title: "Message client" };

export default async function MessagePage({
  params,
}: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const parsed = messageIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const message = await getMessage(parsed.data);
  if (!message) notFound();

  const [customer, directory, user] = await Promise.all([
    getCustomer(message.customer.id),
    getDirectoryStats({ customerId: message.customer.id }),
    getCurrentUser(),
  ]);
  // Le client existe forcément (clé étrangère), mais la source peut renvoyer
  // null si quelqu'un l'a supprimé entre les deux lectures.
  if (!customer) notFound();
  const entry = buildCustomerEntries(
    [customer],
    directory,
    new Date().toISOString(),
  )[0]!;

  return (
    <>
      <PageHeader
        title={`Message de ${customer.fullName}`}
        description="Fiche du client, puis sa demande complète."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/messages" />}
          >
            <ArrowLeft />
            Retour aux messages
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <CustomerCard entry={entry} />
        <MessageDetail
          message={message}
          canHandle={canHandleMessages(user.role)}
        />
      </div>
    </>
  );
}
