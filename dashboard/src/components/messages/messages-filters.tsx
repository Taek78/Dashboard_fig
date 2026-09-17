import { AutoSubmitForm } from "@/components/auto-submit-form";
import { CheckChip } from "@/components/check-chip";
import { DateRangeFields } from "@/components/date-range-fields";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUSES,
} from "@/domain/messages/status";
import {
  MESSAGE_SUBJECT_LABELS,
  MESSAGE_SUBJECTS,
} from "@/domain/messages/subject";
import {
  IMPORTANT_FILTER,
  MESSAGE_SEARCH_MAX_LENGTH,
  type MessageFilters,
} from "@/domain/messages/types";
import type { DateRangeInput } from "@/lib/days";

/*
 * Recherche et filtres de la boîte de réception (serveur ; AutoSubmitForm,
 * client, lance la recherche pendant la saisie). Les champs deviennent l'URL
 * (?q=…&statut=…&objet=…&du=…&au=…&important=oui) : URL partageable, retour
 * arrière gratuit, l'écran reste affiché pendant le chargement.
 *
 * - La barre de recherche, puis le panneau des filtres (FilterTray) : statut,
 *   objet et la puce « importants » sur une ligne, la zone de dates en
 *   dernier, pleine largeur.
 * - Reçoit des filtres déjà validés (parseMessageFilters), jamais l'URL brute,
 *   et la saisie « du / au » telle quelle.
 * - Les noms de champs sont les clés françaises que parseMessageFilters attend.
 * - La puce « importants » n'a pas d'état « non » : décochée, elle n'envoie
 *   rien et il n'y a donc pas de filtre (une case cochée applique tout de
 *   suite, sans anti-rebond).
 */
export function MessagesFilters({
  filters,
  period,
  canReset,
}: {
  filters: MessageFilters;
  period: DateRangeInput;
  canReset: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/messages"
          aria-label="Recherche et filtres des messages"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher un message"
            placeholder="Nom, e-mail, mot du message, référence…"
            maxLength={MESSAGE_SEARCH_MAX_LENGTH}
            defaultValue={filters.query}
          />

          <FilterTray reset={canReset ? { href: "/messages" } : null}>
            <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @2xl/main:items-end">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="statut">Statut</Label>
                <NativeSelect
                  id="statut"
                  name="statut"
                  defaultValue={filters.status ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">Tous</NativeSelectOption>
                  {MESSAGE_STATUSES.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {MESSAGE_STATUS_LABELS[status]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="objet">Objet</Label>
                <NativeSelect
                  id="objet"
                  name="objet"
                  defaultValue={filters.subject ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">
                    Tous les objets
                  </NativeSelectOption>
                  {MESSAGE_SUBJECTS.map((subject) => (
                    <NativeSelectOption key={subject} value={subject}>
                      {MESSAGE_SUBJECT_LABELS[subject]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <CheckChip
                id="important"
                name="important"
                value={IMPORTANT_FILTER}
                defaultChecked={filters.important === true}
                accent="destructive"
                className="col-span-2 justify-self-start @2xl/main:col-span-1"
              >
                Seulement les messages signalés importants
              </CheckChip>
            </div>

            <DateRangeFields
              legend="Jour de réception"
              fromLabel="Reçu du"
              toLabel="Reçu au"
              idPrefix="messages"
              period={period}
            />
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
