import { ordersFixtures } from "@/domain/orders/fixtures";
import type { OrdersSource } from "@/domain/orders/source";

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
 *   - Async + latence simulée dès maintenant : la vraie base sera async, et le
 *     skeleton de loading.tsx devient visible.
 *   - structuredClone à chaque sortie : un composant qui modifierait un objet reçu
 *     ne doit jamais toucher les fixtures partagées par tout le serveur.
 *   - A2 : Map mutable seedée depuis ordersFixtures + updateOrderStatus,
 *     resetOrdersMock() HORS contrat (réservé aux tests).
 */
export const MOCK_LATENCY_MS = 400;
//Simulation de latence pour les appels au mock, pour que le skeleton de loading.tsx soit visible. 400ms = 1/2 seconde.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); //attente à l'extérieur pour éviter la duplication de code dans getOrders et getOrder
export const ordersMock: OrdersSource = {
  getOrders: async () => {
    await sleep(MOCK_LATENCY_MS);
    return structuredClone([...ordersFixtures]);
  },

  getOrder: async (id: string) => {
    await sleep(MOCK_LATENCY_MS);
    const order = ordersFixtures.find((order) => order.id === id);
    return order ? structuredClone(order) : null;
  },
};
