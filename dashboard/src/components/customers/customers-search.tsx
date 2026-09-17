import Link from "next/link";
import {
  LayoutGrid,
  LoaderCircle,
  RotateCcw,
  Search,
  User,
  Users,
} from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SortOrderToggle } from "@/components/sort-order-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DEFAULT_DIRECTORY_ORDER,
  DIRECTORY_SORT_SCALES,
  DIRECTORY_TYPE_DESCRIPTIONS,
  DIRECTORY_TYPE_LABELS,
  DIRECTORY_TYPES,
  SORT_ORDER_LABELS,
  sortOptions,
  type DirectoryType,
} from "@/domain/customers/directory";
import type { ClientsSearch } from "@/domain/customers/schemas";
import { cn } from "@/lib/utils";

/*
 * Recherche commune de la section Clients (serveur ; AutoSubmitForm, client,
 * la lance pendant la saisie) : un seul champ pour les particuliers ET les
 * communautés, un COMMUTATEUR de type à trois positions (particuliers,
 * communautés, tous), chacune dans sa couleur (tokens --individual,
 * --community, marque pour « tous »), et un tri en deux gestes : le critère
 * dans la liste, le sens par le bouton à côté (SortOrderToggle : flèche qui
 * pivote, A / Z pour le nom, 1 / 9 pour les nombres). Les champs deviennent
 * l'URL (?q=&type=&tri=&sens=) :
 * partageable, retour arrière gratuit ; une nouvelle recherche revient en
 * page 1.
 *
 * Le commutateur est un groupe de boutons radio natifs (un par position, le
 * bouton visible est l'étiquette) : accessible au clavier, coché = envoyé
 * aussitôt par AutoSubmitForm, sans JavaScript dédié. Le tri par membres
 * n'apparaît qu'en position « communautés ».
 */
const TYPE_ICONS: Record<DirectoryType, typeof User> = {
  tous: LayoutGrid,
  particuliers: User,
  communautes: Users,
};

const TYPE_CHECKED: Record<DirectoryType, string> = {
  tous: "has-checked:bg-primary/15 has-checked:text-primary has-checked:ring-primary/40",
  particuliers:
    "has-checked:bg-individual/15 has-checked:text-individual has-checked:ring-individual/40",
  communautes:
    "has-checked:bg-community/15 has-checked:text-community has-checked:ring-community/40",
};

export function CustomersSearch({
  search,
  canReset,
}: {
  search: ClientsSearch;
  canReset: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/clients"
          aria-label="Recherche de clients"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="q" className="text-base">
              Rechercher un client ou une communauté
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
                maxLength={64}
                placeholder="Nom, e-mail, téléphone, ville, communauté, code de parrainage…"
                defaultValue={search.query ?? ""}
                className="h-11 pl-10 text-base"
              />
            </div>
          </div>

          <div className="grid gap-4 border-t pt-4 @2xl/main:grid-cols-[auto_1fr_auto] @2xl/main:items-end">
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium">Afficher</legend>
              <div
                className="bg-muted/60 inline-flex w-fit gap-1 rounded-xl p-1"
                role="radiogroup"
                aria-label="Afficher"
              >
                {DIRECTORY_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <label
                      key={type}
                      title={DIRECTORY_TYPE_DESCRIPTIONS[type]}
                      className={cn(
                        "text-muted-foreground has-focus-visible:ring-ring relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors select-none has-checked:font-semibold has-checked:shadow-sm has-checked:ring-1 has-focus-visible:ring-2",
                        TYPE_CHECKED[type],
                      )}
                    >
                      {/* Le bouton radio natif couvre toute l'étiquette, invisible
                          mais bien là : clic, clavier et lecteurs d'écran passent
                          par lui, l'étiquette ne fait que l'habiller. */}
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        defaultChecked={search.type === type}
                        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                      />
                      <Icon aria-hidden="true" className="size-4" />
                      {DIRECTORY_TYPE_LABELS[type]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-1.5">
              <Label htmlFor="tri">Trier par</Label>
              <div className="flex min-w-0 items-center gap-2">
                <NativeSelect
                  id="tri"
                  name="tri"
                  defaultValue={search.sort}
                  className="min-w-0 flex-1"
                >
                  {sortOptions(search.type).map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <SortOrderToggle
                  selectId="tri"
                  sort={search.sort}
                  order={search.order}
                  naturalOrders={DEFAULT_DIRECTORY_ORDER}
                  scales={DIRECTORY_SORT_SCALES}
                  labels={SORT_ORDER_LABELS}
                />
              </div>
            </div>
            {canReset ? (
              <Link
                href="/clients"
                className={`${buttonVariants({ variant: "ghost", size: "sm" })} justify-self-start`}
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
