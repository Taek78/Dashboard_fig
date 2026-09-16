import { Download, ShieldCheck } from "lucide-react";
import { AnonymizeCustomerButton } from "@/components/customers/anonymize-customer-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer } from "@/domain/customers/types";
import { formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Encart « Données personnelles » de la fiche client (serveur) : les deux
 * droits que l'équipe peut avoir à exercer pour la personne. Export (lien de
 * téléchargement, route /clients/[id]/export) et anonymisation, réservés à
 * l'administrateur ; les autres rôles voient à qui s'adresser. Un client
 * anonymisé affiche la date et ce qui a été effacé.
 */
export function CustomerPrivacyPanel({
  customer,
  canHandle,
}: {
  customer: Customer;
  canHandle: boolean;
}) {
  return (
    <Card id="donnees-personnelles" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-primary size-5" aria-hidden="true" />
          <h2>Données personnelles (RGPD)</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {customer.anonymizedAt ? (
          <p role="note" className="bg-muted/40 rounded-lg border px-3 py-2">
            Client anonymisé le {formatDateTimeFr(customer.anonymizedAt)} :
            identité, coordonnées, adhésion et notes internes effacées. Les
            commandes restent pour la comptabilité.
          </p>
        ) : null}
        {canHandle ? (
          <div className="grid gap-4 @2xl/main:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">
                Droit d&apos;accès et portabilité
              </h3>
              <p className="text-muted-foreground">
                Toutes les données gardées sur ce client (fiche, notes internes,
                commandes et leur historique) dans un fichier JSON à transmettre
                à la personne qui les demande. Chaque export est journalisé.
              </p>
              <a
                href={`/clients/${customer.id}/export`}
                download
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "self-start",
                )}
              >
                <Download />
                Exporter les données
              </a>
            </section>
            {customer.anonymizedAt ? null : (
              <section className="flex flex-col gap-2">
                <h3 className="font-semibold">Droit à l&apos;effacement</h3>
                <p className="text-muted-foreground">
                  Efface définitivement ce qui identifie la personne. Les
                  commandes, pièces comptables, ne peuvent pas être supprimées :
                  elles restent, rattachées à un client anonyme.
                </p>
                <AnonymizeCustomerButton
                  customerId={customer.id}
                  name={customer.fullName}
                />
              </section>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Une demande d&apos;accès à ses données ou d&apos;effacement de la
            part de ce client est traitée par un administrateur.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
