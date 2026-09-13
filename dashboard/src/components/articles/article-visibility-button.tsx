"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { setArticleVisibility } from "@/app/(dashboard)/articles/actions";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/action-result";

/*
 * Bouton afficher / masquer d'un article (client : useActionState). Un mini
 * formulaire par carte ; la valeur envoyée est l'inverse de l'état courant, et
 * l'action relit l'article avant d'écrire. Seule une erreur s'affiche : le
 * succès se voit sur la carte re-rendue (badge « Masqué », estompage).
 */
export function ArticleVisibilityButton({
  articleId,
  visible,
}: {
  articleId: string;
  visible: boolean;
}) {
  const [result, formAction, pending] = useActionState(
    setArticleVisibility,
    idleActionResult,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="visible" value={visible ? "0" : "1"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : visible ? (
          <EyeOff />
        ) : (
          <Eye />
        )}
        {visible ? "Masquer" : "Rendre visible"}
      </Button>
      <p role="status" className="text-destructive text-xs">
        {result.status === "error" ? result.message : null}
      </p>
    </form>
  );
}
