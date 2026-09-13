import Form from "next/form";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * Moteur de recherche des clients (serveur, formulaire GET via next/form).
 * C'est l'écran d'accueil de la section : aucune liste n'est chargée tant que
 * l'utilisateur n'a pas cherché ou demandé « tous ». Le champ est large et
 * explicite (icône, aide, exemples) ; « Afficher tous les clients » est un lien
 * vers ?tous=1, pas un second formulaire.
 */
export function CustomersSearch({ query }: { query: string | undefined }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form
          action="/clients"
          aria-label="Recherche de clients"
          className="flex flex-col gap-3"
        >
          <Label htmlFor="q" className="text-base">
            Rechercher un client
          </Label>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="q"
                name="q"
                type="search"
                autoFocus
                placeholder="Nom, e-mail ou numéro de téléphone"
                defaultValue={query ?? ""}
                aria-describedby="q-help"
                className="h-11 pl-10 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="md:w-40">
              <Search />
              Rechercher
            </Button>
          </div>
          <p id="q-help" className="text-muted-foreground text-sm">
            Une partie suffit : « benali », « rocher@ », ou les derniers
            chiffres d&apos;un téléphone « 00 07 ». Accents et majuscules sont
            ignorés.
          </p>
        </Form>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground text-sm">
            Vous ne cherchez personne en particulier ?
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/clients?tous=1" />}
          >
            <Users />
            Afficher tous les clients
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
