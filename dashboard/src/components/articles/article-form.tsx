"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { addArticle, saveArticle } from "@/app/(dashboard)/articles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  ARTICLE_ILLUSTRATIONS,
  DEFAULT_ARTICLE_ILLUSTRATION,
} from "@/domain/articles/category";
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type Article,
} from "@/domain/articles/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire d'article, rédaction ET modification (client : useActionState).
 * `article` absent → addArticle (le formulaire est vidé après succès, l'article
 * apparaît dans l'historique en dessous) ; présent → saveArticle.
 * Aucun état local : les champs sont non contrôlés, l'illustration choisie est
 * mise en valeur par le variant CSS has-checked. La validation est faite par
 * zod côté serveur.
 */
export function ArticleForm({
  article,
  today,
}: {
  article?: Article;
  /** Date de parution proposée pour un nouvel article (AAAA-MM-JJ). */
  today: string;
}) {
  const [result, formAction, pending] = useActionState(
    article ? saveArticle : addArticle,
    idleActionResult,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!article && result.status === "success") formRef.current?.reset();
  }, [article, result]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {article ? (
        <input type="hidden" name="articleId" value={article.id} />
      ) : null}
      {/* key : après un enregistrement, la fiche relue remonte les champs avec
          ses nouvelles valeurs par défaut (sinon Base UI avertit). */}
      <div key={article?.updatedAt ?? "nouveau"} className="contents">
        <div className="grid gap-4 @2xl/main:grid-cols-[1fr_14rem_11rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={TITLE_MAX_LENGTH}
              defaultValue={article?.title ?? ""}
              placeholder="Cinq fruits et légumes par jour : par où commencer ?"
              className="h-10 text-base font-semibold"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category">Catégorie</Label>
            <NativeSelect
              id="category"
              name="category"
              defaultValue={article?.category ?? "nutrition"}
              className="w-full"
            >
              {ARTICLE_CATEGORIES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {ARTICLE_CATEGORY_LABELS[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="publishedAt">Date de parution</Label>
            <Input
              id="publishedAt"
              name="publishedAt"
              type="date"
              required
              defaultValue={article?.publishedAt ?? today}
              className="dark:scheme-dark"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="body">Texte</Label>
          <textarea
            id="body"
            name="body"
            required
            maxLength={BODY_MAX_LENGTH}
            rows={article ? 12 : 8}
            defaultValue={article?.body ?? ""}
            placeholder="Le texte de l'article. Une ligne vide sépare deux paragraphes."
            aria-describedby="body-help"
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-3"
          />
          <p id="body-help" className="text-muted-foreground text-xs">
            Texte brut, {BODY_MAX_LENGTH.toLocaleString("fr-FR")} caractères au
            plus. Une ligne vide sépare deux paragraphes.
          </p>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold">Illustration</legend>
          <div
            role="radiogroup"
            aria-label="Choisir une illustration"
            className="flex flex-wrap gap-1"
          >
            {ARTICLE_ILLUSTRATIONS.map((emoji) => (
              <label
                key={emoji}
                className="has-checked:bg-primary/15 has-checked:ring-primary has-focus-visible:ring-ring hover:bg-muted flex size-10 cursor-pointer items-center justify-center rounded-lg text-2xl transition-colors has-checked:ring-2 has-focus-visible:ring-2"
              >
                <input
                  type="radio"
                  name="illustration"
                  value={emoji}
                  defaultChecked={
                    emoji ===
                    (article?.illustration ??
                      DEFAULT_ARTICLE_ILLUSTRATION.nutrition)
                  }
                  className="sr-only"
                />
                <span aria-hidden="true">{emoji}</span>
                <span className="sr-only">{emoji}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="imageUrl">
              Image d&apos;illustration (URL https, optionnelle)
            </Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              inputMode="url"
              maxLength={500}
              defaultValue={article?.imageUrl ?? ""}
              placeholder="https://…/illustration.jpg"
            />
          </div>
        </fieldset>

        <Label
          htmlFor="visible"
          className="bg-muted/40 cursor-pointer self-start rounded-lg border px-3 py-2"
        >
          <input
            id="visible"
            name="visible"
            type="checkbox"
            defaultChecked={article?.visible ?? true}
            className="accent-primary size-4"
          />
          Visible dans l&apos;application
        </Label>
      </div>

      <div className="flex flex-col gap-3 @xl/main:flex-row @xl/main:items-center">
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
          ) : article ? (
            "Enregistrer les modifications"
          ) : (
            "Publier l'article"
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
