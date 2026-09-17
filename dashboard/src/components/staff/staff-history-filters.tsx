import { LoaderCircle, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { DateRangeFields } from "@/components/date-range-fields";
import { FilterTray } from "@/components/filter-tray";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import { ORDER_SEARCH_MAX_LENGTH } from "@/domain/orders/types";
import {
  STAFF_HISTORY_ROLE_LABELS,
  STAFF_HISTORY_ROLES,
  type StaffHistoryFilters as Filters,
} from "@/domain/staff/rules";
import type { DateRangeInput } from "@/lib/days";

/*
 * Recherche dans l'historique d'une personne (serveur ; AutoSubmitForm, client,
 * la lance pendant la saisie, vers la fiche elle-même) : un champ (référence
 * ou client), puis le panneau des filtres : rôle tenu (préparation,
 * livraison), statut, et la zone de dates de livraison. Les champs deviennent
 * l'URL de la fiche (?q=&role=&statut=&du=&au=) ; la position de défilement
 * est gardée : la recherche est sous le formulaire de la fiche.
 */
export function StaffHistoryFilters({
  staffId,
  filters,
  period,
  canReset,
}: {
  staffId: string;
  filters: Filters;
  period: DateRangeInput;
  canReset: boolean;
}) {
  return (
    <AutoSubmitForm
      action={`/personnel/${staffId}`}
      aria-label="Recherche dans l'historique"
      className="flex flex-col gap-3"
    >
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 group-aria-busy/recherche:hidden"
        />
        <LoaderCircle
          aria-hidden="true"
          className="text-primary pointer-events-none absolute top-1/2 left-2.5 hidden size-4 -translate-y-1/2 animate-spin group-aria-busy/recherche:block"
        />
        <NativeInput
          id="historique-q"
          name="q"
          type="search"
          aria-label="Rechercher une commande"
          maxLength={ORDER_SEARCH_MAX_LENGTH}
          placeholder="Référence, client, téléphone, ville…"
          defaultValue={filters.query ?? ""}
          className="pl-8"
        />
      </div>
      <FilterTray
        reset={
          canReset
            ? {
                href: `/personnel/${staffId}`,
                label: "Réinitialiser la recherche",
                scroll: false,
              }
            : null
        }
      >
        <div className="grid grid-cols-2 gap-3 @2xl/main:max-w-md">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="historique-role">Rôle</Label>
            <NativeSelect
              id="historique-role"
              name="role"
              defaultValue={filters.role ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">Tous les rôles</NativeSelectOption>
              {STAFF_HISTORY_ROLES.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {STAFF_HISTORY_ROLE_LABELS[role]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="historique-statut">Statut</Label>
            <NativeSelect
              id="historique-statut"
              name="statut"
              defaultValue={filters.status ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">Tous les statuts</NativeSelectOption>
              {ORDER_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <DateRangeFields
          legend="Jour de livraison"
          fromLabel="Livraison du"
          toLabel="Livraison au"
          idPrefix="historique"
          period={period}
        />
      </FilterTray>
    </AutoSubmitForm>
  );
}
