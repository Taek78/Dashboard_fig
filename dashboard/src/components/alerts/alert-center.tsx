"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBanner } from "@/components/alerts/alert-banner";
import {
  hasOrderNotice,
  readAlertFeed,
  summarizeNotices,
} from "@/domain/alerts/rules";
import {
  ALERT_OVERLAP_MS,
  ALERT_POLL_MS,
  type AlertFeed,
  type AlertNotice,
  type AlertWatch,
} from "@/domain/alerts/types";
import { playChime, unlockChime } from "@/lib/chime";

/*
 * Notifications en direct (demande du 2026-09-18), montées une fois par le
 * layout du back-office :
 * - toutes les 5 s, onglet visible seulement (et tout de suite au retour sur
 *   l'onglet), le flux GET /alertes est relevé et comparé au précédent
 *   (readAlertFeed) : nouvelle commande, nouveau message client, produit qui
 *   passe en stock critique ou à 0. Le premier relevé sert de point de départ ;
 * - UNE SEULE notification à la fois (demande du 2026-09-18) : elle descend
 *   juste sous le bandeau pour 4 s (AlertBanner). Ce qui arrive pendant
 *   qu'elle est affichée s'y ajoute (summarizeNotices : « 3 nouvelles
 *   commandes ») et relance ses 4 s, au lieu d'empiler des cartes ;
 * - une nouvelle commande SONNE, une fois par relevé quel que soit leur
 *   nombre (carillon du Web Audio API, environ deux secondes). Le navigateur
 *   n'autorise le son qu'après un premier clic ou une touche sur la page :
 *   unlockChime() est branché sur ces gestes.
 * Les annonces passent par une région aria-live polie : un lecteur d'écran
 * les lit sans interrompre.
 * Un relevé qui échoue (réseau, session expirée : la réponse n'est alors pas
 * du JSON) est simplement ignoré ; le suivant réessaie.
 */
/** Ce qui est affiché : les nouveautés regroupées, et un numéro qui change à chaque ajout. */
type Shown = { items: AlertNotice[]; version: number };

export function AlertCenter() {
  const [shown, setShown] = useState<Shown | null>(null);
  const watch = useRef<AlertWatch>(null);
  const since = useRef<string | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => setShown(null), []);
  const summary = shown ? summarizeNotices(shown.items) : null;

  // Le son n'est permis qu'après un geste : chaque geste le (ré)autorise.
  useEffect(() => {
    const unlock = () => unlockChime();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(poll, ALERT_POLL_MS);
    };

    async function poll() {
      if (busy || stopped) return;
      if (document.visibilityState !== "visible") return schedule();
      busy = true;
      try {
        const query = since.current
          ? `?depuis=${encodeURIComponent(since.current)}`
          : "";
        const response = await fetch(`/alertes${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const isJson = response.headers
          .get("content-type")
          ?.includes("application/json");
        if (response.ok && isJson && !stopped) {
          const feed = (await response.json()) as AlertFeed;
          const read = readAlertFeed(watch.current, feed);
          watch.current = read.watch;
          since.current = new Date(
            Date.parse(feed.now) - ALERT_OVERLAP_MS,
          ).toISOString();
          if (read.notices.length > 0) {
            if (hasOrderNotice(read.notices)) playChime();
            const fresh = read.notices;
            const version = (counter.current += 1);
            // Une seule notification : les nouveautés s'ajoutent à celle affichée.
            setShown((current) => ({
              items: [...(current?.items ?? []), ...fresh],
              version,
            }));
          }
        }
      } catch {
        // Réseau coupé : le relevé suivant réessaie.
      } finally {
        busy = false;
        schedule();
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center md:top-16"
    >
      {summary && shown ? (
        <AlertBanner
          notice={summary}
          version={shown.version}
          onDismiss={dismiss}
        />
      ) : null}
    </div>
  );
}
