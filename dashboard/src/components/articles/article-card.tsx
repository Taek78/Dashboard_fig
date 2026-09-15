import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { ArticleVisibilityButton } from "@/components/articles/article-visibility-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from "@/domain/articles/category";
import {
  excerpt,
  PUBLICATION_STATE_LABELS,
  publicationState,
} from "@/domain/articles/rules";
import type { Article } from "@/domain/articles/types";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte horizontale d'un article (serveur) : l'illustration à gauche (image du
 * client ou emoji sur un fond teinté par catégorie), le titre en gras, la
 * catégorie, la date de parution, l'état (en ligne, programmé, masqué), un
 * extrait, puis les actions (modifier, afficher/masquer). Sur mobile,
 * l'illustration passe au-dessus. Un article masqué est estompé.
 * La table catégorie → couleur vit ici : le domaine ignore l'interface.
 */
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const TINT: Record<ArticleCategory, string> = {
  nutrition: "bg-success/15 text-success",
  recipe: "bg-warning/15 text-warning",
  science: "bg-info/15 text-info",
  news: "bg-primary/12 text-primary",
};

const CATEGORY_BADGE: Record<ArticleCategory, BadgeVariant> = {
  nutrition: "success",
  recipe: "warning",
  science: "secondary",
  news: "default",
};

export function ArticleCard({
  article,
  canEdit,
  today,
}: {
  article: Article;
  canEdit: boolean;
  today: string;
}) {
  const state = publicationState(article, today);

  return (
    <article
      aria-label={article.title}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 @xl/main:flex-row",
        state === "hidden" && "opacity-75",
      )}
    >
      <div
        className={cn(
          "relative flex h-36 shrink-0 items-center justify-center @xl/main:h-auto @xl/main:min-h-40 @xl/main:w-44",
          TINT[article.category],
        )}
      >
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 176px, 100vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-6xl drop-shadow-sm">
            {article.illustration}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 @2xl/main:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={CATEGORY_BADGE[article.category]}>
            {ARTICLE_CATEGORY_LABELS[article.category]}
          </Badge>
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Parution le </span>
            {formatDateFr(article.publishedAt)}
          </span>
          {state !== "published" ? (
            <Badge variant={state === "hidden" ? "outline" : "secondary"}>
              {PUBLICATION_STATE_LABELS[state]}
            </Badge>
          ) : null}
        </div>
        <h3 className="text-lg leading-snug font-bold">
          <Link
            href={`/articles/${article.id}`}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            {article.title}
          </Link>
        </h3>
        <p className="text-muted-foreground text-sm">{excerpt(article.body)}</p>
        {canEdit ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/articles/${article.id}`} />}
            >
              <Pencil />
              Modifier
            </Button>
            <ArticleVisibilityButton
              articleId={article.id}
              visible={article.visible}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
