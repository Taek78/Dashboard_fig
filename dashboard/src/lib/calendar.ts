import { addDays, fromIso, toIso } from "@/lib/days";

/*
 * Règles pures du calendrier des filtres « du / au » (DatePickerButton),
 * testées dans test/lib/calendar.test.ts. Un mois s'écrit "AAAA-MM", un jour
 * "AAAA-MM-JJ" ; arithmétique en UTC comme src/lib/days.ts.
 *
 * La grille compte toujours six semaines, du lundi au dimanche (usage
 * français) : le calendrier garde la même hauteur d'un mois à l'autre, et les
 * jours des mois voisins qui la complètent sont marqués hors du mois (grisés).
 */
export const CALENDAR_WEEKS = 6;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai pour un jour "AAAA-MM-JJ" qui existe (pas de 31 avril). */
export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY.test(value)) return false;
  return toIso(fromIso(value)) === value;
}

/** Mois d'un jour : "2026-09-16" → "2026-09". */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Décale un mois : "2026-12", 1 → "2027-01". */
export function shiftMonth(month: string, n: number): string {
  const [year, index] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const d = new Date(Date.UTC(year, index - 1 + n, 1));
  return toIso(d).slice(0, 7);
}

/** Nombre de jours du mois : "2026-02" → 28. */
export function daysInMonth(month: string): number {
  const next = `${shiftMonth(month, 1)}-01`;
  return Number(addDays(next, -1).slice(8, 10));
}

/** Même quantième, `n` mois plus tard, ramené au dernier jour du mois si besoin. */
export function shiftDayByMonths(day: string, n: number): string {
  const month = shiftMonth(monthOf(day), n);
  const date = Math.min(Number(day.slice(8, 10)), daysInMonth(month));
  return `${month}-${String(date).padStart(2, "0")}`;
}

/** Rang du jour dans la semaine française : 0 = lundi … 6 = dimanche. */
export function weekdayIndex(day: string): number {
  return (fromIso(day).getUTCDay() + 6) % 7;
}

export type CalendarDay = { day: string; inMonth: boolean };

/** Six semaines de lundi à dimanche couvrant le mois, jours voisins marqués. */
export function monthGrid(month: string): CalendarDay[][] {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: CALENDAR_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = addDays(start, week * 7 + weekday);
      return { day, inMonth: monthOf(day) === month };
    }),
  );
}

/**
 * Mois affiché à l'ouverture : celui de la date saisie ; à défaut celui de
 * l'autre borne (le champ « au » vide s'ouvre sur le mois de « du ») ; à
 * défaut le mois d'aujourd'hui. Recalculé à CHAQUE ouverture.
 */
export function openingMonth(
  value: string | null | undefined,
  fallback: string | null | undefined,
  today: string,
): string {
  if (isIsoDay(value)) return monthOf(value);
  if (isIsoDay(fallback)) return monthOf(fallback);
  return monthOf(today);
}

/**
 * Jour qui reçoit le focus à l'ouverture : la date saisie si elle est dans le
 * mois affiché, sinon aujourd'hui s'il y est, sinon le 1er du mois.
 */
export function initialFocusDay(
  month: string,
  value: string | null | undefined,
  today: string,
): string {
  if (isIsoDay(value) && monthOf(value) === month) return value;
  if (monthOf(today) === month) return today;
  return `${month}-01`;
}

/**
 * Déplacement du focus au clavier dans la grille (motif « grille de dates » de
 * l'ARIA APG) ; null si la touche ne déplace rien.
 * Flèches : jour ou semaine ; Début / Fin : lundi ou dimanche de la semaine ;
 * Page préc. / suiv. : mois (année avec Maj).
 */
export function moveFocusDay(
  day: string,
  key: string,
  shiftKey = false,
): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -7);
    case "ArrowDown":
      return addDays(day, 7);
    case "Home":
      return addDays(day, -weekdayIndex(day));
    case "End":
      return addDays(day, 6 - weekdayIndex(day));
    case "PageUp":
      return shiftDayByMonths(day, shiftKey ? -12 : -1);
    case "PageDown":
      return shiftDayByMonths(day, shiftKey ? 12 : 1);
    default:
      return null;
  }
}
