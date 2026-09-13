import Link from "next/link";
import {
  TAX_MODE_LABELS,
  TAX_MODES,
  type TaxMode,
} from "@/domain/metrics/rules";
import { cn } from "@/lib/utils";

/*
 * Interrupteur HT / TTC (serveur), partagé par le tableau de bord et les
 * métriques. Deux liens vers la même page avec ?tva= : le choix vit dans
 * l'URL, sans JavaScript. `baseParams` rejoue les autres paramètres de la page
 * (période, plage, comparaison) pour ne pas les perdre en basculant.
 */
export function TaxModeSwitch({
  action,
  tax,
  baseParams,
}: {
  action: string;
  tax: TaxMode;
  baseParams: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      <span className="text-sm font-medium">Montants affichés</span>
      <div
        role="group"
        aria-label="Mode de TVA"
        className="bg-muted/60 inline-flex items-center gap-0.5 rounded-full border p-0.5"
      >
        {TAX_MODES.map((mode) => {
          const active = mode === tax;
          return (
            <Link
              key={mode}
              href={`${action}?${baseParams}&tva=${mode}`}
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring/50 rounded-full px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAX_MODE_LABELS[mode]}
            </Link>
          );
        })}
      </div>
      <span className="text-muted-foreground text-sm">
        TVA 5,5 % (taux réduit alimentaire), à confirmer avec le client.
      </span>
    </div>
  );
}
