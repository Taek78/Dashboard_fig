"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBanner } from "@/components/alerts/alert-banner";
import {
  hasOrderNotice,
  readAlertFeed,
  summarizeNotices,
} from "@/domain/alerts/rules";
import {
  ALERT_HIDDEN_POLL_MS,
  ALERT_OVERLAP_MS,
  ALERT_POLL_MS,
  type AlertFeed,
  type AlertNotice,
  type AlertWatch,
} from "@/domain/alerts/types";
import { announceNewItems } from "@/lib/alert-events";
import {
  clearAttention,
  desktopPermission,
  isAway,
  notifyDesktop,
  showAttention,
} from "@/lib/attention";
import { playChime, unlockChime } from "@/lib/chime";

/*
 * Notifications en direct (demande du 2026-09-18), montées une fois par le
 * layout du back-office :
 * - toutes les 5 s onglet visible, toutes les 15 s onglet caché (et tout de
 *   suite au retour sur l'onglet), le flux GET /alertes est relevé et comparé au précédent
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
 * - page pas sous les yeux (onglet caché, fenêtre sans focus) : sur
 *   ordinateur, notification SYSTÈME (barre des tâches, centre de
 *   notifications ; un clic ramène sur la cible), compte dans le titre de
 *   l'onglet et badge de l'icône (src/lib/attention.ts), effacés au retour.
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
  // Nouveautés arrivées pendant que la page n'était pas sous les yeux.
  const away = useRef<AlertNotice[]>([]);
  const router = useRouter();

  const dismiss = useCallback(() => setShown(null), []);
  const summary = shown ? summarizeNotices(shown.items) : null;

  // Le son n'est permis qu'après un geste : chaque geste le (ré)autorise.
  useEffect(() => {
    const unlock = () => {
      unlockChime();
      // Sur ordinateur, la permission des notifications système, une fois.
      desktopPermission();
    };
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

    // Plus lent quand l'onglet est caché, jamais arrêté : la barre des tâches
    // doit pouvoir signaler une commande arrivée fenêtre réduite.
    const schedule = () => {
      clearTimeout(timer);
      const delay =
        document.visibilityState === "visible"
          ? ALERT_POLL_MS
          : ALERT_HIDDEN_POLL_MS;
      if (!stopped) timer = setTimeout(poll, delay);
    };

    async function poll() {
      if (busy || stopped) return;
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
            // Le menu illumine Commandes et Messages jusqu'à leur ouverture.
            announceNewItems({
              "/commandes": read.notices.filter((n) => n.kind === "order")
                .length,
              "/messages": read.notices.filter((n) => n.kind === "message")
                .length,
            });
            const fresh = read.notices;
            if (isAway()) {
              // De loin : compte dans le titre et sur l'icône, notification système.
              away.current = [...away.current, ...fresh];
              showAttention(away.current.length);
              const all = summarizeNotices(away.current);
              if (all) {
                notifyDesktop(all.title, all.body, () => router.push(all.href));
              }
            }
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

    // De retour sur la page : le compte s'efface, le relevé reprend son rythme.
    const onBack = () => {
      if (isAway()) return;
      away.current = [];
      clearAttention();
    };
    const onVisible = () => {
      onBack();
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onBack);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onBack);
    };
  }, [router]);

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
