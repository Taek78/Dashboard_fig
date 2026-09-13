/*
 * Types métier des livraisons : le vocabulaire du FRONT (A3).
 *
 * Un livreur (Courier) et une attribution (Assignment) qui relie une commande à
 * un livreur pour un créneau. Le créneau est COPIÉ depuis la commande au moment
 * de l'attribution : la règle « pas deux fois le même créneau » se vérifie alors
 * sur les seules attributions du jour, sans recharger les commandes.
 *
 * Ces types ne sont pas le schéma du client (question Q7 : créneaux, zones,
 * livreurs y sont peut-être modélisés autrement) : ils seront mappés en B3.
 */
export type Courier = {
  id: string;
  name: string;
  phone: string;
  /** Secteur habituel, informatif seulement en A3 (aucune règle dessus). */
  zone: string;
};

export type Assignment = {
  orderId: string;
  courierId: string;
  /** Copie de deliverySlot de la commande : "AAAA-MM-JJ", "HH:mm". */
  date: string;
  start: string;
  end: string;
};
