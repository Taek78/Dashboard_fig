import { CircleAlert } from "lucide-react";
import { DatePickerButton } from "@/components/date-picker-button";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DateRangeError, DateRangeInput } from "@/lib/days";
import { cn } from "@/lib/utils";

/*
 * Les deux champs « du / au » d'une recherche par dates (serveur), groupés
 * dans UN SEUL cadre avec un seul intitulé : c'est un filtre, pas deux. Le
 * même composant sert aux commandes, aux messages, aux historiques des fiches
 * et à la plage libre du tableau de bord et des métriques.
 *
 * Les valeurs affichées sont celles de l'URL, jamais corrigées : si les dates
 * sont inversées, le cadre passe en rouge et une erreur (role="alert") dit
 * qu'aucune période n'est appliquée. Une seule date remplie n'est pas une
 * erreur : ce jour-là est cherché (readDateRange). Pas d'aide par défaut.
 * NativeInput : les champs restent montés pendant la saisie automatique.
 * Sur tablette et PC, chaque champ reçoit le calendrier maison
 * (DatePickerButton : jours hors du mois grisés, ouverture sur le mois de la
 * date saisie) ; sur téléphone, le sélecteur natif du système reste.
 */
/** Sur tablette et PC, l'icône native laisse la place au bouton du calendrier. */
const DATE_INPUT =
  "dark:scheme-dark md:pr-9 md:[&::-webkit-calendar-picker-indicator]:hidden";
const ERROR_LABELS: Record<DateRangeError, string> = {
  inverted:
    "La date de début est après la date de fin : corrigez-les, aucune période n'est appliquée.",
};

/** « Livraison du » → « Livraison » en lecteur d'écran seulement, « Du » visible. */
function splitLabel(label: string): { hidden: string; shown: string } {
  const index = label.lastIndexOf(" ");
  const word = index === -1 ? label : label.slice(index + 1);
  return {
    hidden: index === -1 ? "" : label.slice(0, index + 1),
    shown: word.charAt(0).toUpperCase() + word.slice(1),
  };
}

export function DateRangeFields({
  legend,
  fromLabel,
  toLabel,
  idPrefix,
  period,
  help,
  className,
}: {
  /** Intitulé du filtre (« Période de livraison », « Réception »…). */
  legend: string;
  /** Nom accessible complet du premier champ (« Livraison du ») ; « Du » reste visible. */
  fromLabel: string;
  toLabel: string;
  /** Préfixe des id, unique dans la page (plusieurs formulaires possibles). */
  idPrefix: string;
  period: DateRangeInput;
  /** Aide facultative sous les champs, quand il n'y a pas d'erreur. */
  help?: string;
  className?: string;
}) {
  const fromId = `${idPrefix}-du`;
  const toId = `${idPrefix}-au`;
  const messageId = `${idPrefix}-periode-message`;
  const error = period.error;
  const from = splitLabel(fromLabel);
  const to = splitLabel(toLabel);

  return (
    <fieldset className={cn("grid min-w-0 gap-1.5", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div
        className={cn(
          "grid grid-cols-2 gap-2 rounded-xl border p-2 transition-colors",
          error
            ? "border-destructive bg-destructive/5"
            : "border-input bg-muted/30",
        )}
      >
        <div className="grid min-w-0 gap-1">
          <Label htmlFor={fromId} className="text-muted-foreground text-xs">
            {from.hidden ? (
              <span className="sr-only">{from.hidden}</span>
            ) : null}
            {from.shown}
          </Label>
          <div className="relative min-w-0">
            <NativeInput
              id={fromId}
              name="du"
              type="date"
              defaultValue={period.from ?? ""}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || help ? messageId : undefined}
              className={DATE_INPUT}
            />
            <DatePickerButton
              inputId={fromId}
              otherInputId={toId}
              label="Calendrier, date de début"
            />
          </div>
        </div>
        <div className="grid min-w-0 gap-1">
          <Label htmlFor={toId} className="text-muted-foreground text-xs">
            {to.hidden ? <span className="sr-only">{to.hidden}</span> : null}
            {to.shown}
          </Label>
          <div className="relative min-w-0">
            <NativeInput
              id={toId}
              name="au"
              type="date"
              defaultValue={period.to ?? ""}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || help ? messageId : undefined}
              className={DATE_INPUT}
            />
            <DatePickerButton
              inputId={toId}
              otherInputId={fromId}
              label="Calendrier, date de fin"
            />
          </div>
        </div>
      </div>
      {error ? (
        <p
          id={messageId}
          role="alert"
          className="text-destructive flex items-start gap-1.5 text-xs font-medium"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {ERROR_LABELS[error]}
        </p>
      ) : help ? (
        <p id={messageId} className="text-muted-foreground text-xs">
          {help}
        </p>
      ) : null}
    </fieldset>
  );
}
