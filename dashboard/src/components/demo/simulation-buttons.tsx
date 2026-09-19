"use client";

import { useState, useTransition } from "react";
import {
  FlaskConical,
  LoaderCircle,
  MessageSquarePlus,
  ShoppingBasket,
} from "lucide-react";
import { simulateMessage, simulateOrder } from "@/app/(dashboard)/demo/actions";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Boutons de SIMULATION du tableau de bord (développement seulement, jamais
 * rendus par le serveur construit ; demande du 2026-09-18) : une commande ou
 * un message « comme si l'application FIG l'envoyait », pour voir et entendre
 * les alertes en direct au relevé suivant (5 s au plus). Encadré en pointillés
 * et libellé « Développement » : on ne le confond pas avec l'écran du client.
 * À RETIRER avant la livraison au client (docs/backlog.md).
 */
export function SimulationButtons() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [running, setRunning] = useState<"order" | "message" | null>(null);
  const [, startTransition] = useTransition();

  function run(kind: "order" | "message") {
    setRunning(kind);
    startTransition(async () => {
      setResult(await (kind === "order" ? simulateOrder() : simulateMessage()));
      setRunning(null);
    });
  }

  return (
    <section
      aria-label="Outils de démonstration"
      className="border-warning/60 bg-warning/5 flex flex-col gap-3 rounded-xl border border-dashed p-3 @xl/main:flex-row @xl/main:items-center"
    >
      <p className="text-warning flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="size-4" aria-hidden="true" />
        Développement
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running !== null}
          onClick={() => run("order")}
        >
          {running === "order" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ShoppingBasket />
          )}
          Simuler une commande
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running !== null}
          onClick={() => run("message")}
        >
          {running === "message" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <MessageSquarePlus />
          )}
          Simuler un message
        </Button>
      </div>
      <p
        role="status"
        className={cn(
          "text-sm",
          result?.status === "success" && "text-success",
          result?.status === "error" && "text-destructive",
        )}
      >
        {result && result.status !== "idle" ? result.message : null}
      </p>
    </section>
  );
}
