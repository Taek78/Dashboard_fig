/*
 * Types métier des clients (A5) : le vocabulaire du FRONT, mappé sur le schéma du
 * client en B3. Les commandes d'un client se retrouvent par `customer.id` dans les
 * Order (croisement fait par la page, via OrderFilters.customerId).
 *
 * Les notes internes sont écrites par l'équipe du client et ne sont jamais
 * visibles de la personne concernée ; elles restent des données personnelles au
 * sens RGPD (question Q4 : où les stocker, tables `dashboard_*` ?).
 */
export type CustomerNote = {
  id: string;
  text: string;
  authorName: string;
  /** ISO 8601 */
  createdAt: string;
};

export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  postalCode: string;
  /** ISO 8601, date de création du compte */
  createdAt: string;
  notes: CustomerNote[];
};
