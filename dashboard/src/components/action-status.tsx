import { CircleAlert, CircleCheck } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Message de résultat d'une Server Action sous un formulaire : vert en
 * succès, rouge en erreur, vide au repos (le <p> reste pour ne pas faire
 * sauter la mise en page). `role` : status par défaut ; alert quand seul
 * l'échec s'affiche (connexion). Sans hook : utilisable dans un composant
 * client comme serveur.
 */
export function ActionStatus({
  result,
  role = "status",
  className,
}: {
  result: ActionResult;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <p
      role={role}
      className={cn(
        "flex items-start gap-1.5 text-sm",
        result.status === "success" && "text-success",
        result.status === "error" && "text-destructive",
        className,
      )}
    >
      {result.status === "success" ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      {result.status === "error" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      {result.status === "idle" ? null : <span>{result.message}</span>}
    </p>
  );
}
