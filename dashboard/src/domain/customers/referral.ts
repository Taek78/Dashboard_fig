import type { Customer } from "@/domain/customers/types";
import type { DateRange } from "@/lib/days";

/*
 * Parrainage (décision du client, 2026-09-16) : chaque client a un code
 * « Nom#0000 » (nom de famille, dièse, quatre chiffres), généré et attribué par
 * l'application FIG ; un nouveau client qui le saisit à l'inscription devient
 * son filleul (customers.referred_by_id). Le dashboard lit, n'attribue rien.
 * La contrainte customers_referral_code_format de la base dit la même règle.
 */
export const REFERRAL_CODE_PATTERN = /^[^#]+#\d{4}$/;

export function isReferralCode(value: string): boolean {
  return REFERRAL_CODE_PATTERN.test(value);
}

/**
 * Code de démonstration pour les fixtures : le nom de famille est tout ce qui
 * suit le prénom (« Chloé Da Silva » → « Da Silva#0010 »).
 */
export function referralCodeFor(fullName: string, n: number): string {
  const [, ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.length > 0 ? rest.join(" ") : fullName.trim();
  return `${lastName}#${String(n).padStart(4, "0")}`;
}

/* ---------- Métrique « Parrainages » ---------- */

/** Jour d'inscription "AAAA-MM-JJ" (UTC), même découpe que `(created_at at time zone 'UTC')::date`. */
export function signupDay(customer: Pick<Customer, "createdAt">): string {
  return customer.createdAt.slice(0, 10);
}

export type SignupStats = {
  /** Clients inscrits sur la période (jour d'inscription, bornes incluses). */
  signups: number;
  /** Parmi eux, ceux qui ont saisi le code d'un parrain. */
  referred: number;
};

/**
 * Nouveaux clients et parrainages d'une période : référence de la requête
 * agrégée getSignupStats (customers.db.ts), affichée par les métriques. Un
 * client anonymisé n'a plus de parrain (effacé avec ses données) : il compte
 * comme inscrit, plus comme parrainé.
 */
export function signupStats(
  customers: readonly Pick<Customer, "createdAt" | "referredBy">[],
  range: DateRange,
): SignupStats {
  let signups = 0;
  let referred = 0;
  for (const customer of customers) {
    const day = signupDay(customer);
    if (day < range.from || day > range.to) continue;
    signups += 1;
    if (customer.referredBy !== null) referred += 1;
  }
  return { signups, referred };
}
