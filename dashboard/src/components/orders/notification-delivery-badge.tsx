"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import { requeueCustomerNotification } from "@/app/(dashboard)/commandes/[id]/actions";
import { shownDelivery } from "@/domain/notifications/delivery";
import {
  DELIVERY_POLL_MS,
  DELIVERY_TIMEOUT_MS,
  type DeliveryState,
} from "@/domain/notifications/types";
import { cn } from "@/lib/utils";

/*
 * « Client notifié » suivi jusqu'à l'accusé de l'application (demande du
 * 2026-09-18). La notification vient d'être déposée dans la file : un
 * spinner tourne à côté du badge tant que l'application n'a pas accusé
 * l'envoi. L'état est relu toutes les 3 s (GET /notifications/[id]).
 * - Envoyée : le badge vert de validation, le spinner disparaît.
 * - Échec déclaré par l'application, ou aucun accusé en 90 s (réseau coupé,
 *   serveur de l'application arrêté…) : « Échec d'envoi de la
 *   notification » en rouge, et un petit bouton rond « Réessayer » (icône
 *   de reprise) qui remet la notification dans la file et relance l'attente.
 * Un relevé qui échoue (réseau du back-office) n'arrête rien : le suivant
 * réessaie, et le délai tranche. Annonces par une région polie.
 */
export function NotificationDeliveryBadge({
  notificationId,
}: {
  notificationId: string;
}) {
  const [state, setState] = useState<DeliveryState>("pending");
  const [timedOut, setTimedOut] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, startRetry] = useTransition();
  const shown = shownDelivery(state, timedOut ? DELIVERY_TIMEOUT_MS : 0);

  // Attente de l'accusé : relevé périodique et délai, relancés à chaque essai ;
  // passé le délai, plus aucun relevé jusqu'à « Réessayer ».
  useEffect(() => {
    if (state !== "pending" || timedOut) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = setTimeout(() => setTimedOut(true), DELIVERY_TIMEOUT_MS);

    async function poll() {
      try {
        const response = await fetch(`/notifications/${notificationId}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const isJson = response.headers
          .get("content-type")
          ?.includes("application/json");
        if (response.ok && isJson && !stopped) {
          const body = (await response.json()) as {
            state: DeliveryState;
            failureReason: string | null;
          };
          setReason(body.failureReason);
          if (body.state !== "pending") {
            setState(body.state);
            return;
          }
        }
      } catch {
        // Réseau du back-office : le relevé suivant réessaie.
      }
      if (!stopped) timer = setTimeout(poll, DELIVERY_POLL_MS);
    }
    timer = setTimeout(poll, DELIVERY_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(deadline);
    };
  }, [notificationId, state, timedOut, attempt]);

  function retry() {
    setError(null);
    startRetry(async () => {
      const result = await requeueCustomerNotification(notificationId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      if (result.status === "sent") {
        setState("sent");
        return;
      }
      setReason(null);
      setTimedOut(false);
      setState("pending");
      setAttempt((n) => n + 1);
    });
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1">
      {shown === "failed" ? (
        <p className="text-destructive flex items-center gap-1.5">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span title={reason ?? undefined}>
            Échec d&apos;envoi de la notification
          </span>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            aria-label="Réessayer l'envoi de la notification"
            title="Réessayer"
            className="border-destructive/40 hover:bg-destructive/10 focus-visible:ring-ring/50 inline-flex size-7 shrink-0 items-center justify-center rounded-none border outline-none focus-visible:ring-3 disabled:opacity-60 motion-safe:transition-[background-color,scale] motion-safe:active:scale-90"
          >
            <RotateCcw
              className={cn("size-3.5", retrying && "motion-safe:animate-spin")}
              aria-hidden="true"
            />
          </button>
        </p>
      ) : (
        <p className="text-success flex items-center gap-1.5">
          <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
          Client notifié
          {shown === "pending" ? (
            <>
              <LoaderCircle
                className="text-muted-foreground size-4 shrink-0 motion-safe:animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">
                , en attente de l&apos;accusé d&apos;envoi
              </span>
            </>
          ) : null}
        </p>
      )}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
