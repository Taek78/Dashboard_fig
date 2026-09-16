"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { todayInParis } from "@/domain/deliveries/rules";
import {
  initialFocusDay,
  monthGrid,
  monthOf,
  moveFocusDay,
  openingMonth,
  shiftDayByMonths,
  shiftMonth,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

/*
 * Calendrier maison d'un champ de date « du / au » (client : état, focus,
 * portail). Le champ natif <input type="date"> reste la seule valeur du
 * formulaire (saisie au clavier, URL, AutoSubmitForm) ; ce bouton ne fait que
 * l'écrire.
 *
 * - Tablette et PC (≥ 48rem, préfixe de FENÊTRE md: : c'est un choix
 *   d'appareil, pas de disposition) : l'icône du calendrier natif est masquée
 *   et remplacée par ce bouton. Sur téléphone, le sélecteur natif du système
 *   reste (décision du client, 2026-09-16) et ce bouton est caché.
 * - À CHAQUE ouverture, le mois affiché est recalculé (openingMonth) : celui de
 *   la date saisie, sinon celui de l'autre borne, sinon le mois actuel ; les
 *   jours des mois voisins sont grisés.
 * - Clavier (motif « grille de dates » de l'ARIA APG) : flèches, Début / Fin,
 *   Page préc. / suiv. (Maj : année), Entrée ou Espace pour choisir, Échap pour
 *   fermer ; Alt + flèche bas ouvre depuis le champ.
 * - Écrire la valeur : le setter natif puis les événements input et change,
 *   pour que React (onChange du formulaire) voie bien le changement.
 */
const WEEKDAYS = [
  ["lu", "lundi"],
  ["ma", "mardi"],
  ["me", "mercredi"],
  ["je", "jeudi"],
  ["ve", "vendredi"],
  ["sa", "samedi"],
  ["di", "dimanche"],
] as const;

const DESKTOP_QUERY = "(min-width: 48rem)";

const monthTitle = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const at = (day: string) => new Date(`${day}T00:00:00.000Z`);

function readInput(id: string | undefined): HTMLInputElement | null {
  if (!id) return null;
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element : null;
}

export function DatePickerButton({
  inputId,
  otherInputId,
  label,
}: {
  /** Champ de date écrit par le calendrier. */
  inputId: string;
  /** L'autre borne : son mois sert à l'ouverture quand ce champ est vide. */
  otherInputId?: string;
  /** Nom accessible du bouton (« Calendrier, date de début »). */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(todayInParis(new Date())));
  const [focusDay, setFocusDay] = useState(`${month}-01`);
  const [selected, setSelected] = useState("");
  const [today, setToday] = useState(() => todayInParis(new Date()));
  const focusRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const titleId = useId();

  function openAt() {
    const now = todayInParis(new Date());
    const value = readInput(inputId)?.value ?? "";
    const shown = openingMonth(value, readInput(otherInputId)?.value, now);
    setToday(now);
    setSelected(value);
    setMonth(shown);
    setFocusDay(initialFocusDay(shown, value, now));
  }

  function onOpenChange(next: boolean) {
    if (next) openAt();
    setOpen(next);
  }

  // Depuis le champ, sur tablette et PC : pas de sélecteur natif au clic
  // (Firefox), Alt + flèche bas ouvre ce calendrier.
  useEffect(() => {
    const input = readInput(inputId);
    if (!input) return;
    const desktop = () => window.matchMedia(DESKTOP_QUERY).matches;
    const onClick = (event: MouseEvent) => {
      if (desktop()) event.preventDefault();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (desktop() && event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        openAt();
        setOpen(true);
      }
    };
    input.addEventListener("click", onClick);
    input.addEventListener("keydown", onKey);
    return () => {
      input.removeEventListener("click", onClick);
      input.removeEventListener("keydown", onKey);
    };
    // openAt ne lit que des valeurs du DOM et des props stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputId, otherInputId]);

  // Le focus suit le jour atteint au clavier, une fois la grille rendue.
  useEffect(() => {
    if (open && moveFocus.current) {
      moveFocus.current = false;
      focusRef.current?.focus();
    }
  }, [open, focusDay, month]);

  function commit(day: string) {
    const input = readInput(inputId);
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, day);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setOpen(false);
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const next = moveFocusDay(focusDay, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    moveFocus.current = true;
    setFocusDay(next);
    if (monthOf(next) !== month) setMonth(monthOf(next));
  }

  function showMonth(n: number) {
    setMonth(shiftMonth(month, n));
    setFocusDay(shiftDayByMonths(focusDay, n));
  }

  const title = monthTitle.format(at(`${month}-01`));

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        type="button"
        aria-label={label}
        title={label}
        data-slot="date-picker-trigger"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground absolute top-1/2 right-1 hidden -translate-y-1/2 md:inline-flex",
        )}
      >
        <CalendarDays aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="isolate z-50"
        >
          <Popover.Popup
            initialFocus={focusRef}
            aria-labelledby={titleId}
            data-slot="date-picker"
            className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-76 origin-(--transform-origin) rounded-xl p-3 shadow-lg ring-1 outline-none"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => showMonth(-1)}
                aria-label="Mois précédent"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <h2
                id={titleId}
                aria-live="polite"
                className="text-sm font-semibold first-letter:uppercase"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => showMonth(1)}
                aria-label="Mois suivant"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            <table
              role="grid"
              aria-labelledby={titleId}
              onKeyDown={onGridKeyDown}
              className="w-full border-collapse text-center text-sm"
            >
              <thead>
                <tr>
                  {WEEKDAYS.map(([short, long]) => (
                    <th
                      key={long}
                      scope="col"
                      abbr={long}
                      className="text-muted-foreground pb-1 text-xs font-medium"
                    >
                      {short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid(month).map((week) => (
                  <tr key={week[0]!.day}>
                    {week.map(({ day, inMonth }) => {
                      const isSelected = day === selected;
                      const isToday = day === today;
                      const isFocus = day === focusDay;
                      return (
                        <td
                          key={day}
                          aria-selected={isSelected}
                          className="p-0.5"
                        >
                          <button
                            ref={isFocus ? focusRef : undefined}
                            type="button"
                            tabIndex={isFocus ? 0 : -1}
                            aria-label={dayLabel.format(at(day))}
                            aria-current={isToday ? "date" : undefined}
                            data-outside={inMonth ? undefined : ""}
                            onClick={() => commit(day)}
                            className={cn(
                              "focus-visible:ring-ring/60 flex size-9 items-center justify-center rounded-lg tabular-nums transition-colors outline-none focus-visible:ring-2",
                              inMonth
                                ? "text-foreground hover:bg-muted"
                                : "text-muted-foreground/45 hover:bg-muted/60",
                              isToday &&
                                !isSelected &&
                                "ring-primary/50 font-semibold ring-1",
                              isSelected &&
                                "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
                            )}
                          >
                            {Number(day.slice(8, 10))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
              <button
                type="button"
                onClick={() => commit(today)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => commit("")}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Effacer
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
