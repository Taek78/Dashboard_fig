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
 * est à −15 % ; la jauge montre la série en cours (n / 8). La couleur n'est
 * jamais seule : le texte porte l'information.
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
      {status.streak} / {LOYALTY_THRESHOLD} d&apos;affilée
    </Badge>
  );
}

export function LoyaltyGauge({ status }: { status: LoyaltyStatus }) {
  const dots = Array.from({ length: LOYALTY_THRESHOLD }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label={`${status.streak} commandes d'affilée sur ${LOYALTY_THRESHOLD}`}
        className="flex gap-1.5"
      >
        {dots.map((n) => (
          <li
            key={n}
            aria-hidden="true"
            className={cn(
              "h-2.5 flex-1 rounded-full transition-colors",
              n <= status.streak ? "bg-gradient-brand" : "bg-muted",
            )}
          />
        ))}
      </ol>
      <p className="text-sm">
        {status.rewardReady ? (
          <>
            <span className="text-success font-medium">
              {LOYALTY_THRESHOLD} commandes d&apos;affilée :
            </span>{" "}
            la prochaine commande est à −{LOYALTY_DISCOUNT_PERCENT} % (remise
            appliquée par l&apos;application).
          </>
        ) : (
          <>
            <span className="font-medium tabular-nums">
              {status.streak} commande{status.streak > 1 ? "s" : ""}{" "}
              d&apos;affilée
            </span>
            <span className="text-muted-foreground">
              {" "}
              · encore {status.remaining} avant −{LOYALTY_DISCOUNT_PERCENT} %.
              Une annulation remet le compteur à zéro.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
