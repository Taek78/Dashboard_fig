"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Sparkles } from "lucide-react";
import {
  FRESH_MS,
  getFreshState,
  getServerFreshState,
  isFresh,
  subscribeFresh,
  type FreshKind,
} from "@/lib/fresh-items";
import { cn } from "@/lib/utils";

/*
 * Enveloppe d'une carte de commande ou de message (demande du 2026-09-18) :
 * si elle vient d'arriver (src/lib/fresh-items.ts), un badge « Nouveau » qui
 * SCINTILLE à cheval sur son bord haut et une légère SURBRILLANCE de la
 * carte, pendant une minute, ou jusqu'à l'ouverture de son détail. Rendu
 * serveur et premier rendu : rien (l'état vit dans l'onglet), donc aucune
 * erreur d'hydratation. Le badge est annoncé aux lecteurs d'écran avec la
 * carte (texte réel, pas seulement une couleur).
 */
export function FreshMark({
  kind,
  id,
  children,
}: {
  kind: FreshKind;
  id: string;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(
    subscribeFresh,
    getFreshState,
    getServerFreshState,
  );
  const entry = state[kind][id];
  const [now, setNow] = useState(() => Date.now());
  // Réveil à la fin de la minute : le badge s'éteint sans action.
  useEffect(() => {
    if (!entry) return;
    const left = entry.at + FRESH_MS - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), left + 50);
    return () => clearTimeout(timer);
  }, [entry]);
  const fresh = isFresh(entry, Math.max(now, entry ? entry.at : now));

  return (
    <div
      data-fresh={fresh ? "" : undefined}
      className={cn("relative rounded-2xl", fresh && "fresh-card")}
    >
      {fresh ? (
        <span className="fresh-twinkle bg-primary text-primary-foreground absolute -top-2.5 left-4 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-md">
          <Sparkles className="size-3" aria-hidden="true" />
          Nouveau
        </span>
      ) : null}
      {children}
    </div>
  );
}
