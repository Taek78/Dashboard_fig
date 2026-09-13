"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createArticle,
  deleteArticle,
  getArticle,
  updateArticle,
} from "@/data/articles";
import { getCurrentUser } from "@/data/session";
import {
  articleInputSchema,
  articleVisibilitySchema,
  deleteArticleSchema,
  updateArticleSchema,
} from "@/domain/articles/schemas";
import { canEditArticle } from "@/domain/auth/roles";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/lib/security-log";

/*
 * Server Actions des articles : rédiger, modifier, afficher/masquer, supprimer.
 * Même discipline que partout : session → rôle → zod → relecture → écriture →
 * revalidation. La suppression réussie REDIRIGE (redirect() lève : rien après).
 * La rédaction ne redirige pas : le formulaire reste sur la page de l'historique.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour publier des articles.",
  invalid:
    "Vérifiez la saisie : titre, texte, catégorie, date de parution et URL d'image https.",
  notFound: "Cet article n'existe plus.",
  confirm: "Confirmez la suppression avant de continuer.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

export async function addArticle(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditArticle(user.role)) {
    logSecurity({ type: "forbidden", userId: user.id, action: "addArticle" });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const input = articleInputSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  try {
    const created = await createArticle(input.data);
    revalidatePath("/articles", "layout");
    return {
      status: "success",
      message: `Article « ${created.title} » ${created.visible ? "publié" : "enregistré (masqué)"}.`,
    };
  } catch (error) {
    console.error("[addArticle]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function saveArticle(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditArticle(user.role)) {
    logSecurity({ type: "forbidden", userId: user.id, action: "saveArticle" });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const raw = Object.fromEntries(formData);
  const id = updateArticleSchema.safeParse(raw);
  const input = articleInputSchema.safeParse(raw);
  if (!id.success || !input.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  try {
    const article = await getArticle(id.data.articleId);
    if (!article) return { status: "error", message: MESSAGES.notFound };
    const updated = await updateArticle(article.id, input.data);
    if (!updated) return { status: "error", message: MESSAGES.notFound };
    revalidatePath("/articles", "layout");
    return {
      status: "success",
      message: `Article « ${updated.title} » enregistré.`,
    };
  } catch (error) {
    console.error(
      "[saveArticle]",
      { userId: user.id, articleId: id.data.articleId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function setArticleVisibility(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditArticle(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "setArticleVisibility",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = articleVisibilitySchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  try {
    const article = await getArticle(parsed.data.articleId);
    if (!article) return { status: "error", message: MESSAGES.notFound };
    const updated = await updateArticle(article.id, {
      title: article.title,
      body: article.body,
      category: article.category,
      illustration: article.illustration,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      visible: parsed.data.visible,
    });
    if (!updated) return { status: "error", message: MESSAGES.notFound };
    revalidatePath("/articles", "layout");
    return {
      status: "success",
      message: updated.visible
        ? `« ${updated.title} » est visible dans l'application.`
        : `« ${updated.title} » est masqué.`,
    };
  } catch (error) {
    console.error(
      "[setArticleVisibility]",
      { userId: user.id, articleId: parsed.data.articleId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function removeArticle(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditArticle(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "removeArticle",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = deleteArticleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.confirm };
  }

  try {
    const deleted = await deleteArticle(parsed.data.articleId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "article_deleted",
      userId: user.id,
      articleId: parsed.data.articleId,
    });
    revalidatePath("/articles", "layout");
  } catch (error) {
    console.error(
      "[removeArticle]",
      { userId: user.id, articleId: parsed.data.articleId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
  redirect("/articles?supprime=1");
}
