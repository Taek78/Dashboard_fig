import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Commutateur de type d'une recherche (serveur) : un groupe de boutons radio
 * natifs, un par position, chacun dans sa couleur (marque pour « tous »,
 * tokens --individual et --community pour particulier et communauté). Le
 * bouton radio couvre toute l'étiquette, invisible mais bien là : clic,
 * clavier et lecteurs d'écran passent par lui, l'étiquette ne fait que
 * l'habiller ; coché = envoyé aussitôt par AutoSubmitForm, sans JavaScript
 * dédié. Sur téléphone, l'icône est masquée : les positions tiennent alors
 * sur une ligne. Partagé par les Clients (particuliers, communautés, tous)
 * et les Commandes (type de commande).
 */
export type TypeSwitchTone = "brand" | "individual" | "community";

export type TypeSwitchOption = {
  value: string;
  label: string;
  icon: LucideIcon;
  tone: TypeSwitchTone;
  /** Infobulle facultative. */
  title?: string;
};

const TONES: Record<TypeSwitchTone, string> = {
  brand:
    "has-checked:bg-primary/15 has-checked:text-primary has-checked:ring-primary/40",
  individual:
    "has-checked:bg-individual/15 has-checked:text-individual has-checked:ring-individual/40",
  community:
    "has-checked:bg-community/15 has-checked:text-community has-checked:ring-community/40",
};

export function TypeSwitch({
  legend,
  name,
  value,
  options,
  className,
}: {
  /** Intitulé visible du groupe (et son nom accessible). */
  legend: string;
  /** Nom du champ dans l'URL. */
  name: string;
  /** Position cochée. */
  value: string;
  options: readonly TypeSwitchOption[];
  className?: string;
}) {
  return (
    <fieldset className={cn("grid min-w-0 gap-1.5", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div
        className="bg-card border-input inline-flex min-h-9 w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border p-0.5"
        role="radiogroup"
        aria-label={legend}
      >
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              title={option.title}
              className={cn(
                "text-muted-foreground has-focus-visible:ring-ring relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors select-none has-checked:font-semibold has-checked:shadow-xs has-checked:ring-1 has-focus-visible:ring-2",
                TONES[option.tone],
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={value === option.value}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <Icon
                aria-hidden="true"
                className="hidden size-4 @xl/main:inline"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
