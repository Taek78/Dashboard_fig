import type { Assignment, Courier } from "@/domain/deliveries/types";

/*
 * Données factices des livraisons. Déterministes, aucune personne réelle
 * (téléphones dans la tranche fictive 06 39 98 00 xx).
 *
 * Les attributions reprennent les créneaux exacts des commandes de
 * src/domain/orders/fixtures.ts (vérifié par test/domain/deliveries/fixtures.test.ts).
 * Scénario voulu pour la démo : le 2026-09-07 à 09:00, crs-0001 livre déjà cmd-0014 ;
 * attribuer cmd-0002 (même créneau) à crs-0001 doit être refusé, à crs-0002 accepté.
 */
export const couriersFixtures: readonly Courier[] = [
  {
    id: "crs-0001",
    name: "Karim Haddad",
    phone: "06 39 98 00 21",
    zone: "Paris",
  },
  {
    id: "crs-0002",
    name: "Léa Fontaine",
    phone: "06 39 98 00 22",
    zone: "Paris",
  },
  {
    id: "crs-0003",
    name: "Moussa Diallo",
    phone: "06 39 98 00 23",
    zone: "Petite couronne",
  },
];

export const assignmentsFixtures: readonly Assignment[] = [
  // 2026-09-06 (livrées)
  {
    orderId: "cmd-0007",
    courierId: "crs-0001",
    date: "2026-09-06",
    start: "09:00",
    end: "11:00",
  },
  {
    orderId: "cmd-0008",
    courierId: "crs-0001",
    date: "2026-09-06",
    start: "11:00",
    end: "13:00",
  },
  {
    orderId: "cmd-0005",
    courierId: "crs-0002",
    date: "2026-09-06",
    start: "14:00",
    end: "16:00",
  },
  // 2026-09-07 (en livraison)
  {
    orderId: "cmd-0014",
    courierId: "crs-0001",
    date: "2026-09-07",
    start: "09:00",
    end: "11:00",
  },
  {
    orderId: "cmd-0004",
    courierId: "crs-0002",
    date: "2026-09-07",
    start: "11:00",
    end: "13:00",
  },
];
