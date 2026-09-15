"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import { searchQueryFrom, settleRequests } from "@/lib/search-query";
import { cn } from "@/lib/utils";

/*
 * Formulaire de recherche GET qui se lance tout seul (client : minuterie,
 * routeur, transition). Remplace next/form dans les recherches : les champs
 * restent des composants serveur passés en enfants, avec leurs defaultValue.
 *
 * - Anti-rebond : un champ texte ou date attend SEARCH_DEBOUNCE_MS après la
 *   dernière frappe ; une liste déroulante ou une case s'applique aussitôt ;
 *   Entrée lance tout de suite. Chaque nouvelle saisie annule l'attente.
 * - Navigation : router.replace (pas d'entrée d'historique par frappe) dans une
 *   transition : l'écran actuel reste affiché pendant le chargement (aria-busy
 *   sur le formulaire, pour l'indicateur), sans remonter la page.
 * - Courses : une URL identique à la dernière demandée n'est pas renvoyée ; si
 *   deux recherches se chevauchent, le routeur de Next abandonne la plus
 *   ancienne (seule la dernière s'affiche) ; et quand une réponse arrive, les
 *   champs ne sont JAMAIS réinitialisés si l'URL est l'une des nôtres
 *   (settleRequests) : la saisie en cours n'est pas écrasée par un résultat
 *   plus ancien. Une navigation extérieure (Réinitialiser, raccourci, retour
 *   arrière) remonte les champs avec les valeurs de la nouvelle URL et annule
 *   l'attente en cours.
 * - Sans JavaScript, le formulaire reste un GET classique (action).
 * - Les champs texte et date doivent être des NativeInput (ui/input.tsx), pas
 *   des Input Base UI : ils restent montés alors que leur defaultValue change à
 *   chaque recherche, ce que le FieldControl de Base UI refuse.
 */
export const SEARCH_DEBOUNCE_MS = 350;

const DEBOUNCED_TYPES = new Set(["search", "text", "email", "tel", "date"]);

export function AutoSubmitForm({
  action,
  scroll = false,
  delay = SEARCH_DEBOUNCE_MS,
  className,
  children,
  ...props
}: Omit<
  ComponentProps<"form">,
  "action" | "method" | "onChange" | "onSubmit" | "onKeyDown"
> & {
  /** Chemin de la page de résultats (sans paramètres). */
  action: string;
  /** Remonter en haut de page après la recherche (non par défaut). */
  scroll?: boolean;
  delay?: number;
}) {
  const router = useRouter();
  const current = useSearchParams().toString();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<string[]>([]);
  const [seen, setSeen] = useState(current);
  const [fieldsKey, setFieldsKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRequested = useRef<string | null>(null);

  // L'URL a changé : ajustement d'état pendant le rendu (motif React), sans effet.
  if (current !== seen) {
    const settled = settleRequests(pending, current);
    setSeen(current);
    setPending(settled.pending);
    if (settled.external) setFieldsKey((key) => key + 1);
  }

  // Navigation extérieure (ou démontage) : l'attente en cours est annulée et
  // la prochaine saisie repartira forcément vers le serveur.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      lastRequested.current = null;
    },
    [fieldsKey],
  );

  function submitNow() {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const query = searchQueryFrom(new FormData(form));
    if (query === lastRequested.current) return;
    lastRequested.current = query;
    setPending((list) => [...list, query].slice(-10));
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll });
    });
  }

  function schedule(target: EventTarget) {
    clearTimeout(timer.current);
    const wait =
      target instanceof HTMLInputElement && DEBOUNCED_TYPES.has(target.type)
        ? delay
        : 0;
    timer.current = setTimeout(submitNow, wait);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      submitNow();
    }
  }

  return (
    <form
      {...props}
      ref={formRef}
      action={action}
      aria-busy={isPending}
      data-pending={isPending ? "" : undefined}
      className={cn("group/recherche", className)}
      onChange={(event) => schedule(event.target)}
      onSubmit={(event) => {
        event.preventDefault();
        submitNow();
      }}
      onKeyDown={onKeyDown}
    >
      <Fragment key={fieldsKey}>{children}</Fragment>
    </form>
  );
}
