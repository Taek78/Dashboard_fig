import Link from "next/link";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { buttonVariants } from "@/components/ui/button";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerHistoryPeriod } from "@/domain/customers/schemas";
import { cn } from "@/lib/utils";

/*
 * Période de l'historique d'un client (serveur ; AutoSubmitForm, client, la
 * lance dès qu'une date est choisie, vers la fiche elle-même) : jour de
 * livraison du… au…, bornes facultatives. Les champs deviennent l'URL de la
 * fiche (?du=&au=) et la pagination repart à la première page ; la position de
 * défilement est gardée, l'historique est en bas de la fiche.
 */
export function CustomerHistoryFilters({
  customerId,
  period,
}: {
  customerId: string;
  period: CustomerHistoryPeriod;
}) {
  const active = period.from !== undefined || period.to !== undefined;

  return (
    <AutoSubmitForm
      action={`/clients/${customerId}`}
      aria-label="Période de l'historique"
      className="bg-muted/30 flex flex-col gap-3 rounded-xl border p-3"
    >
      <div className="grid grid-cols-2 gap-3 @2xl/main:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="historique-du">Livraison du</Label>
          <NativeInput
            id="historique-du"
            name="du"
            type="date"
            defaultValue={period.from ?? ""}
            className="dark:scheme-dark"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="historique-au">Livraison au</Label>
          <NativeInput
            id="historique-au"
            name="au"
            type="date"
            defaultValue={period.to ?? ""}
            className="dark:scheme-dark"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <Link
            href={`/clients/${customerId}`}
            scroll={false}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <RotateCcw />
            Toutes les dates
          </Link>
        ) : null}
        <span
          className={cn(
            "text-muted-foreground hidden items-center gap-1.5 text-xs",
            "group-aria-busy/recherche:inline-flex",
          )}
        >
          <LoaderCircle
            aria-hidden="true"
            className="text-primary size-3.5 animate-spin"
          />
          Recherche…
        </span>
      </div>
    </AutoSubmitForm>
  );
}
