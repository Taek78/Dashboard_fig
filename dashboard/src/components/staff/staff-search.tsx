import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  SHIFT_LABELS,
  SHIFTS,
  STAFF_KIND_PLURALS,
  STAFF_KINDS,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from "@/domain/staff/kind";
import {
  STAFF_PRESENCE_LABELS,
  STAFF_PRESENCES,
  type StaffSearch as StaffSearchValues,
} from "@/domain/staff/rules";
import { STAFF_SEARCH_MAX_LENGTH } from "@/domain/staff/types";

/*
 * Recherche de la section Personnel (serveur ; la recherche automatique vient
 * d'AutoSubmitForm) : la barre de recherche (nom, prénom, e-mail ou
 * téléphone), puis le panneau des cinq filtres (métier, disponibilité,
 * créneau, jour travaillé, présence dans l'équipe). Les champs deviennent
 * l'URL (?q=&type=&dispo=&creneau=&jour=&presence=), lue par parseStaffSearch.
 */
const FILTERS = [
  {
    name: "type",
    label: "Métier",
    all: "Tous les métiers",
    key: "kind",
    options: STAFF_KINDS.map((k) => [k, STAFF_KIND_PLURALS[k]]),
  },
  {
    name: "dispo",
    label: "Disponibilité",
    all: "Toutes",
    key: "availability",
    options: AVAILABILITIES.map((a) => [a, AVAILABILITY_LABELS[a]]),
  },
  {
    name: "creneau",
    label: "Créneau",
    all: "Tous les créneaux",
    key: "shift",
    options: SHIFTS.map((s) => [s, SHIFT_LABELS[s]]),
  },
  {
    name: "jour",
    label: "Travaille le",
    all: "N'importe quel jour",
    key: "workDay",
    options: WEEKDAYS.map((d) => [d, WEEKDAY_LABELS[d]]),
  },
  {
    name: "presence",
    label: "Présence",
    all: "Toute l'équipe",
    key: "presence",
    options: STAFF_PRESENCES.map((p) => [p, STAFF_PRESENCE_LABELS[p]]),
  },
] as const satisfies readonly {
  name: string;
  label: string;
  all: string;
  key: keyof Omit<StaffSearchValues, "query">;
  options: readonly (readonly [string, string])[];
}[];

export function StaffSearch({
  search,
  canReset,
}: {
  search: StaffSearchValues;
  canReset: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/personnel"
          aria-label="Recherche dans l'équipe"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher une personne"
            placeholder="Nom, prénom, e-mail ou téléphone…"
            maxLength={STAFF_SEARCH_MAX_LENGTH}
            defaultValue={search.query}
          />

          <FilterTray reset={canReset ? { href: "/personnel" } : null}>
            <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-3 @5xl/main:grid-cols-5">
              {FILTERS.map((filter, index) => (
                <div
                  key={filter.name}
                  className={
                    index === 0
                      ? "col-span-2 grid min-w-0 gap-1.5 @3xl/main:col-span-1"
                      : "grid min-w-0 gap-1.5"
                  }
                >
                  <Label htmlFor={filter.name}>{filter.label}</Label>
                  <NativeSelect
                    id={filter.name}
                    name={filter.name}
                    defaultValue={search[filter.key] ?? ""}
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      {filter.all}
                    </NativeSelectOption>
                    {filter.options.map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
