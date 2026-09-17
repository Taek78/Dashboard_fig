import { LoaderCircle, Search } from "lucide-react";
import { NativeInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * Barre de recherche d'une section (serveur) : l'intitulé, puis un grand champ
 * avec une loupe, remplacée par un indicateur pendant la recherche (aria-busy
 * posé par AutoSubmitForm sur le formulaire). Les recherches des commandes,
 * des messages, du catalogue, des clients et de l'équipe ont exactement la
 * même barre : une seule définition.
 */
export function SearchField({
  id = "q",
  name = "q",
  label,
  placeholder,
  maxLength,
  defaultValue,
}: {
  id?: string;
  name?: string;
  label: string;
  placeholder: string;
  maxLength?: number;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
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
          id={id}
          name={name}
          type="search"
          maxLength={maxLength}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          className="h-11 pl-10 text-base"
        />
      </div>
    </div>
  );
}
