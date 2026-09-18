/*
 * Aides des tests de l'API (projet « db » de Vitest et parcours Playwright) :
 * construction de requêtes, lecture des réponses, ouverture d'une session par
 * le vrai parcours (code par mail capturé, puis jeton). Les mocks (base de
 * test, environnement, mail, journal, after) restent déclarés dans chaque
 * fichier de test : vi.mock y est hissé.
 */
export const API_IP = "203.0.113.77";

export type StoredMail = {
  kind?: string;
  to: string;
  subject: string;
  text: string;
};

export type RequestOptions = {
  body?: unknown;
  rawBody?: string;
  token?: string;
  headers?: Record<string, string>;
  ip?: string;
};

export function apiRequest(
  method: string,
  path: string,
  options: RequestOptions = {},
): Request {
  const headers: Record<string, string> = {
    "x-forwarded-for": options.ip ?? API_IP,
    ...options.headers,
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    headers["content-type"] ??= "application/json";
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["content-type"] ??= "application/json";
  }
  return new Request(`http://localhost:3126${path}`, { method, headers, body });
}

/** Un fichier à téléverser : nom, type annoncé, octets. */
export type UploadFile = { name: string; type: string; bytes: Uint8Array };

/**
 * Requête multipart/form-data comme l'enverrait l'application (champ
 * « fichier » par défaut), avec son Content-Length : le corps est sérialisé
 * d'abord, puisque la route refuse un téléversement sans longueur annoncée.
 */
export async function uploadRequest(
  path: string,
  options: {
    token?: string;
    files?: UploadFile[];
    field?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Request> {
  const form = new FormData();
  for (const file of options.files ?? []) {
    form.append(
      options.field ?? "fichier",
      new File([new Uint8Array(file.bytes)], file.name, { type: file.type }),
    );
  }
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const headers: Record<string, string> = {
    "x-forwarded-for": API_IP,
    "content-type": encoded.headers.get("content-type") ?? "",
    "content-length": String(body.length),
    ...options.headers,
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  return new Request(`http://localhost:3126${path}`, {
    method: "POST",
    headers,
    body,
  });
}

export async function readJson<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  return (await response.json()) as T;
}

/** Le code à six chiffres d'un mail de connexion. */
export function codeIn(mail: StoredMail): string {
  const match = mail.text.match(/^\s*(\d{6})\s*$/m);
  if (!match) throw new Error("Aucun code dans le mail.");
  return match[1]!;
}

export const params = <P>(value: P) => ({ params: Promise.resolve(value) });

/** Le secret de session des tests (même valeur que la suite navigateur). */
export const TEST_AUTH_SECRET = "e2e-secret-fig-dashboard-0123456789-abcdef";

/**
 * Ouvre une session directement en base pour un client seedé (sans passer par
 * le code par mail, déjà couvert par auth.test.ts) et renvoie son jeton.
 * Importé après les vi.mock du fichier : la base est celle du test.
 */
export async function sessionTokenFor(
  customerId: string,
  secret = TEST_AUTH_SECRET,
): Promise<string> {
  const { openSession } = await import("@/data/api-auth");
  const { generateLinkToken, hashSecret } = await import("@/lib/secrets");
  const token = generateLinkToken();
  await openSession(customerId, hashSecret(token, secret), new Date());
  return token;
}

/** Un jour de livraison réservable : demain, en heure de Paris. */
export async function tomorrowInParis(): Promise<string> {
  const { todayInParis } = await import("@/domain/deliveries/rules");
  const { addDays } = await import("@/lib/days");
  return addDays(todayInParis(new Date()), 1);
}
