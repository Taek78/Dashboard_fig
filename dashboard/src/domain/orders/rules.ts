import type { OrderLine } from "@/domain/orders/types";

/*
 * Logique pure des commandes.
 *
 * Pourquoi un fichier séparé des composants et de la source de données : aucune
 * dépendance à Next, à la base ni au navigateur, donc testable avec Vitest en
 * quelques millisecondes et réutilisable par le mock comme par la version Drizzle.
 * Les composants et les Server Actions ne font que brancher ces fonctions.
 *
 * Chaque fonction RENVOIE une valeur : elle ne modifie rien. L'appelant stocke ou
 * compare le résultat.
 */

/** Somme des totaux de ligne. Pas de règle prix × quantité : elle dépend du client. */
export function computeOrderTotalCents(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.lineTotalCents, 0);
}
