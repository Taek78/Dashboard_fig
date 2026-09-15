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
  DIRECTORY_SORT_LABELS,
  DIRECTORY_SORTS,
  DIRECTORY_TYPE_LABELS,
  DIRECTORY_TYPES,
} from "@/domain/customers/directory";
import type { ClientsSearch } from "@/domain/customers/schemas";

/*
 * Recherche commune de la section Clients (serveur ; AutoSubmitForm, client,
 * la lance pendant la saisie) : un seul champ pour les particuliers ET les
 * communautés, un filtre de type et un tri. Les champs deviennent l'URL
 * (?q=&type=&tri=) : partageable, retour arrière gratuit ; une nouvelle
 * recherche revient en page 1.
 */
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
                placeholder="Nom, e-mail, téléphone, ville, communauté…"
                defaultValue={search.query ?? ""}
                aria-describedby="q-help"
                className="h-11 pl-10 text-base"
              />
            </div>
            <p
              id="q-help"
              className="text-muted-foreground text-sm @max-2xl/main:hidden"
            >
              Les résultats se mettent à jour pendant la saisie. Une partie
              suffit : « benali », « lucioles », « montreuil » ou les derniers
              chiffres d&apos;un téléphone « 00 07 ». Accents et majuscules sont
              ignorés.
            </p>
          </div>

          <div className="grid gap-3 border-t pt-4 @xl/main:grid-cols-[1fr_1fr_auto] @xl/main:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="type">Afficher</Label>
              <NativeSelect
                id="type"
                name="type"
                defaultValue={search.type}
                className="w-full"
              >
                {DIRECTORY_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {DIRECTORY_TYPE_LABELS[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tri">Trier par</Label>
              <NativeSelect
                id="tri"
                name="tri"
                defaultValue={search.sort}
                className="w-full"
              >
                {DIRECTORY_SORTS.map((sort) => (
                  <NativeSelectOption key={sort} value={sort}>
                    {DIRECTORY_SORT_LABELS[sort]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
