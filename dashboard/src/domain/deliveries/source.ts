import type { Assignment, Courier } from "@/domain/deliveries/types";

/*
 * CONTRAT des livraisons : mock aujourd'hui (src/data/deliveries.mock.ts),
 * Drizzle en B3 (src/data/deliveries.db.ts). Types seulement.
 *
 * assignOrder remplace l'attribution existante de la commande (une commande n'a
 * qu'un livreur) : c'est un « upsert » par orderId. La règle de conflit n'est PAS
 * ici : elle appartient à la Server Action.
 */
export type DeliveriesSource = {
  getCouriers(): Promise<Courier[]>;
  getAssignments(date?: string): Promise<Assignment[]>;
  assignOrder(assignment: Assignment): Promise<Assignment>;
};
