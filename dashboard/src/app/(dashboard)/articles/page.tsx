import type { Metadata } from "next";
import { CircleCheck, Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleForm } from "@/components/articles/article-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getArticles } from "@/data/articles";
import { getCurrentUser } from "@/data/session";
import { canEditArticle } from "@/domain/auth/roles";
import { todayInParis } from "@/domain/deliveries/rules";

/*
 * Articles « à lire » : la carte de rédaction en tête (titre,
 * texte, catégorie, date, illustration, visibilité), puis l'historique des
 * parutions du plus récent au plus ancien, en cartes horizontales. Modifier et
 * supprimer se font sur /articles/[id] ; afficher / masquer directement sur la
 * carte. ?supprime=1 confirme une suppression.
 */
export const metadata: Metadata = { title: "Articles" };

export default async function ArticlesPage({
  searchParams,
}: PageProps<"/articles">) {
  const raw = await searchParams;
  const justDeleted = raw.supprime === "1";
  const today = todayInParis(new Date());
  const [articles, user] = await Promise.all([getArticles(), getCurrentUser()]);
  const canEdit = canEditArticle(user.role);
  const visibleCount = articles.filter((a) => a.visible).length;

  return (
    <>
      <PageHeader
        title="Articles"
        description="Conseils d'alimentation, recettes, articles scientifiques et actualité agroalimentaire publiés dans l'application."
      />
      {justDeleted ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Article supprimé.
        </p>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Rédiger un article</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ArticleForm today={today} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">
          Votre compte est en lecture seule : les articles ne peuvent pas être
          modifiés.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Historique des parutions</h2>
          <p role="status" className="text-muted-foreground text-sm">
            {articles.length} article{articles.length > 1 ? "s" : ""},{" "}
            {visibleCount} visible{visibleCount > 1 ? "s" : ""}, du plus récent
            au plus ancien.
          </p>
        </div>
        {articles.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {articles.map((article) => (
              <li key={article.id}>
                <ArticleCard
                  article={article}
                  canEdit={canEdit}
                  today={today}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="bg-card/60 min-h-[30vh] rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
              >
                <Newspaper />
              </EmptyMedia>
              <EmptyTitle>Aucun article</EmptyTitle>
              <EmptyDescription>
                Le premier article rédigé ci-dessus apparaîtra ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </>
  );
}
