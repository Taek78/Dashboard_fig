import type { ReactNode } from "react";
import { CalendarRange, CircleAlert } from "lucide-react";
import { DatePickerButton } from "@/components/date-picker-button";
import { NativeInput } from "@/components/ui/input";
import type { DateRangeError, DateRangeInput } from "@/lib/days";
import { cn } from "@/lib/utils";

/*
 * Les deux champs « du / au » d'une recherche par dates (serveur), dans UNE
 * zone dédiée, pleine largeur : un en-tête (icône, intitulé, et à droite une
 * place pour des raccourcis ou un lien), puis les deux champs à la hauteur
 * des autres champs du formulaire, chacun avec son préfixe visible « Du » /
 * « Au », puis l'erreur ou une légende. Le même composant sert aux commandes,
 * aux messages, aux historiques des fiches et à la période personnalisée du
 * tableau de bord et des métriques (montée seulement pour ce choix).
 *
 * Trois variantes de surface : « row », dernière ligne d'un FilterTray (un
 * filet au-dessus, la teinte est celle du panneau) ; « zone », sa propre
 * surface teintée quand la zone est seule dans une carte ; « plain », rien.
 *
 * Les valeurs affichées sont celles de l'URL, jamais corrigées : si les dates
 * sont inversées, les champs passent en rouge et une erreur (role="alert") dit
 * qu'aucune période n'est appliquée. Une seule date remplie n'est pas une
 * erreur : ce jour-là est cherché (readDateRange). NativeInput : les champs
 * restent montés pendant la saisie automatique. Sur tablette et PC, chaque
 * champ reçoit le calendrier maison (DatePickerButton : jours hors du mois
 * grisés, ouverture sur le mois de la date saisie) ; sur téléphone, le
 * sélecteur natif du système reste. Sous @xl/main, les deux champs
 * s'empilent : deux dates natives côte à côte ne tiennent pas dans 400 px.
 */
const VARIANTS = {
  row: "border-t pt-3",
  zone: "surface-tray rounded-xl p-3",
  plain: "",
} as const;

const FIELD =
  "bg-card border-input focus-within:border-ring focus-within:ring-ring/50 relative flex h-9 min-w-0 items-stretch rounded-lg border transition-colors focus-within:ring-3";
const FIELD_ERROR =
  "border-destructive focus-within:border-destructive focus-within:ring-destructive/25";
const PREFIX =
  "text-muted-foreground flex shrink-0 items-center rounded-l-lg border-r px-2.5 text-xs font-semibold";
/** Le champ natif sans son propre cadre : c'est la puce qui le porte. Sur tablette et PC, l'icône native laisse la place au bouton du calendrier. */
const DATE_INPUT =
  "h-full flex-1 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 aria-invalid:ring-0 dark:scheme-dark md:pr-9 md:[&::-webkit-calendar-picker-indicator]:hidden";

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

function DateField({
  id,
  name,
  label,
  otherId,
  pickerLabel,
  value,
  error,
  messageId,
}: {
  id: string;
  name: "du" | "au";
  label: string;
  otherId: string;
  pickerLabel: string;
  value: string | undefined;
  error: DateRangeError | null;
  messageId: string | undefined;
}) {
  const parts = splitLabel(label);
  return (
    <div className={cn(FIELD, error && FIELD_ERROR)}>
      <label htmlFor={id} className={PREFIX}>
        {parts.hidden ? <span className="sr-only">{parts.hidden}</span> : null}
        {parts.shown}
      </label>
      <NativeInput
        id={id}
        name={name}
        type="date"
        defaultValue={value ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={DATE_INPUT}
      />
      <DatePickerButton
        inputId={id}
        otherInputId={otherId}
        label={pickerLabel}
      />
    </div>
  );
}

export function DateRangeFields({
  legend,
  fromLabel,
  toLabel,
  idPrefix,
  period,
  variant = "row",
  aside,
  action,
  caption,
  className,
}: {
  /** Intitulé de la zone (« Jour de livraison », « Plage de dates »…). */
  legend: string;
  /** Nom accessible complet du premier champ (« Livraison du ») ; « Du » reste visible. */
  fromLabel: string;
  toLabel: string;
  /** Préfixe des id, unique dans la page (plusieurs formulaires possibles). */
  idPrefix: string;
  period: DateRangeInput;
  variant?: keyof typeof VARIANTS;
  /** À droite de l'intitulé : raccourcis, lien de réinitialisation. */
  aside?: ReactNode;
  /** À droite des champs : le bouton d'envoi d'un formulaire sans recherche automatique. */
  action?: ReactNode;
  /** Sous les champs quand il n'y a pas d'erreur : la période effectivement affichée. */
  caption?: ReactNode;
  className?: string;
}) {
  const fromId = `${idPrefix}-du`;
  const toId = `${idPrefix}-au`;
  const messageId = `${idPrefix}-periode-message`;
  const error = period.error;
  const describedBy = error || caption ? messageId : undefined;

  return (
    <div
      data-slot="date-range"
      className={cn("grid min-w-0 gap-2.5", VARIANTS[variant], className)}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <span
          aria-hidden="true"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <CalendarRange className="text-primary size-4" />
          {legend}
        </span>
        {aside}
      </div>
      <fieldset
        className={cn(
          "grid min-w-0 gap-2 @xl/main:grid-cols-2",
          action && "@xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
        )}
      >
        <legend className="sr-only">{legend}</legend>
        <DateField
          id={fromId}
          name="du"
          label={fromLabel}
          otherId={toId}
          pickerLabel="Calendrier, date de début"
          value={period.from}
          error={error}
          messageId={describedBy}
        />
        <DateField
          id={toId}
          name="au"
          label={toLabel}
          otherId={fromId}
          pickerLabel="Calendrier, date de fin"
          value={period.to}
          error={error}
          messageId={describedBy}
        />
        {action}
      </fieldset>
      {error ? (
        <p
          id={messageId}
          role="alert"
          className="text-destructive flex items-start gap-1.5 text-xs font-medium"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {ERROR_LABELS[error]}
        </p>
      ) : caption ? (
        <p id={messageId} className="text-muted-foreground text-xs">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
