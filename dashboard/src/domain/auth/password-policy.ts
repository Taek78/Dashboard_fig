import { COMMON_PASSWORDS } from "@/domain/auth/common-passwords";
import {
  PASSPHRASE_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/domain/auth/types";
import { normalize } from "@/lib/text";

/*
 * Politique de mots de passe (décision du client, 2026-09-17), règles PURES,
 * partagées par le serveur (zod puis actions, avec en plus la vérification
 * contre les fuites, src/data/passwords.ts) et par la jauge des formulaires
 * (navigateur : ce module n'importe ni zod ni rien de Next).
 *
 * Le choix : la LONGUEUR d'abord. Une phrase de passe de 16 caractères ou plus
 * (quatre mots, espaces acceptés) n'a aucune contrainte de composition ; un
 * mot plus court, de 12 à 15 caractères, doit mêler au moins trois types de
 * caractères. Dans tous les cas : ni mot courant des fuites (racine sans ses
 * chiffres et signes de fin), ni nom ni e-mail de la personne, ni motif
 * répété, ni suite de clavier ou d'alphabet. Jamais d'expiration forcée.
 */
export type PasswordProblem =
  | "too_short"
  | "too_long"
  | "common"
  | "personal"
  | "repetitive"
  | "sequence"
  | "weak_mix"
  | "breached";

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  too_short: `${PASSWORD_MIN_LENGTH} caractères au moins.`,
  too_long: `${PASSWORD_MAX_LENGTH} caractères au plus.`,
  common:
    "Ce mot de passe est trop courant : il figure dans les listes des attaquants.",
  personal: "Il ne doit contenir ni votre nom ni votre adresse e-mail.",
  repetitive: "Un même motif répété ne protège pas.",
  sequence: "Une suite de clavier, d'alphabet ou de chiffres ne protège pas.",
  weak_mix: `Sous ${PASSPHRASE_LENGTH} caractères, mêlez au moins trois types : minuscules, majuscules, chiffres, signes.`,
  breached:
    "Ce mot de passe apparaît dans des fuites de données connues : choisissez-en un autre.",
};

/** Conseil affiché sous le champ tant que rien n'est saisi. */
export const PASSWORD_ADVICE = `Le plus sûr et le plus simple à retenir : une phrase de quatre mots ou plus (${PASSPHRASE_LENGTH} caractères). Sinon ${PASSWORD_MIN_LENGTH} caractères mêlant lettres, chiffres et signes.`;

/** Ce que la règle « personnel » compare au mot de passe : nom et e-mail du compte. */
export type PasswordContext = { email?: string; name?: string };

const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "azertyuiop",
  "qsdfghjklm",
  "wxcvbn",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];
const SEQUENCE_RUN = 8;
const MIN_PERSONAL_TOKEN = 3;

/** Racine d'un mot de passe : normalisé, sans signes en tête ni chiffres et signes en fin. */
function stem(password: string): string {
  return normalize(password)
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z]+$/, "");
}

/** Nombre de types de caractères présents : minuscules, majuscules, chiffres, autres. */
export function characterClasses(password: string): number {
  return [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((re) =>
    re.test(password),
  ).length;
}

function isCommon(password: string): boolean {
  const norm = normalize(password);
  const root = stem(password);
  const compact = root.replace(/[\s._-]+/g, "");
  return (
    COMMON_PASSWORDS.has(norm) ||
    COMMON_PASSWORDS.has(root) ||
    COMMON_PASSWORDS.has(compact)
  );
}

function personalTokens({ email, name }: PasswordContext): string[] {
  const tokens: string[] = [];
  if (name) tokens.push(...normalize(name).split(/[\s'-]+/));
  if (email) {
    const local = normalize(email.split("@")[0] ?? "");
    tokens.push(local, ...local.split(/[._+-]+/));
  }
  return tokens.filter((t) => t.length >= MIN_PERSONAL_TOKEN);
}

function isPersonal(password: string, context: PasswordContext): boolean {
  const haystack = normalize(password).replace(/[\s._-]+/g, "");
  return personalTokens(context).some((token) => haystack.includes(token));
}

function isRepetitive(password: string): boolean {
  return /^(.{1,4})\1+$/.test(normalize(password));
}

function hasSequence(password: string): boolean {
  const text = normalize(password).replace(/\s+/g, "");
  if (text.length < SEQUENCE_RUN) return false;
  const known = SEQUENCES.flatMap((s) => [s, [...s].reverse().join("")]);
  for (let i = 0; i + SEQUENCE_RUN <= text.length; i++) {
    const window = text.slice(i, i + SEQUENCE_RUN);
    if (known.some((s) => s.includes(window))) return true;
  }
  return false;
}

/** Tous les problèmes d'un mot de passe, dans l'ordre d'affichage ; vide = accepté. */
export function passwordProblems(
  password: string,
  context: PasswordContext = {},
): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push("too_short");
  if (password.length > PASSWORD_MAX_LENGTH) problems.push("too_long");
  if (isCommon(password)) problems.push("common");
  if (isPersonal(password, context)) problems.push("personal");
  if (isRepetitive(password)) problems.push("repetitive");
  if (hasSequence(password)) problems.push("sequence");
  if (
    password.length < PASSPHRASE_LENGTH &&
    characterClasses(password) < 3 &&
    password.length >= PASSWORD_MIN_LENGTH
  ) {
    problems.push("weak_mix");
  }
  return problems;
}

export function firstPasswordProblem(
  password: string,
  context: PasswordContext = {},
): PasswordProblem | null {
  return passwordProblems(password, context)[0] ?? null;
}

/*
 * Jauge à cinq niveaux pour les formulaires : 0 trop court, 1 refusé (un
 * problème), 2 accepté, 3 fort (phrase de passe), 4 très fort. Le niveau ne
 * remplace pas la règle : le serveur refuse tout ce qui est sous 2.
 */
export type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  problem: PasswordProblem | null;
};

export const STRENGTH_LABELS: Record<PasswordStrength["level"], string> = {
  0: "Trop court",
  1: "Refusé",
  2: "Correct",
  3: "Fort",
  4: "Très fort",
};

export function passwordStrength(
  password: string,
  context: PasswordContext = {},
): PasswordStrength {
  const problem = firstPasswordProblem(password, context);
  let level: PasswordStrength["level"];
  if (problem === "too_short") level = 0;
  else if (problem) level = 1;
  else if (password.length >= 20 && characterClasses(password) >= 3) level = 4;
  else if (password.length >= 24) level = 4;
  else if (password.length >= PASSPHRASE_LENGTH) level = 3;
  else level = 2;
  return { level, label: STRENGTH_LABELS[level], problem };
}
