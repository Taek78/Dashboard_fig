import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD,
  type LoyaltyStatus,
} from "@/domain/customers/loyalty";
import { cn } from "@/lib/utils";

/*
 * Fidélité d'un client (serveur). Le badge signale que la prochaine commande
 * est à −15 % ; la jauge montre le compteur (n / 8 commandes cumulées). La
 * couleur n'est jamais seule : le texte porte l'information.
 */
export function LoyaltyBadge({ status }: { status: LoyaltyStatus }) {
  if (status.rewardReady) {
    return (
      <Badge variant="success">
        <Sparkles aria-hidden="true" />
        Prochaine commande à −{LOYALTY_DISCOUNT_PERCENT} %
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="tabular-nums">
      {status.count} / {LOYALTY_THRESHOLD} commandes
    </Badge>
  );
}

export function LoyaltyGauge({ status }: { status: LoyaltyStatus }) {
  const dots = Array.from({ length: LOYALTY_THRESHOLD }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label={`${status.count} commandes cumulées sur ${LOYALTY_THRESHOLD}`}
        className="flex gap-1.5"
      >
        {dots.map((n) => (
          <li
            key={n}
            aria-hidden="true"
            className={cn(
              "h-2.5 flex-1 rounded-full transition-colors",
              n <= status.count ? "bg-gradient-brand" : "bg-muted",
            )}
          />
        ))}
      </ol>
      <p className="text-sm">
        {status.rewardReady ? (
          <>
            <span className="text-success font-medium">
              {LOYALTY_THRESHOLD} commandes cumulées :
            </span>{" "}
            prochaine commande à −{LOYALTY_DISCOUNT_PERCENT} %.
          </>
        ) : (
          <>
            <span className="font-medium tabular-nums">
              {status.count} commande{status.count > 1 ? "s" : ""} cumulée
              {status.count > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · encore {status.remaining} avant −{LOYALTY_DISCOUNT_PERCENT} %.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
