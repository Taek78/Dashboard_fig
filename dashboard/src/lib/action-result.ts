/*
 * Résultat renvoyé par toute Server Action au formulaire qui l'a appelée.
 *
 * Union discriminée sur `status` : après `if (result.status === "error")`, tsc
 * sait que `message` existe. Aucun import Next : ce fichier est chargé par les
 * composants "use client" (useActionState) et par les tests.
 *
 * Piège de lecture dans une action : `result.status` (ce type) et `order.status`
 * (OrderStatus) n'ont rien à voir.
 */
export type ActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/** État initial passé à useActionState : rien n'a encore été soumis. */
export const idleActionResult: ActionResult = { status: "idle" };
