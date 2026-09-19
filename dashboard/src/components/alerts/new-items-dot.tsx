"use client";

import { useUnread } from "@/components/alerts/use-unread";

/*
 * Point lumineux sur le bouton du menu, TÉLÉPHONE seulement (md:hidden) : le
 * menu y est replié, ses compteurs ne se voient pas. Allumé tant qu'une
 * section a des nouveautés non lues (useUnread). Décoratif : les nombres sont
 * dits par les compteurs du menu et par la notification.
 */
export function NewItemsDot() {
  const { counts } = useUnread();
  const lit = counts.orders + counts.messages + counts.stock > 0;
  if (!lit) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-3 md:hidden"
    >
      <span className="bg-primary absolute inset-0 rounded-full opacity-75 motion-safe:animate-ping" />
      <span className="bg-primary ring-card relative size-3 rounded-full ring-2" />
    </span>
  );
}
