import Link from "next/link";
import {
  TAX_MODE_LABELS,
  TAX_MODES,
  type TaxMode,
} from "@/domain/metrics/rules";
import { cn } from "@/lib/utils";

/*
 * Interrupteur HT / TTC (serveur), partagé par le tableau de bord et les
 * métriques : un commutateur compact, posé sur la ligne des listes du
 * formulaire de période. Deux liens vers la même page avec ?tva= : le choix
 * vit dans l'URL, sans JavaScript. `baseParams` rejoue les autres paramètres
 * de la page (période, plage, comparaison) pour ne pas les perdre en
 * basculant.
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-medium">Montants</span>
      <div
        role="group"
        aria-label="Mode de TVA"
        className="bg-card border-input inline-flex h-9 items-center gap-0.5 rounded-lg border p-0.5"
      >
        {TAX_MODES.map((mode) => {
          const active = mode === tax;
          return (
            <Link
              key={mode}
              href={`${action}?${baseParams}&tva=${mode}`}
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                active
                  ? "bg-primary/12 text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAX_MODE_LABELS[mode]}
            </Link>
          );
        })}
      </div>
      <span className="text-muted-foreground text-xs">TVA 5,5 %</span>
    </div>
  );
}
