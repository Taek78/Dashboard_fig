import { ordersFixtures } from "@/domain/orders/fixtures";
import { filterOrders, sortOrdersBySlot } from "@/domain/orders/rules";
import type { OrdersSource } from "@/domain/orders/source";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order, OrderFilters } from "@/domain/orders/types";

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
 *     redémarrage du serveur, c'est voulu.
 *   - Async + latence simulée : la vraie base sera async, et le skeleton de
 *     loading.tsx devient visible.
 *   - structuredClone à l'entrée (le store ne partage aucun objet avec les
 *     fixtures que les tests lisent) et à la sortie (un composant qui modifierait
 *     un objet reçu ne doit jamais toucher le store partagé par tout le serveur).
 *   - updateOrderStatus est une mise à jour CONDITIONNELLE : null si l'id est absent
 *     ou si le statut a changé entre la lecture et l'écriture (`from` ne correspond
 *     plus). C'est le `UPDATE … WHERE id = $1 AND status = $2` que fera la base en
 *     B5. La règle métier canTransition n'est PAS appliquée ici : elle appartient à
 *     la Server Action, seul endroit qui décide.
 *   - resetOrdersMock() est HORS contrat : réservée aux tests, jamais réexportée
 *     par la façade.
 */
const store = new Map<string, Order>();

function seed(): void {
  store.clear();
  for (const order of ordersFixtures) {
    store.set(order.id, structuredClone(order));
  }
}

seed();

/** Latence simulée pour que le skeleton de loading.tsx soit visible. */
export const MOCK_LATENCY_MS = 400;

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

  updateOrderStatus: async (id: string, from: OrderStatus, to: OrderStatus) => {
    await sleep(MOCK_LATENCY_MS);
    const current = store.get(id);
    if (!current || current.status !== from) return null;
    current.status = to;
    return structuredClone(current);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement (beforeEach). */
export function resetOrdersMock(): void {
  seed();
}
