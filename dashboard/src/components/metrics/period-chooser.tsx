"use client";

import { useState, type ReactNode } from "react";
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
 * `children` de la page, les `tools` à droite) et, dessous, la zone de dates
 * qui n'existe que pour « Période personnalisée » (client : un état pour
 * l'ouvrir dès le choix, sans attendre l'envoi). La zone est rendue par le
 * serveur (`zone`) : ici on ne fait que la monter ou la démonter. Démontée,
 * ses champs ne partent pas dans l'URL : choisir « Hier » après avoir tapé des
 * dates envoie ?periode=hier seul. Sans JavaScript, la zone s'ouvre après
 * l'envoi (le serveur lit ?periode=personnalisee). Le formulaire parent donne
 * une `key` à ce composant : quand l'URL change (lien HT / TTC, « Revenir
 * à… »), le choix repart de la nouvelle URL.
 */
export function PeriodChooser({
  period,
  customPeriod,
  zone,
  children,
  tools,
}: {
  /** La période prédéfinie de l'URL (ou le défaut). */
  period: MetricPeriod;
  /** « Période personnalisée » choisie dans l'URL : la zone est ouverte au chargement. */
  customPeriod: boolean;
  /** La zone de dates « Du / Au », rendue par le serveur. */
  zone: ReactNode;
  /** Champs propres à la page, sur la ligne des listes. */
  children?: ReactNode;
  /** Commandes de la page (liens), à droite de la ligne des listes. */
  tools?: ReactNode;
}) {
  const [choice, setChoice] = useState<string>(
    customPeriod ? CUSTOM_PERIOD : period,
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
            onChange={(event) => setChoice(event.target.value)}
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
        {children}
        {tools ? (
          <div className="min-w-0 @2xl/main:ml-auto @2xl/main:pb-0.5">
            {tools}
          </div>
        ) : null}
      </div>
      {choice === CUSTOM_PERIOD ? zone : null}
    </>
  );
}
