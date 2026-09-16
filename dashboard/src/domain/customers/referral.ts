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
