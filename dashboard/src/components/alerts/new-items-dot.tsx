"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addNewItems,
  LIT_SECTIONS,
  onNewItems,
  type NewItems,
} from "@/lib/alert-events";
import { isNavActive } from "@/lib/navigation";

/*
 * Point lumineux sur le bouton du menu, TÉLÉPHONE seulement (md:hidden) : le
 * menu y est replié, la section illuminée ne se voit pas. Il apparaît avec
 * une nouvelle commande ou un nouveau message (onNewItems) et s'éteint quand
 * les sections concernées ont été ouvertes. Décoratif : le nombre est dit
 * par le lien illuminé du menu et par la notification.
 */
export function NewItemsDot() {
  const pathname = usePathname();
  const [fresh, setFresh] = useState<NewItems>({});
  useEffect(
    () => onNewItems((items) => setFresh((c) => addNewItems(c, items))),
    [],
  );
  const opened = LIT_SECTIONS.find(
    (section) => fresh[section] && isNavActive(pathname, section),
  );
  if (opened) setFresh((c) => ({ ...c, [opened]: 0 }));
  const lit = LIT_SECTIONS.some((section) => (fresh[section] ?? 0) > 0);
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
