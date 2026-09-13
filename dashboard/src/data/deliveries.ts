import "server-only";
import { selectSource } from "@/data/select-source";
import type { DeliveriesSource } from "@/domain/deliveries/source";
import { deliveriesMock } from "@/data/deliveries.mock";

/*
 * FAÇADE des livraisons : le seul module que le front importe pour lire ou écrire
 * une attribution. Même rôle que src/data/orders.ts : `source` n'est pas exporté,
 * une seule ligne change au branchement (B3 : deliveriesDb).
 */
// B1 : choix par DATA_SOURCE. La version Drizzle (B3) remplacera le null.
const source: DeliveriesSource = selectSource(
  "livraisons",
  deliveriesMock,
  null,
);

export const getCouriers: DeliveriesSource["getCouriers"] = () =>
  source.getCouriers();
export const getAssignments: DeliveriesSource["getAssignments"] = (date) =>
  source.getAssignments(date);
export const assignOrder: DeliveriesSource["assignOrder"] = (assignment) =>
  source.assignOrder(assignment);
