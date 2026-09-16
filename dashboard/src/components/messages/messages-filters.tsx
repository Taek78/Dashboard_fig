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

/*
 * Recherche et filtres de la boîte de réception (serveur ; AutoSubmitForm,
 * client, lance la recherche pendant la saisie). Les champs deviennent l'URL
 * (?q=…&statut=…&objet=…&du=…&au=…&important=oui) : URL partageable, retour
 * arrière gratuit, l'écran reste affiché pendant le chargement.
 *
 * - Reçoit des filtres déjà validés (parseMessageFilters), jamais l'URL brute.
 * - Les noms de champs sont les clés françaises que parseMessageFilters attend.
 * - La case « importants » n'a pas d'état « non » : décochée, elle n'envoie
 *   rien et il n'y a donc pas de filtre (une case cochée applique tout de
 *   suite, sans anti-rebond).
 * - Page étroite : deux colonnes ; quatre dès que la zone de contenu le permet.
 */
export function MessagesFilters({
  filters,
  canReset,
}: {
  filters: MessageFilters;
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="q" className="text-base">
              Rechercher un message
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
                maxLength={MESSAGE_SEARCH_MAX_LENGTH}
                placeholder="Nom, e-mail, mot du message, référence…"
                defaultValue={filters.query ?? ""}
                aria-describedby="q-help"
                className="h-11 pl-10 text-base"
              />
            </div>
            <p
              id="q-help"
              className="text-muted-foreground text-sm @max-2xl/main:hidden"
            >
              Les résultats se mettent à jour pendant la saisie. La recherche
              porte sur le nom et l&apos;e-mail du client, le texte du message
              et la référence de la commande associée. Accents et majuscules
              sont ignorés.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtres"
            className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-4"
          >
            <div className="grid gap-1.5">
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

            <div className="grid gap-1.5">
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

            <div className="grid gap-1.5">
              <Label htmlFor="du">Reçu du</Label>
              <NativeInput
                id="du"
                type="date"
                name="du"
                defaultValue={filters.from ?? ""}
                className="dark:scheme-dark"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="au">Reçu au</Label>
              <NativeInput
                id="au"
                type="date"
                name="au"
                defaultValue={filters.to ?? ""}
                className="dark:scheme-dark"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:items-center @xl/main:justify-between">
            <Label
              htmlFor="important"
              className="flex items-center gap-2 text-sm font-normal"
            >
              <input
                id="important"
                type="checkbox"
                name="important"
                value={IMPORTANT_FILTER}
                defaultChecked={filters.important === true}
                className="accent-destructive size-4"
              />
              Seulement les messages signalés importants
            </Label>
            {canReset ? (
              <Link
                href="/messages"
                className={`${buttonVariants({ variant: "ghost", size: "sm" })} self-start @xl/main:self-auto`}
              >
                <RotateCcw />
                Réinitialiser
              </Link>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Dates : jour de réception, bornes incluses. Une seule date suffit.
          </p>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
