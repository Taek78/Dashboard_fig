import type { ReactNode } from "react";
import { LayoutGrid, User, Users } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { DateRangeFields } from "@/components/date-range-fields";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { TypeSwitch, type TypeSwitchOption } from "@/components/type-switch";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CLIENT_TYPE_LABELS } from "@/domain/customers/client-type";
import {
  ASSIGNMENT_ROLE_LABELS,
  ASSIGNMENT_ROLES,
  type AssignmentRole,
} from "@/domain/orders/assignment";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import {
  ORDER_SEARCH_MAX_LENGTH,
  UNASSIGNED_FILTER,
  type OrderFilters,
} from "@/domain/orders/types";
import type { StaffFilterOption } from "@/domain/staff/rules";
import type { DateRangeInput } from "@/lib/days";

/*
 * Recherche et filtres de la liste des commandes (serveur ; AutoSubmitForm,
 * client, lance la recherche pendant la saisie avec un anti-rebond). Les
 * champs deviennent l'URL (?q=…&type=…&statut=…&du=…&au=…&preparateur=…
 * &livreur=…) : URL partageable, retour arrière gratuit, l'écran reste
 * affiché pendant le chargement.
 * - La barre de recherche, puis le panneau des filtres (FilterTray) : le
 *   TYPE de commande (toutes, particuliers, communautés : commutateur coloré
 *   comme celui des Clients), statut, préparateur et livreur, et la zone de
 *   dates en dernier, pleine largeur, avec les raccourcis des 7 derniers
 *   jours (`shortcuts`, rendus par la page).
 * - Reçoit des filtres déjà validés (parseOrderFilters), jamais l'URL brute,
 *   et la saisie « du / au » telle quelle (parsePeriodInput).
 * - Les noms de champs sont les clés françaises que parseOrderFilters attend.
 * - Préparateur et livreur : tout le métier, personnes désactivées comprises
 *   (signalées), plus « Non affecté ».
 * - « Réinitialiser » est un vrai lien : il vide l'URL, AutoSubmitForm remonte
 *   alors les champs.
 */
const STAFF_FIELDS: Record<
  AssignmentRole,
  { name: string; key: "preparerId" | "driverId" }
> = {
  preparer: { name: "preparateur", key: "preparerId" },
  driver: { name: "livreur", key: "driverId" },
};

/** Positions du commutateur de type : la valeur vide = toutes les commandes. */
const KIND_OPTIONS: readonly TypeSwitchOption[] = [
  { value: "", label: "Toutes", icon: LayoutGrid, tone: "brand" },
  {
    value: "particulier",
    label: `${CLIENT_TYPE_LABELS.particulier}s`,
    icon: User,
    tone: "individual",
    title: "Commandes d'une personne, livrées chez elle",
  },
  {
    value: "communaute",
    label: `${CLIENT_TYPE_LABELS.communaute}s`,
    icon: Users,
    tone: "community",
    title: "Commandes groupées d'une communauté, livrées à son interlocuteur",
  },
];

export function OrdersFilters({
  filters,
  period,
  staff,
  canReset,
  shortcuts,
}: {
  filters: OrderFilters;
  /** La saisie « du / au » de l'URL, avec son erreur éventuelle. */
  period: DateRangeInput;
  staff: Record<AssignmentRole, StaffFilterOption[]>;
  canReset: boolean;
  /** Raccourcis des derniers jours, dans l'en-tête de la zone de dates. */
  shortcuts?: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/commandes"
          aria-label="Recherche et filtres des commandes"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher une commande"
            placeholder="Référence, nom, téléphone, ville…"
            maxLength={ORDER_SEARCH_MAX_LENGTH}
            defaultValue={filters.query}
          />

          <FilterTray reset={canReset ? { href: "/commandes" } : null}>
            <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-3 @4xl/main:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] @4xl/main:items-end">
              <TypeSwitch
                legend="Type de commande"
                name="type"
                value={filters.kind ?? ""}
                options={KIND_OPTIONS}
                className="col-span-2 @2xl/main:col-span-3 @4xl/main:col-span-1"
              />
              <div className="col-span-2 grid min-w-0 gap-1.5 @2xl/main:col-span-1">
                <Label htmlFor="statut">Statut</Label>
                <NativeSelect
                  id="statut"
                  name="statut"
                  defaultValue={filters.status ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">
                    Tous les statuts
                  </NativeSelectOption>
                  {ORDER_STATUSES.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              {ASSIGNMENT_ROLES.map((role) => {
                const field = STAFF_FIELDS[role];
                const value = filters[field.key];
                return (
                  <div key={role} className="grid min-w-0 gap-1.5">
                    <Label htmlFor={field.name}>
                      {ASSIGNMENT_ROLE_LABELS[role]}
                    </Label>
                    <NativeSelect
                      id={field.name}
                      name={field.name}
                      defaultValue={
                        value === null ? UNASSIGNED_FILTER : (value ?? "")
                      }
                      className="w-full"
                    >
                      <NativeSelectOption value="">
                        Toute l&apos;équipe
                      </NativeSelectOption>
                      <NativeSelectOption value={UNASSIGNED_FILTER}>
                        Non affecté
                      </NativeSelectOption>
                      {staff[role].map((option) => (
                        <NativeSelectOption key={option.id} value={option.id}>
                          {option.active
                            ? option.name
                            : `${option.name} (inactif)`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                );
              })}
            </div>

            <DateRangeFields
              legend="Jour de livraison"
              fromLabel="Livraison du"
              toLabel="Livraison au"
              idPrefix="commandes"
              period={period}
              aside={shortcuts}
            />
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
