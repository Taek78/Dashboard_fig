import type { Community } from "@/domain/communities/types";

/*
 * Trois communautés factices, une par type et les deux visibilités, existantes dès le début de l'historique généré
 * (orders/history.ts leur rattache des clients et des commandes : onze, huit
 * et trois membres, pour couvrir les trois paliers de remise de
 * communities/discount.ts). Aucune personne ni établissement réels : noms
 * inventés, e-mails en @example.invalid, téléphones 06 39 98 80 xx, adresse
 * réduite à ville et code postal. Déterministe : dates fixes.
 */
export const communitiesFixtures: readonly Community[] = [
  {
    id: "com-0001",
    name: "Crèche Les Lucioles",
    kind: "point_relais",
    visibility: "public",
    contactName: "Marion Tessier",
    contactEmail: "contact.lucioles@example.invalid",
    contactPhone: "06 39 98 80 01",
    pickupPlace: "Hall d'accueil de la crèche",
    pickupCity: "Paris",
    pickupPostalCode: "75011",
    active: true,
    createdAt: "2025-01-10T09:00:00.000Z",
  },
  {
    id: "com-0002",
    name: "Voisins de la résidence Jules-Verne",
    kind: "voisinage",
    visibility: "private",
    contactName: "Hakim Zerrouki",
    contactEmail: "ape.julesverne@example.invalid",
    contactPhone: "06 39 98 80 02",
    pickupPlace: "Local à vélos de la résidence",
    pickupCity: "Montreuil",
    pickupPostalCode: "93100",
    active: true,
    createdAt: "2025-02-24T09:00:00.000Z",
  },
  {
    id: "com-0003",
    name: "Atelier Bricole & Co",
    kind: "entreprise",
    visibility: "private",
    contactName: "Élodie Rambert",
    contactEmail: "accueil.bricole@example.invalid",
    contactPhone: "06 39 98 80 03",
    pickupPlace: "Accueil de l'entreprise",
    pickupCity: "Pantin",
    pickupPostalCode: "93500",
    active: true,
    createdAt: "2025-06-02T09:00:00.000Z",
  },
];
