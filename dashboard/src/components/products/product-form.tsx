"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { addProduct, saveProduct } from "@/app/(dashboard)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CONTAINER_LABELS,
  CONTAINERS,
  DEFAULT_ILLUSTRATION,
  ILLUSTRATIONS,
  ORIGIN_COUNTRIES,
  ORIGIN_COUNTRY_CODES,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type Illustration,
  type ProductCategory,
} from "@/domain/products/category";
import { centsToEurosInput } from "@/domain/products/rules";
import type { Product, ProductUnit } from "@/domain/products/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire produit, création ET modification (client : useActionState).
 * Un seul composant, deux actions : `product` absent → addProduct (redirige vers
 * la fiche créée), présent → saveProduct.
 *
 * Trois états locaux seulement, pour adapter l'écran sans recharger : la
 * catégorie (teinte de l'aperçu, illustration par défaut), l'unité (le poids
 * moyen ne s'affiche que pour une pièce) et l'illustration choisie. Tout le
 * reste est non contrôlé : la validation est faite par zod côté serveur.
 */
type ProductFormProps = { product?: Product };

const field = "grid gap-1.5";

export function ProductForm({ product }: ProductFormProps) {
  const [result, formAction, pending] = useActionState(
    product ? saveProduct : addProduct,
    idleActionResult,
  );
  const [category, setCategory] = useState<ProductCategory>(
    product?.category ?? "vegetable",
  );
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? "g");
  const [illustration, setIllustration] = useState<Illustration>(
    product?.illustration ?? DEFAULT_ILLUSTRATION.vegetable,
  );
  const isFruit = category === "fruit";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {product ? (
        <input type="hidden" name="productId" value={product.id} />
      ) : null}
      {/* key : après un enregistrement, la fiche relue remonte les champs avec
          ses nouvelles valeurs par défaut (sinon Base UI avertit) ; le formulaire
          et son message de résultat, eux, restent en place. */}
      <div key={product?.updatedAt ?? "nouveau"} className="contents">
        {/* Identité */}
        <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Identité</legend>
          <div className={field}>
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              defaultValue={product?.name ?? ""}
              placeholder="Pommes"
            />
          </div>
          <div className={field}>
            <Label htmlFor="variety">Variété</Label>
            <Input
              id="variety"
              name="variety"
              maxLength={80}
              defaultValue={product?.variety ?? ""}
              placeholder="Gala"
            />
          </div>
          <div className={field}>
            <Label htmlFor="category">Catégorie</Label>
            <NativeSelect
              id="category"
              name="category"
              value={category}
              onChange={(e) => {
                const next = e.target.value as ProductCategory;
                setCategory(next);
                if (!product) setIllustration(DEFAULT_ILLUSTRATION[next]);
              }}
              className="w-full"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {PRODUCT_CATEGORY_LABELS[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className={field}>
            <Label htmlFor="container">Contenant</Label>
            <NativeSelect
              id="container"
              name="container"
              defaultValue={product?.container ?? "none"}
              className="w-full"
            >
              {CONTAINERS.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {CONTAINER_LABELS[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </fieldset>

        {/* Prix et stock */}
        <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Prix et stock</legend>
          <div className={field}>
            <Label htmlFor="unit">Vendu</Label>
            <NativeSelect
              id="unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductUnit)}
              className="w-full"
            >
              <NativeSelectOption value="g">au kilo</NativeSelectOption>
              <NativeSelectOption value="piece">à la pièce</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className={field}>
            <Label htmlFor="priceEuros">
              Prix (€ {unit === "g" ? "le kg" : "la pièce"})
            </Label>
            <Input
              id="priceEuros"
              name="priceEuros"
              inputMode="decimal"
              required
              defaultValue={
                product ? centsToEurosInput(product.priceCents) : ""
              }
              placeholder="3,50"
              aria-describedby="priceEuros-help"
            />
            <p id="priceEuros-help" className="text-muted-foreground text-xs">
              Deux décimales maximum.
              {unit === "piece"
                ? " Le prix au kilo se déduit du poids moyen ci-contre."
                : ""}
            </p>
          </div>
          {unit === "piece" ? (
            <div className={field}>
              <Label htmlFor="unitWeightGrams">
                Poids moyen d&apos;une pièce (g)
              </Label>
              <Input
                id="unitWeightGrams"
                name="unitWeightGrams"
                type="number"
                min={1}
                step={1}
                defaultValue={product?.unitWeightGrams ?? ""}
                placeholder="180"
              />
            </div>
          ) : (
            <input type="hidden" name="unitWeightGrams" value="" />
          )}
          <div className={field}>
            <Label htmlFor="stockQuantity">
              Stock ({unit === "g" ? "grammes" : "pièces"})
            </Label>
            <Input
              id="stockQuantity"
              name="stockQuantity"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={product?.stockQuantity ?? 0}
            />
          </div>
        </fieldset>

        {/* Origine et calibre */}
        <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">
            Origine et calibre
          </legend>
          <div className={field}>
            <Label htmlFor="originCountry">Pays</Label>
            <NativeSelect
              id="originCountry"
              name="originCountry"
              defaultValue={product?.originCountry ?? "FR"}
              className="w-full"
            >
              {ORIGIN_COUNTRY_CODES.map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {ORIGIN_COUNTRIES[code]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className={field}>
            <Label htmlFor="originRegion">Région ou provenance</Label>
            <Input
              id="originRegion"
              name="originRegion"
              maxLength={80}
              defaultValue={product?.originRegion ?? ""}
              placeholder="Val de Loire"
            />
          </div>
          <div className={field}>
            <Label htmlFor="caliberMin">Calibre minimum (mm)</Label>
            <Input
              id="caliberMin"
              name="caliberMin"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.caliber?.minMm ?? ""}
              placeholder="70"
            />
          </div>
          <div className={field}>
            <Label htmlFor="caliberMax">Calibre maximum (mm)</Label>
            <Input
              id="caliberMax"
              name="caliberMax"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.caliber?.maxMm ?? ""}
              placeholder="80"
            />
          </div>
        </fieldset>

        {/* Illustration */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Illustration</legend>
          <div className="flex flex-col gap-4 @2xl/main:flex-row">
            <div
              aria-hidden="true"
              className={cn(
                "flex size-28 shrink-0 items-center justify-center rounded-2xl text-6xl",
                isFruit
                  ? "bg-fruit text-fruit-foreground"
                  : "bg-vegetable text-vegetable-foreground",
              )}
            >
              {illustration}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div
                role="radiogroup"
                aria-label="Choisir une illustration"
                className="flex flex-wrap gap-1"
              >
                {ILLUSTRATIONS.map((emoji) => (
                  <label
                    key={emoji}
                    className={cn(
                      "has-focus-visible:ring-ring flex size-9 cursor-pointer items-center justify-center rounded-lg text-xl transition-colors has-focus-visible:ring-2",
                      emoji === illustration
                        ? "bg-primary/15 ring-primary ring-2"
                        : "hover:bg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="illustration"
                      value={emoji}
                      checked={emoji === illustration}
                      onChange={() => setIllustration(emoji)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">{emoji}</span>
                    <span className="sr-only">{emoji}</span>
                  </label>
                ))}
              </div>
              <div className={field}>
                <Label htmlFor="imageUrl">
                  Image du produit (URL https, optionnelle)
                </Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  inputMode="url"
                  maxLength={500}
                  defaultValue={product?.imageUrl ?? ""}
                  placeholder="https://…/pommes.jpg"
                />
                <p className="text-muted-foreground text-xs">
                  Si une image est renseignée, elle remplace l&apos;illustration
                  sur la carte.
                </p>
              </div>
            </div>
          </div>
        </fieldset>

        {/* Statut */}
        <fieldset className="grid gap-3 @xl/main:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Statut</legend>
          {(
            [
              [
                "visible",
                "Visible dans l'application",
                product?.visible ?? true,
              ],
              [
                "available",
                "Disponible à la vente",
                product?.available ?? true,
              ],
              ["inSeason", "De saison", product?.inSeason ?? false],
              ["organic", "Agriculture biologique", product?.organic ?? false],
            ] as const
          ).map(([name, label, checked]) => (
            <Label
              key={name}
              htmlFor={name}
              className="bg-muted/40 cursor-pointer rounded-lg border px-3 py-2"
            >
              <input
                id={name}
                name={name}
                type="checkbox"
                defaultChecked={checked}
                className="accent-primary size-4"
              />
              {label}
            </Label>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="brand"
          disabled={pending}
          size="lg"
          className="w-full @xl/main:w-auto"
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Enregistrement…
            </>
          ) : product ? (
            "Enregistrer les modifications"
          ) : (
            "Créer le produit"
          )}
        </Button>
        <p
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-sm",
            result.status === "success" && "text-success",
            result.status === "error" && "text-destructive",
          )}
        >
          {result.status === "success" ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          ) : null}
          {result.status === "error" ? (
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          ) : null}
          {result.status === "idle" ? null : result.message}
        </p>
      </div>
    </form>
  );
}
