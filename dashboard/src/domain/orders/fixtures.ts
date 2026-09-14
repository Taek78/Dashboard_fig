import { generatedOrders } from "@/domain/orders/history";
import { scenarioOrders } from "@/domain/orders/scenario";
import { statusPath } from "@/domain/orders/status";
import type { Order, OrderActor, OrderEvent } from "@/domain/orders/types";

/*
 * Toutes les commandes factices : le scénario écrit à la main (scenario.ts)
 * plus l'historique généré sur deux ans (history.ts). Le mock, le seed et les
 * tests consomment ce module ; les tests qui raisonnent sur des valeurs
 * précises importent scenarioOrders.
 */
export { FIXTURE_TODAY, scenarioOrders } from "@/domain/orders/scenario";
export {
  HISTORY_FROM,
  HISTORY_TO,
  SCENARIO_WINDOW,
} from "@/domain/orders/history";

export const ordersFixtures: readonly Order[] = [
  ...scenarioOrders,
  ...generatedOrders,
];

/*
 * Historique factice : pour chaque commande déjà avancée, la suite des passages
 * de statut qui mène à son statut actuel, à 30 minutes d'intervalle après la
 * création, par un acteur d'équipe fictif. Déterministe, cohérent avec les
 * commandes ci-dessus (vérifié par test/domain/orders/fixtures.test.ts).
 */
const FIXTURE_ACTOR: OrderActor = { id: "usr-0000", name: "Équipe FIG" };
const STEP_MS = 30 * 60 * 1000;

export const orderEventsFixtures: readonly OrderEvent[] =
  ordersFixtures.flatMap((order) => {
    const path = statusPath(order.status);
    return path.slice(1).map((to, i) => ({
      id: `evt-${order.id}-${i + 1}`,
      orderId: order.id,
      from: path[i]!,
      to,
      actor: FIXTURE_ACTOR,
      cancellation: to === "cancelled" ? order.cancellation : null,
      at: new Date(
        Date.parse(order.createdAt) + (i + 1) * STEP_MS,
      ).toISOString(),
    }));
  });
