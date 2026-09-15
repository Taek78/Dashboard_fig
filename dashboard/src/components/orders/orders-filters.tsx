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
import { Skeleton } from "@/components/ui/skeleton";
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

/*
 * Recherche et filtres des listes de commandes et de livraisons (serveur ;
 * AutoSubmitForm, client, lance la recherche pendant la saisie avec un
 * anti-rebond). Les champs deviennent l'URL
 * (?q=…&statut=…&du=…&au=…&preparateur=…&livreur=…) : URL partageable, retour
 * arrière gratuit, l'écran reste affiché pendant le chargement.
 * - Reçoit des filtres déjà validés (parseOrderFilters), jamais l'URL brute ;
 *   sur /livraisons, la période effective (aujourd'hui par défaut, 7 jours au
 *   plus).
 * - Les noms de champs sont les clés françaises que parseOrderFilters attend.
 * - Préparateur et livreur : tout le métier, personnes désactivées comprises
 *   (signalées), plus « Non affecté ».
 * - Page étroite (mobile, tablette sidebar ouverte) : filtres sur deux
 *   colonnes (le statut pleine largeur), aide masquée ; cinq colonnes dès que
 *   la zone de contenu le permet (@4xl/main).
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
  action,
  formLabel,
  searchLabel,
  filters,
  staff,
  canReset,
  rangeHelp,
}: {
  action: "/commandes" | "/livraisons";
  /** Nom accessible du formulaire. */
  formLabel: string;
  /** Intitulé visible du champ de recherche. */
  searchLabel: string;
  filters: OrderFilters;
  staff: Record<AssignmentRole, StaffFilterOption[]>;
  canReset: boolean;
  /** Aide sous les filtres (ex. la limite de période des livraisons). */
  rangeHelp?: string;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action={action}
          aria-label={formLabel}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="q" className="text-base">
              {searchLabel}
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
                aria-describedby="q-help"
                className="h-11 pl-10 text-base"
              />
            </div>
            <p
              id="q-help"
              className="text-muted-foreground text-sm @max-2xl/main:hidden"
            >
              Les résultats se mettent à jour pendant la saisie. Une partie
              suffit : « 260907 », « benali », « rocher@ » ou les derniers
              chiffres d&apos;un téléphone « 00 07 ». Accents et majuscules sont
              ignorés.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtres"
            className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-5"
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

            <div className="grid gap-1.5">
              <Label htmlFor="du">Livraison du</Label>
              <NativeInput
                id="du"
                type="date"
                name="du"
                defaultValue={filters.from ?? ""}
                className="dark:scheme-dark"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="au">Livraison au</Label>
              <NativeInput
                id="au"
                type="date"
                name="au"
                defaultValue={filters.to ?? ""}
                className="dark:scheme-dark"
              />
            </div>

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

          <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:items-center @xl/main:justify-between">
            <p className="text-muted-foreground text-xs">
              {rangeHelp ??
                "Dates : jour de livraison, bornes incluses. Une seule date suffit."}
            </p>
            {canReset ? (
              <Link
                href={action}
                className={`${buttonVariants({ variant: "ghost", size: "sm" })} self-start @xl/main:self-auto`}
              >
                <RotateCcw />
                Réinitialiser
              </Link>
            ) : null}
          </div>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}

const FIELD_SKELETONS = [1, 2, 3, 4, 5];

/** Silhouette de la barre pour les loading.tsx (qui ne connaissent pas l'URL). */
export function OrdersFiltersSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-96 max-w-full @max-2xl/main:hidden" />
        <div className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-5">
          {FIELD_SKELETONS.map((field) => (
            <div
              key={field}
              className={
                field === 1
                  ? "col-span-2 grid gap-1.5 @4xl/main:col-span-1"
                  : "grid gap-1.5"
              }
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
