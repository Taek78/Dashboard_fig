"use client";

import { useActionState, useState, startTransition } from "react";
import {
  Bell,
  BellOff,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { saveAlertPrefs } from "@/app/(dashboard)/alertes/actions";
import type { AlertPrefs } from "@/domain/alerts/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * « Mon profil » → Notifications (demandes du 2026-09-18), enregistrées sur
 * le compte DÈS le changement (pas de bouton) :
 * - « Activer les notifications commandes » et « … messages » : décochée,
 *   plus de bandeau, de son ni de notification système pour ce fil ; les
 *   compteurs du menu et les badges « Nouveau » restent actifs ;
 * - en dessous, « Désactiver le son » : la cloche VIBRE tant que le son est
 *   actif, elle est BARRÉE quand il est coupé. La case se grise et se
 *   décoche quand aucune notification n'est activée (plus rien à faire
 *   sonner ; le serveur la remet aussi à faux).
 * Cases contrôlées et FormData composé : la réinitialisation du formulaire
 * par React ne peut pas les décocher en douce. Une notification n'est
 * proposée que si le rôle voit la section (le livreur n'a pas les messages).
 */
const CHOICES = [
  { key: "orders", label: "Activer les notifications commandes" },
  { key: "messages", label: "Activer les notifications messages" },
] as const;

const BOX =
  "bg-card border-input has-focus-visible:ring-ring/50 flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium select-none has-focus-visible:ring-3";

export function AlertPrefsForm({
  prefs: initial,
  available,
}: {
  prefs: AlertPrefs;
  /** Les fils que le rôle voit (alertScopeFor). */
  available: Pick<AlertPrefs, "orders" | "messages">;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [result, formAction, pending] = useActionState(
    saveAlertPrefs,
    idleActionResult,
  );
  // Plus aucune notification proposée et activée : le son n'a plus d'objet.
  const anyOn =
    (available.orders && prefs.orders) ||
    (available.messages && prefs.messages);
  const muted = anyOn && prefs.muted;

  function save(next: AlertPrefs) {
    setPrefs(next);
    const data = new FormData();
    if (next.orders) data.set("orders", "on");
    if (next.messages) data.set("messages", "on");
    if (next.muted) data.set("muted", "on");
    startTransition(() => formAction(data));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:flex-wrap">
        {CHOICES.filter((choice) => available[choice.key]).map((choice) => (
          <label
            key={choice.key}
            className={cn(
              BOX,
              "hover:bg-muted/40 has-checked:border-primary/40 has-checked:bg-primary/10 cursor-pointer motion-safe:transition-[background-color,border-color,scale] motion-safe:active:scale-[0.98]",
            )}
          >
            <input
              type="checkbox"
              name={choice.key}
              checked={prefs[choice.key]}
              onChange={(event) =>
                save({ ...prefs, [choice.key]: event.target.checked })
              }
              className="accent-primary size-4"
            />
            {choice.label}
          </label>
        ))}
      </div>

      <label
        className={cn(
          BOX,
          "self-start",
          anyOn
            ? "hover:bg-muted/40 cursor-pointer motion-safe:transition-[background-color,scale] motion-safe:active:scale-[0.98]"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="checkbox"
          name="muted"
          checked={muted}
          disabled={!anyOn}
          onChange={(event) => save({ ...prefs, muted: event.target.checked })}
          className="accent-primary size-4"
        />
        {muted || !anyOn ? (
          <BellOff
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
        ) : (
          <Bell className="bell-ring text-primary size-4" aria-hidden="true" />
        )}
        Désactiver le son
      </label>

      <p
        role="status"
        className={cn(
          "flex min-h-5 items-center gap-1.5 text-sm",
          result.status === "success" && "text-success",
          result.status === "error" && "text-destructive",
        )}
      >
        {pending ? (
          <LoaderCircle
            className="text-muted-foreground size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
        ) : result.status === "success" ? (
          <CircleCheck className="size-4" aria-hidden="true" />
        ) : result.status === "error" ? (
          <CircleAlert className="size-4" aria-hidden="true" />
        ) : null}
        {pending
          ? "Enregistrement…"
          : result.status === "idle"
            ? null
            : result.message}
      </p>
    </div>
  );
}
