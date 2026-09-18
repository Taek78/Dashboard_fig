import "server-only";
import { getCommunity } from "@/data/communities";
import { getCustomer, getCustomerReferrals } from "@/data/customers";
import { getDirectoryStats } from "@/data/orders";
import { getCatalogSettings, getProducts } from "@/data/products";
import type { ApiCustomer } from "@/domain/api/responses";
import type { AuthenticatedCustomer } from "@/domain/api/source";
import { customerView, type CustomerFacts } from "@/domain/api/views";
import { communityDiscountPercent } from "@/domain/communities/discount";
import type { Community } from "@/domain/communities/types";
import { loyaltyFromCount } from "@/domain/customers/loyalty";
import type { Customer } from "@/domain/customers/types";
import type { QuoteContext } from "@/domain/orders/quote";
import { ApiError } from "@/lib/api/errors";

/*
 * Lectures partagées par les routes des clients : la fiche complète avec ses
 * chiffres (fidélité, catégorie, communauté, filleuls), et le contexte d'un
 * devis (catalogue, paramètre de stock, fidélité prête, communauté et son
 * taux). Les chiffres viennent des agrégats de la base (getDirectoryStats
 * restreint à la personne ; les membres par communauté sur toute la base).
 */
export const accountClosed = () =>
  new ApiError(
    403,
    "account_closed",
    "Ce compte a été clôturé : ses données ont été effacées.",
  );

export async function customerFacts(
  customerId: string,
  communityId: string | null,
  now: Date,
): Promise<CustomerFacts> {
  const [stats, referrals] = await Promise.all([
    getDirectoryStats({ customerId }),
    getCustomerReferrals(customerId),
  ]);
  return {
    loyaltyCount: stats.loyaltyCounts.get(customerId) ?? 0,
    loyalSince: stats.loyalSince.get(customerId) ?? null,
    memberCount: communityId ? (stats.memberCounts.get(communityId) ?? 0) : 0,
    referralCount: referrals.length,
    now: now.toISOString(),
  };
}

export async function viewOf(
  customer: Customer,
  now: Date,
): Promise<ApiCustomer> {
  return customerView(
    customer,
    await customerFacts(customer.id, customer.community?.id ?? null, now),
  );
}

export async function loadMe(
  customerId: string,
  now: Date,
): Promise<ApiCustomer> {
  const customer = await getCustomer(customerId);
  if (!customer || customer.anonymizedAt !== null) throw accountClosed();
  return viewOf(customer, now);
}

export type OrderContext = QuoteContext & {
  /** La communauté complète (lieu de retrait), quand la personne en est membre et qu'elle est active. */
  communityDetails: Community | null;
};

export async function orderContextFor(
  customer: AuthenticatedCustomer,
): Promise<OrderContext> {
  const [products, settings, stats, community] = await Promise.all([
    getProducts(),
    getCatalogSettings(),
    getDirectoryStats({ customerId: customer.id }),
    customer.communityId ? getCommunity(customer.communityId) : null,
  ]);
  const active = community && community.active ? community : null;
  return {
    products,
    settings,
    loyaltyReady: loyaltyFromCount(stats.loyaltyCounts.get(customer.id) ?? 0)
      .rewardReady,
    community: active ? { id: active.id, name: active.name } : null,
    communityPercent: active
      ? communityDiscountPercent(stats.memberCounts.get(active.id) ?? 0)
      : 0,
    communityDetails: active,
  };
}
