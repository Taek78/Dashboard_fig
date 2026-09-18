"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CUSTOM_PERIOD,
  CUSTOM_PERIOD_LABEL,
  METRIC_PERIOD_LABELS,
  METRIC_PERIODS,
  type MetricPeriod,
} from "@/domain/metrics/rules";

/*
 * La ligne des listes du formulaire de période (« Période », puis les
 * `children` de la page, les `tools` à droite), la zone de dates qui n'existe
 * que pour « Période personnalisée », et la ligne du bas (bouton, légende).
 *
 * Envoi (demande du 2026-09-18) :
 * - une période PRÉDÉFINIE s'applique dès qu'on la choisit, sans bouton : le
 *   formulaire est envoyé aussitôt (next/form : navigation côté client). Même
 *   chose pour une liste de la page (« Comparer à ») tant que la période est
 *   prédéfinie ;
 * - « Période personnalisée » ouvre la zone de dates et le bouton « Afficher » :
 *   la recherche date à date ne part qu'au clic, une fois les deux dates
 *   saisies (un envoi à chaque frappe chercherait des plages à moitié tapées).
 * La zone est démontée AVANT l'envoi d'une période prédéfinie (flushSync) :
 * ses champs ne partent donc pas dans l'URL. Sans JavaScript, le bouton reste
 * présent (<noscript>) et le serveur ouvre la zone d'après l'URL.
 * Le formulaire parent donne une `key` à ce composant : quand l'URL change
 * (lien HT / TTC, « Revenir à… »), le choix repart de la nouvelle URL.
 */
export function PeriodChooser({
  period,
  customPeriod,
  zone,
  legend,
  children,
  tools,
}: {
  /** La période prédéfinie de l'URL (ou le défaut). */
  period: MetricPeriod;
  /** « Période personnalisée » choisie dans l'URL : la zone est ouverte au chargement. */
  customPeriod: boolean;
  /** La zone de dates « Du / Au », rendue par le serveur. */
  zone: ReactNode;
  /** « Période affichée : … », rendue par le serveur, sous les listes. */
  legend: ReactNode;
  /** Champs propres à la page, sur la ligne des listes. */
  children?: ReactNode;
  /** Commandes de la page (liens), à droite de la ligne des listes. */
  tools?: ReactNode;
}) {
  const [choice, setChoice] = useState<string>(
    customPeriod ? CUSTOM_PERIOD : period,
  );
  const custom = choice === CUSTOM_PERIOD;

  function choosePeriod(event: ChangeEvent<HTMLSelectElement>) {
    const { value, form } = event.target;
    // La zone doit être démontée AVANT l'envoi : ses dates ne partent pas.
    flushSync(() => setChoice(value));
    if (value !== CUSTOM_PERIOD) form?.requestSubmit();
  }

  /** Une liste de la page (« Comparer à ») s'applique aussitôt, sauf en période personnalisée. */
  function changeOther(event: ChangeEvent<HTMLDivElement>) {
    const target: EventTarget = event.target;
    if (!custom && target instanceof HTMLSelectElement) {
      target.form?.requestSubmit();
    }
  }

  const submit = (
    <Button type="submit" className="w-full @xl/main:w-auto">
      <CalendarRange />
      Afficher
    </Button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-end">
        <div className="grid min-w-0 gap-1.5 @2xl/main:w-56">
          <Label htmlFor="periode">Période</Label>
          <NativeSelect
            id="periode"
            name="periode"
            value={choice}
            onChange={choosePeriod}
            className="w-full"
          >
            {METRIC_PERIODS.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {METRIC_PERIOD_LABELS[p]}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={CUSTOM_PERIOD}>
              {CUSTOM_PERIOD_LABEL}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        {children ? (
          <div className="contents" onChange={changeOther}>
            {children}
          </div>
        ) : null}
        {tools ? (
          <div className="min-w-0 @2xl/main:ml-auto @2xl/main:pb-0.5">
            {tools}
          </div>
        ) : null}
      </div>
      {custom ? zone : null}
      <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:items-center @xl/main:gap-4">
        {custom ? submit : <noscript>{submit}</noscript>}
        {legend}
      </div>
    </>
  );
}
