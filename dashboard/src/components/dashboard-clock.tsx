"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { clockParts, msUntilNextMinute } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Date et heure du tableau de bord, en haut à droite (demande du 2026-09-18),
 * heure de Paris quel que soit le fuseau du poste.
 *
 * Premier rendu = l'instant lu par la page serveur (`initial`) : serveur et
 * navigateur écrivent la même chose, pas d'erreur d'hydratation. Ensuite le
 * navigateur prend le relais : un minuteur calé sur la minute pleine (et non
 * un intervalle de 60 s qui dériverait), relancé au retour sur l'onglet, qu'un
 * navigateur endort en arrière-plan.
 *
 * À chaque changement, seuls les chiffres qui changent défilent : le nouveau
 * monte de sous la ligne, l'ancien part vers le haut (clock-in / clock-out de
 * globals.css, immobiles sous prefers-reduced-motion). Les chiffres sont
 * `tabular-nums` : l'heure ne bouge pas de largeur d'une minute à l'autre.
 * Une SEULE couleur, sans dégradé (demande du 2026-09-18) : `text-foreground`,
 * claire en thème sombre et foncée en thème clair, la plus lisible de chaque
 * thème ; seuls les deux-points battent doucement.
 * Les lecteurs d'écran lisent une phrase entière, jamais les chiffres un à un,
 * et rien n'est annoncé à chaque minute (pas de région live).
 */
/** Durée de clock-in / clock-out (globals.css). */
const CLOCK_ANIMATION_MS = 520;

type Clock = {
  iso: string;
  previous: readonly string[] | null;
  tick: number;
};

/** Un chiffre et, pendant qu'il change, celui qu'il remplace. */
function Digit({
  value,
  previous,
  tick,
}: {
  value: string;
  previous: string | undefined;
  tick: number;
}) {
  const changed = previous !== undefined && previous !== value;
  return (
    <span className="relative inline-block overflow-hidden">
      {changed ? (
        <span
          key={`out-${tick}`}
          className="clock-out absolute inset-0 flex justify-center"
        >
          {previous}
        </span>
      ) : null}
      <span key={`in-${tick}-${value}`} className={cn(changed && "clock-in")}>
        {value}
      </span>
    </span>
  );
}

export function DashboardClock({ initial }: { initial: string }) {
  const [clock, setClock] = useState<Clock>({
    iso: initial,
    previous: null,
    tick: 0,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const iso = new Date().toISOString();
      setClock((current) => {
        const before = clockParts(current.iso).digits;
        const after = clockParts(iso).digits;
        if (before.join("") === after.join("")) {
          return { ...current, iso };
        }
        return { iso, previous: before, tick: current.tick + 1 };
      });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        update();
        schedule();
      }, msUntilNextMinute(Date.now()));
    };
    const resync = () => {
      if (document.visibilityState === "visible") {
        update();
        schedule();
      }
    };
    update();
    schedule();
    document.addEventListener("visibilitychange", resync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  // L'animation finie, les chiffres sortants quittent la page : ils ne
  // doivent ni rester dans le texte de l'horloge, ni s'accumuler.
  useEffect(() => {
    if (clock.previous === null) return;
    const done = setTimeout(
      () => setClock((current) => ({ ...current, previous: null })),
      CLOCK_ANIMATION_MS + 100,
    );
    return () => clearTimeout(done);
  }, [clock.tick, clock.previous]);

  const { day, digits } = clockParts(clock.iso);
  const [h1, h2, m1, m2] = digits;
  const previous = clock.previous ?? [];

  return (
    // Téléphone : une seule ligne, le jour à gauche et l'heure à droite ; plus large, l'un sous l'autre, en haut à droite.
    <div className="flex w-full items-center justify-between gap-3 @2xl/main:w-auto @2xl/main:flex-col @2xl/main:items-end @2xl/main:gap-1 @2xl/main:pt-1 @2xl/main:text-right">
      <p className="sr-only">
        <time dateTime={clock.iso}>{`${day}, ${h1}${h2} h ${m1}${m2}`}</time>
      </p>
      <span
        aria-hidden="true"
        className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium"
      >
        <CalendarDays className="text-primary size-4 shrink-0" />
        {day}
      </span>
      <span
        aria-hidden="true"
        data-testid="horloge"
        className="text-foreground flex items-baseline text-2xl leading-none font-semibold tracking-tight tabular-nums @2xl/main:text-4xl"
      >
        <Digit value={h1} previous={previous[0]} tick={clock.tick} />
        <Digit value={h2} previous={previous[1]} tick={clock.tick} />
        <span className="clock-colon px-0.5">:</span>
        <Digit value={m1} previous={previous[2]} tick={clock.tick} />
        <Digit value={m2} previous={previous[3]} tick={clock.tick} />
      </span>
    </div>
  );
}
