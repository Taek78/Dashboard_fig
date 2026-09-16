"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SortOrderIcon } from "@/components/sort-order-icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Bouton du sens d'un tri, à côté de la liste des critères (client : état
 * local, pour que la flèche pivote dès le clic, avant la réponse du serveur).
 *
 * - Le sens voyage dans un champ caché `sens`, DÉSACTIVÉ quand il vaut le sens
 *   naturel du critère : l'URL ne l'écrit que s'il diffère (?tri=commandes
 *   &sens=croissant).
 * - Un clic inverse le sens puis soumet le formulaire (requestSubmit :
 *   AutoSubmitForm lance la recherche aussitôt). flushSync écrit le champ
 *   caché AVANT la lecture du formulaire.
 * - Changer de critère revient à son sens naturel (écouteur natif sur la
 *   liste : il passe avant l'onChange du formulaire, qui lit les champs un
 *   instant plus tard).
 * Les tables (sens naturels, nature des valeurs, libellés) viennent du serveur :
 * le composant n'importe pas les règles de l'annuaire dans le navigateur.
 */
type Order = "croissant" | "decroissant";

export function SortOrderToggle<Sort extends string>({
  selectId,
  sort,
  order,
  naturalOrders,
  scales,
  labels,
}: {
  /** Liste déroulante des critères, dans le même formulaire. */
  selectId: string;
  sort: Sort;
  order: Order;
  naturalOrders: Record<Sort, Order>;
  scales: Record<Sort, "alpha" | "numeric">;
  labels: Record<Sort, Record<Order, string>>;
}) {
  const [current, setCurrent] = useState({ sort, order });
  const [seen, setSeen] = useState({ sort, order });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Nouvelle réponse du serveur : ajustement d'état pendant le rendu (motif React).
  if (seen.sort !== sort || seen.order !== order) {
    setSeen({ sort, order });
    setCurrent({ sort, order });
  }

  useEffect(() => {
    const select = document.getElementById(selectId);
    if (!(select instanceof HTMLSelectElement)) return;
    const onChange = () => {
      const next = select.value as Sort;
      if (!(next in naturalOrders)) return;
      flushSync(() => setCurrent({ sort: next, order: naturalOrders[next] }));
    };
    select.addEventListener("change", onChange);
    return () => select.removeEventListener("change", onChange);
  }, [selectId, naturalOrders]);

  const opposite: Order =
    current.order === "croissant" ? "decroissant" : "croissant";
  const label = `Inverser l'ordre (actuellement : ${labels[current.sort][current.order]})`;

  return (
    <>
      <input
        type="hidden"
        name="sens"
        value={current.order}
        disabled={current.order === naturalOrders[current.sort]}
      />
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={labels[current.sort][opposite]}
        onClick={() => {
          flushSync(() => setCurrent({ ...current, order: opposite }));
          buttonRef.current?.form?.requestSubmit();
        }}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-lg" }),
          "shrink-0",
        )}
      >
        <SortOrderIcon scale={scales[current.sort]} order={current.order} />
      </button>
    </>
  );
}
