"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  MapPin,
  MessageSquareText,
  PackageX,
  ShoppingBasket,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ALERT_DISPLAY_MS,
  type AlertKind,
  type AlertNotice,
} from "@/domain/alerts/types";
import { cn } from "@/lib/utils";

/*
 * LA notification en direct (une seule à la fois), façon SMARTPHONE (demande
 * du 2026-09-18) : collée sous le bandeau, surface vitrée pleine largeur sur
 * téléphone, bornée sur ordinateur, AUCUN
 * coin arrondi. De gauche à droite : la bande de couleur de sa nature, une
 * tuile d'icône, l'en-tête « FIG · nature · à l'instant », le titre et le
 * détail ; puis la croix, une colonne entière de 48 px facile à toucher.
 * Code couleur par nature (tokens du thème) : commande en vert (--success),
 * message en bleu (--info), stock critique en ambre (--warning), rupture en
 * rouge (--destructive).
 * - Un clic sur le corps (un lien) mène à ce que la notification désigne et
 *   la ferme ; la croix la ferme seulement.
 * - UNE commande (demande du 2026-09-19) : pas de référence ; le nom du
 *   client en clair (jamais tronqué), le TOTAL en grand à droite, et
 *   l'adresse de livraison dessous.
 * - Elle part seule après 15 s ; une nouveauté qui s'y ajoute (`version`
 *   change) relance les 15 s et la barre. Le décompte se met en PAUSE tant que le
 *   pointeur est dessus ou que le focus y est (le temps de lire, WCAG 2.2.1),
 *   et une barre fine montre le temps restant.
 * - Elle descend de sous le bandeau et remonte en partant (alert-drop,
 *   alert-lift de globals.css), immobile sous prefers-reduced-motion.
 */
const LEAVE_MS = 220;

type Tone = {
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  band: string;
  tile: string;
  text: string;
};

/* Classes écrites en entier : Tailwind ne voit pas un nom construit. */
const TONES: Record<AlertKind, Tone> = {
  order: {
    label: "Commande",
    Icon: ShoppingBasket,
    band: "bg-success",
    tile: "bg-success/15 text-success",
    text: "text-success",
  },
  message: {
    label: "Message",
    Icon: MessageSquareText,
    band: "bg-info",
    tile: "bg-info/15 text-info",
    text: "text-info",
  },
  stock_low: {
    label: "Stock",
    Icon: TriangleAlert,
    band: "bg-warning",
    tile: "bg-warning/15 text-warning",
    text: "text-warning",
  },
  stock_out: {
    label: "Stock",
    Icon: PackageX,
    band: "bg-destructive",
    tile: "bg-destructive/15 text-destructive",
    text: "text-destructive",
  },
};

export function AlertBanner({
  notice,
  version,
  onDismiss,
}: {
  notice: AlertNotice;
  /** Change quand des nouveautés s'ajoutent : les 15 s repartent. */
  version: number;
  onDismiss: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Onglet caché : le décompte attend le retour, pour que la notification soit vue.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState !== "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(ALERT_DISPLAY_MS);
  const paused = hovered || focused || hidden;
  const tone = TONES[notice.kind];

  // Des nouveautés s'ajoutent : les 15 s repartent, même pendant la sortie.
  // Ajuster l'état au rendu (et non dans un effet) : pas de rendu intermédiaire.
  const [seenVersion, setSeenVersion] = useState(version);
  if (seenVersion !== version) {
    setSeenVersion(version);
    setLeaving(false);
  }
  // Déclaré AVANT le décompte : ses 15 s repartent de zéro au même rendu.
  useEffect(() => {
    remaining.current = ALERT_DISPLAY_MS;
  }, [version]);

  // Départ : l'animation de sortie, puis le retrait.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onDismiss, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDismiss]);

  // Décompte de 15 s, suspendu pendant la pause, repris là où il en était.
  useEffect(() => {
    if (paused || leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - startedAt),
      );
    };
  }, [paused, leaving, version]);

  return (
    <div
      data-kind={notice.kind}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      className={cn(
        "bg-popover/90 supports-backdrop-filter:bg-popover/75 text-popover-foreground border-foreground/10 pointer-events-auto relative flex w-full overflow-hidden rounded-none border-b shadow-2xl backdrop-blur-xl md:max-w-md md:border-x",
        leaving ? "alert-lift" : "alert-drop",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", tone.band)}
      />
      <Link
        href={notice.href}
        onClick={() => setLeaving(true)}
        className="hover:bg-foreground/5 focus-visible:bg-foreground/5 flex min-w-0 flex-1 items-start gap-3 rounded-none py-3 pr-2 pl-4 outline-none motion-safe:transition-colors"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-none",
            tone.tile,
          )}
        >
          <tone.Icon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
            <span className={cn("font-bold", tone.text)}>FIG</span>
            <span aria-hidden="true">·</span>
            <span>{tone.label}</span>
            <span className="ml-auto tracking-normal normal-case">
              à l&apos;instant
            </span>
          </span>
          <span className="leading-snug font-semibold">{notice.title}</span>
          {notice.order ? (
            <>
              <span className="mt-0.5 flex items-baseline justify-between gap-3">
                <span
                  data-slot="alert-customer"
                  className="text-foreground min-w-0 text-base leading-snug font-semibold wrap-break-word"
                >
                  {notice.order.customerName}
                </span>
                <span
                  data-slot="alert-total"
                  className={cn(
                    "shrink-0 text-2xl leading-none font-bold tracking-tight tabular-nums",
                    tone.text,
                  )}
                >
                  {notice.order.total}
                </span>
              </span>
              <span className="text-muted-foreground flex items-start gap-1.5 text-sm leading-snug">
                <MapPin
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 wrap-break-word">
                  {notice.order.address}
                </span>
              </span>
            </>
          ) : (
            <span className="text-muted-foreground line-clamp-2 text-sm wrap-anywhere">
              {notice.body}
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        aria-label="Fermer la notification"
        title="Fermer"
        onClick={() => setLeaving(true)}
        className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 focus-visible:bg-foreground/10 border-foreground/10 flex w-12 shrink-0 items-center justify-center rounded-none border-l outline-none motion-safe:transition-colors [&_svg]:motion-safe:transition-transform hover:[&_svg]:motion-safe:rotate-90"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      <span
        key={version}
        aria-hidden="true"
        style={{ animationPlayState: paused ? "paused" : "running" }}
        className={cn(
          "alert-countdown absolute right-0 bottom-0 left-1 h-0.5 opacity-70",
          tone.band,
        )}
      />
    </div>
  );
}
