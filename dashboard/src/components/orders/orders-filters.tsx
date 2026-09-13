import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import type { OrderFilters } from "@/domain/orders/types";

/*
 * Barre de filtres de la liste des commandes. Composant serveur : formulaire GET
 * via Form de next/form. Les champs deviennent les paramètres d'URL
 * (?statut=pending&date=2026-09-08), la navigation est faite côté client et
 * loading.tsx s'affiche pendant le chargement. Zéro hook, URL partageable, retour
 * arrière gratuit.
 *
 * - Reçoit les filtres déjà validés par parseOrderFilters, jamais l'URL brute.
 * - name="statut" en français : c'est la clé que orderFiltersSchema attend.
 * - « Réinitialiser » est un lien et non type="reset" : reset vide le formulaire,
 *   pas l'URL.
 */
export function OrdersFilters({ filters }: { filters: OrderFilters }) {
  const isFiltered = filters.status !== undefined || filters.date !== undefined;

  return (
    <Form
      action="/commandes"
      aria-label="Filtres des commandes"
      className="flex flex-col gap-3 md:flex-row md:items-end"
    >
      <div className="grid gap-1.5 md:w-48">
        <Label htmlFor="statut">Statut</Label>
        <NativeSelect
          id="statut"
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

      <div className="grid gap-1.5 md:w-48">
        <Label htmlFor="date">Date de livraison</Label>
        <Input
          id="date"
          type="date"
          name="date"
          defaultValue={filters.date ?? ""}
          className="dark:scheme-dark"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Filtrer</Button>
        {isFiltered ? (
          <Button variant="ghost" render={<Link href="/commandes" />}>
            Réinitialiser
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
