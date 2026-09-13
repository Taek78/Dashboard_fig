import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { filterOrders, sortOrdersBySlot } from "@/domain/orders/rules";
import type { OrdersSource } from "@/domain/orders/source";
import type {
  Order,
  OrderEvent,
  OrderFilters,
  StatusChange,
} from "@/domain/orders/types";

/*
 * Implémentation FIXTURES du contrat OrdersSource (le « groupe électrogène » avant
 * le branchement au réseau : la version Drizzle viendra à côté, dans orders.db.ts).
 *
 * Pourquoi ce fichier est séparé de la façade orders.ts :
 *   - Seul src/data/orders.ts a le droit de l'importer (plus les tests). Une page qui
 *     l'importerait directement continuerait d'afficher des fixtures après le
 *     branchement. Vérif : `grep -rn "orders.mock" src` → une seule ligne.
 *   - Il n'importe rien de "next/*", "server-only" ni "@/lib/env" : Vitest doit
 *     pouvoir le charger pour tester le comportement du mock.
 *   - L'annotation `: OrdersSource` fait refuser par tsc toute méthode manquante ou
 *     mal typée, à la déclaration et non au premier appel.
 *
 * Choix d'implémentation :
 *   - Une Map en mémoire (id → commande), seedée depuis les fixtures au chargement
 *     du module : c'est la « table » mutable. Elle repart des fixtures à chaque
 *     redémarrage du serveur, c'est voulu. Une seconde Map porte l'historique
 *     (id de commande → événements), seedée depuis orderEventsFixtures.
 *   - Async + latence simulée : la vraie base sera async, et le skeleton de
 *     loading.tsx devient visible.
 *   - structuredClone à l'entrée (le store ne partage aucun objet avec les
 *     fixtures que les tests lisent) et à la sortie (un composant qui modifierait
 *     un objet reçu ne doit jamais toucher le store partagé par tout le serveur).
 *   - updateOrderStatus est une mise à jour CONDITIONNELLE : null si l'id est absent
 *     ou si le statut a changé entre la lecture et l'écriture (`from` ne correspond
 *     plus). C'est le `UPDATE … WHERE id = $1 AND status = $2` que fera la base en
 *     B5. Quand elle réussit, elle ajoute l'événement d'historique (en base : la
 *     même transaction). La règle métier canTransition n'est PAS appliquée ici :
 *     elle appartient à la Server Action, seul endroit qui décide.
 *   - L'horodatage des nouveaux événements est fixe (MOCK_EVENT_AT) pour rester
 *     déterministe sous Vitest ; la vraie base mettra now().
 *   - resetOrdersMock() est HORS contrat : réservée aux tests, jamais réexportée
 *     par la façade.
 */
const store = new Map<string, Order>();
const events = new Map<string, OrderEvent[]>();
let eventCounter = 0;

function seed(): void {
  store.clear();
  events.clear();
  eventCounter = 0;
  for (const order of ordersFixtures) {
    store.set(order.id, structuredClone(order));
  }
  for (const event of orderEventsFixtures) {
    const list = events.get(event.orderId) ?? [];
    list.push(structuredClone(event));
    events.set(event.orderId, list);
  }
}

seed();

/** Latence simulée pour que le skeleton de loading.tsx soit visible. */
export const MOCK_LATENCY_MS = 400;
export const MOCK_EVENT_AT = "2026-09-13T12:00:00.000Z";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ordersMock: OrdersSource = {
  getOrders: async (filters: OrderFilters = {}) => {
    await sleep(MOCK_LATENCY_MS);
    const all = [...store.values()];
    const result = sortOrdersBySlot(filterOrders(all, filters));
    return structuredClone(result);
  },

  getOrder: async (id: string) => {
    await sleep(MOCK_LATENCY_MS);
    const order = store.get(id);
    return order ? structuredClone(order) : null;
  },

  updateOrderStatus: async (id: string, change: StatusChange) => {
    await sleep(MOCK_LATENCY_MS);
    const current = store.get(id);
    if (!current || current.status !== change.from) return null;
    current.status = change.to;
    current.cancellation =
      change.to === "cancelled" ? structuredClone(change.cancellation) : null;
    eventCounter += 1;
    const list = events.get(id) ?? [];
    list.push({
      id: `evt-m-${eventCounter}`,
      orderId: id,
      from: change.from,
      to: change.to,
      actor: structuredClone(change.actor),
      cancellation: structuredClone(change.cancellation),
      at: MOCK_EVENT_AT,
    });
    events.set(id, list);
    return structuredClone(current);
  },

  getOrderEvents: async (orderId: string) => {
    await sleep(MOCK_LATENCY_MS);
    const list = events.get(orderId) ?? [];
    return structuredClone(list.toSorted((a, b) => b.at.localeCompare(a.at)));
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement (beforeEach). */
export function resetOrdersMock(): void {
  seed();
}
