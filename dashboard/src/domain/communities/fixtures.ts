import type { Community } from "@/domain/communities/types";

/*
 * Trois communautés factices, existantes dès le début de l'historique généré
 * (orders/history.ts leur rattache des clients et des commandes). Aucune
 * personne ni établissement réels : noms inventés, e-mails en
 * @example.invalid, téléphones 06 39 98 80 xx, adresse réduite à ville et code
 * postal. Déterministe : dates fixes.
 */
export const communitiesFixtures: readonly Community[] = [
  {
    id: "com-0001",
    name: "Crèche Les Lucioles",
    kind: "creche",
    contactName: "Marion Tessier",
    contactEmail: "contact.lucioles@example.invalid",
    contactPhone: "06 39 98 80 01",
    pickupPlace: "Hall d'accueil de la crèche",
    pickupCity: "Paris",
    pickupPostalCode: "75011",
    pickupTime: "17:00",
    discountPercent: 10,
    active: true,
    createdAt: "2025-01-10T09:00:00.000Z",
  },
  {
    id: "com-0002",
    name: "École Jules-Verne (parents d'élèves)",
    kind: "ecole",
    contactName: "Hakim Zerrouki",
    contactEmail: "ape.julesverne@example.invalid",
    contactPhone: "06 39 98 80 02",
    pickupPlace: "Préau, à la sortie des classes",
    pickupCity: "Montreuil",
    pickupPostalCode: "93100",
    pickupTime: "16:30",
    discountPercent: 8,
    active: true,
    createdAt: "2025-02-24T09:00:00.000Z",
  },
  {
    id: "com-0003",
    name: "Atelier Bricole & Co",
    kind: "entreprise",
    contactName: "Élodie Rambert",
    contactEmail: "accueil.bricole@example.invalid",
    contactPhone: "06 39 98 80 03",
    pickupPlace: "Accueil de l'entreprise",
    pickupCity: "Pantin",
    pickupPostalCode: "93500",
    pickupTime: "12:30",
    discountPercent: 12,
    active: true,
    createdAt: "2025-06-02T09:00:00.000Z",
  },
];
