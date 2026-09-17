import Link from "next/link";
import { LoaderCircle, RotateCcw, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { DateRangeFields } from "@/components/date-range-fields";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
 * champs deviennent l'URL (?q=…&statut=…&du=…&au=…&preparateur=…&livreur=…) :
 * URL partageable, retour arrière gratuit, l'écran reste affiché pendant le
 * chargement.
 * - Reçoit des filtres déjà validés (parseOrderFilters), jamais l'URL brute,
 *   et la saisie « du / au » telle quelle (parsePeriodInput) pour les deux
 *   champs de dates, groupés en un seul filtre (DateRangeFields).
 * - Les noms de champs sont les clés françaises que parseOrderFilters attend.
 * - Préparateur et livreur : tout le métier, personnes désactivées comprises
 *   (signalées), plus « Non affecté ».
 * - Page étroite (mobile, tablette sidebar ouverte) : filtres sur deux
 *   colonnes (le statut et les dates pleine largeur), aide masquée ; cinq
 *   colonnes dès que la zone de contenu le permet (@4xl/main).
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

export function OrdersFilters({
  filters,
  period,
  staff,
  canReset,
}: {
  filters: OrderFilters;
  /** La saisie « du / au » de l'URL, avec son erreur éventuelle. */
  period: DateRangeInput;
  staff: Record<AssignmentRole, StaffFilterOption[]>;
  canReset: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/commandes"
          aria-label="Recherche et filtres des commandes"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="q" className="text-base">
              Rechercher une commande
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
                maxLength={ORDER_SEARCH_MAX_LENGTH}
                placeholder="Référence, nom, téléphone, ville…"
                defaultValue={filters.query ?? ""}
                className="h-11 pl-10 text-base"
              />
            </div>
          </div>

          <div
            role="group"
            aria-label="Filtres"
            className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-5 @4xl/main:items-start"
          >
            <div className="col-span-2 grid gap-1.5 @4xl/main:col-span-1">
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

            <DateRangeFields
              legend="Jour de livraison"
              fromLabel="Livraison du"
              toLabel="Livraison au"
              idPrefix="commandes"
              period={period}
              className="col-span-2"
            />

            {ASSIGNMENT_ROLES.map((role) => {
              const field = STAFF_FIELDS[role];
              const value = filters[field.key];
              return (
                <div key={role} className="grid gap-1.5">
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

          {canReset ? (
            <div>
              <Link
                href="/commandes"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <RotateCcw />
                Réinitialiser
              </Link>
            </div>
          ) : null}
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
