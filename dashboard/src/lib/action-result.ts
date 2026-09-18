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
  /**
   * L'essentiel a réussi, mais une suite n'a pas eu lieu et la personne doit
   * le savoir : le compte est créé, son invitation n'est pas partie. Ni vert
   * (ce serait mentir), ni rouge (rien n'est à refaire depuis le début) :
   * ambre, avec le geste qui répare.
   */
  | { status: "warning"; message: string }
  | { status: "error"; message: string };

/** État initial passé à useActionState : rien n'a encore été soumis. */
export const idleActionResult: ActionResult = { status: "idle" };
