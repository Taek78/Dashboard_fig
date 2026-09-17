"use client";

import Link from "next/link";
import { useState } from "react";

/*
 * Lien de LISTE : préchargé au survol seulement, jamais parce qu'il entre
 * dans la fenêtre (audit du 2026-09-17). Un `Link` ordinaire précharge le
 * squelette de sa destination dès qu'il est visible : sur une liste de
 * quarante cartes, chaque affichage déclenchait 40 à 55 rendus serveur pour
 * des fiches que personne n'ouvrira. Ici le préchargement ne part que pour
 * le lien que la souris désigne (motif documenté par Next) ; au toucher, la
 * navigation part au clic, le squelette arrive avec la réponse. Les liens de
 * la sidebar gardent le préchargement complet.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        setActive(true);
      }}
    />
  );
}
