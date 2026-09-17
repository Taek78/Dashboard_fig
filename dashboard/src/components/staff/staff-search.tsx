import Link from "next/link";
import { LoaderCircle, RotateCcw, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/input";
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
 * d'AutoSubmitForm) : un champ pour le nom, le prénom, l'e-mail ou le
 * téléphone, puis cinq filtres (métier, disponibilité, créneau, jour travaillé,
 * présence dans l'équipe). Les champs deviennent l'URL
 * (?q=&type=&dispo=&creneau=&jour=&presence=), lue par parseStaffSearch.
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="q" className="text-base">
              Rechercher une personne
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 group-aria-busy/recherche:hidden"
              />
              <LoaderCircle
                aria-hidden="true"
                className="text-primary pointer-events-none absolute top-1/2 left-3 hidden size-5 -translate-y-1/2 animate-spin group-aria-busy/recherche:block"
              />
              <NativeInput
                id="q"
                name="q"
                type="search"
                maxLength={STAFF_SEARCH_MAX_LENGTH}
                placeholder="Nom, prénom, e-mail ou téléphone…"
                defaultValue={search.query ?? ""}
                className="h-11 pl-10 text-base"
              />
            </div>
          </div>

          <div
            role="group"
            aria-label="Filtres"
            className="grid grid-cols-2 gap-3 border-t pt-4 @3xl/main:grid-cols-3 @5xl/main:grid-cols-5"
          >
            {FILTERS.map((filter, index) => (
              <div
                key={filter.name}
                className={
                  index === 0
                    ? "col-span-2 grid gap-1.5 @3xl/main:col-span-1"
                    : "grid gap-1.5"
                }
              >
                <Label htmlFor={filter.name}>{filter.label}</Label>
                <NativeSelect
                  id={filter.name}
                  name={filter.name}
                  defaultValue={search[filter.key] ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">{filter.all}</NativeSelectOption>
                  {filter.options.map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>

          {canReset ? (
            <Link
              href="/personnel"
              className={`${buttonVariants({ variant: "ghost", size: "sm" })} self-end`}
            >
              <RotateCcw />
              Réinitialiser
            </Link>
          ) : null}
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
