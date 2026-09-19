import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleForm } from "@/components/articles/article-form";
import { DeleteArticleButton } from "@/components/articles/delete-article-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getArticle } from "@/data/articles";
import { getCurrentUser } from "@/data/session";
import { ARTICLE_CATEGORY_LABELS } from "@/domain/articles/category";
import { articleIdSchema } from "@/domain/articles/schemas";
import { canEditArticle } from "@/domain/auth/roles";
import { todayInParis } from "@/domain/deliveries/rules";
import { formatDateFr } from "@/lib/format";

/*
 * Fiche d'un article : l'aperçu tel qu'il apparaît dans l'historique, le
 * formulaire complet, puis la zone de suppression. Le rôle lecture voit
 * l'aperçu seulement (l'action revérifie de toute façon).
 */
export const metadata: Metadata = { title: "Article" };

export default async function ArticlePage({
  params,
}: PageProps<"/articles/[id]">) {
  const { id } = await params;
  const parsed = articleIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const [article, user] = await Promise.all([
    getArticle(parsed.data),
    getCurrentUser(),
  ]);
  if (!article) notFound();
  const canEdit = canEditArticle(user.role);
  const today = todayInParis(new Date());

  return (
    <>
      <PageHeader
        title={article.title}
        description={`${ARTICLE_CATEGORY_LABELS[article.category]} · parution le ${formatDateFr(article.publishedAt)} · modifié le ${formatDateFr(article.updatedAt)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/articles" />}
          >
            <ArrowLeft />
            Retour aux articles
          </Button>
        }
      />
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Aperçu</h2>
        <ArticleCard article={article} canEdit={false} today={today} />
      </div>
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Modifier l&apos;article</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <ArticleForm article={article} today={today} />
            <div className="border-t pt-6">
              <DeleteArticleButton
                articleId={article.id}
                articleTitle={article.title}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">
          Votre compte est en lecture seule : l&apos;article ne peut pas être
          modifié.
        </p>
      )}
    </>
  );
}
