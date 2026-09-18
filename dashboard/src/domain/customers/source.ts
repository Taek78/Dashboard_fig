import type { SignupStats } from "@/domain/customers/referral";
import type {
  CommunityMembershipOutcome,
  Customer,
  CustomerFilters,
  CustomerNote,
  CustomerProfilePatch,
  CustomerReferral,
} from "@/domain/customers/types";
import type { DateRange } from "@/lib/days";

/*
 * CONTRAT des clients, implémenté par PostgreSQL (src/data/customers.db.ts).
 * Types seulement. addNote reçoit la note complète (id exclu) : la date vient
 * de l'action (horloge du serveur), jamais du formulaire.
 * getCustomerReferrals : les filleuls d'un client (ceux qui ont saisi son code),
 * du plus ancien au plus récent ; lus par la fiche seulement, jamais par une
 * carte. getSignupStats : inscrits et parrainés d'une période, agrégés par la
 * base (métriques), même règle que signupStats du domaine.
 * API de l'application (2026-09-17) : findCustomerByEmail (sans casse) ;
 * updateCustomerProfile, écriture conditionnelle (jamais sur un client
 * anonymisé ; null sinon) ; setCustomerCommunity, adhésion ou départ, la base
 * vérifiant que la communauté est publique et active.
 */
export type CustomersSource = {
  getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  findCustomerByEmail(email: string): Promise<Customer | null>;
  updateCustomerProfile(
    id: string,
    patch: CustomerProfilePatch,
    now: Date,
  ): Promise<Customer | null>;
  setCustomerCommunity(
    id: string,
    communityId: string | null,
  ): Promise<CommunityMembershipOutcome>;
  getCustomerReferrals(customerId: string): Promise<CustomerReferral[]>;
  getSignupStats(range: DateRange): Promise<SignupStats>;
  addNote(
    customerId: string,
    note: Omit<CustomerNote, "id">,
  ): Promise<CustomerNote | null>;
};
