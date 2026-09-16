import { BellRing, Check, Megaphone, PackageCheck, X } from "lucide-react";
import {
  CONSENT_DESCRIPTIONS,
  CONSENT_KEYS,
  CONSENT_LABELS,
  type ConsentKey,
} from "@/domain/customers/consents";
import type { CustomerConsents } from "@/domain/customers/types";
import { cn } from "@/lib/utils";

/*
 * Les trois autorisations d'un client (serveur), en pastilles : vert et coche
 * quand elle est donnée, gris et croix sinon. La couleur n'est jamais seule :
 * l'icône et le texte accessible (« Offres et promos : autorisées ») disent la
 * même chose. Lues dans l'application FIG, jamais modifiables ici.
 */
const ICONS: Record<ConsentKey, typeof BellRing> = {
  offers: BellRing,
  orderStatus: PackageCheck,
  marketing: Megaphone,
};

export function ConsentPills({
  consents,
  className,
}: {
  consents: CustomerConsents;
  className?: string;
}) {
  return (
    <ul
      aria-label="Autorisations données par le client"
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {CONSENT_KEYS.map((key) => {
        const granted = consents[key];
        const Icon = ICONS[key];
        const Mark = granted ? Check : X;
        return (
          <li
            key={key}
            title={CONSENT_DESCRIPTIONS[key]}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
              granted
                ? "bg-success/12 text-success"
                : "bg-muted text-muted-foreground line-through decoration-current/50",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{CONSENT_LABELS[key]}</span>
            <Mark aria-hidden="true" className="size-3 shrink-0" />
            <span className="sr-only">
              {granted ? " : autorisé" : " : refusé"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
