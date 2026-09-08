# Jalon A1 : couche de branchement, session mock, simulation, validation, fixtures

Rédigé par `security-backend-architect` le 2026-09-07 sur le brief B du tech lead (pivot « frontend d'abord »). Zaki code ; ce document dit quoi faire et pourquoi.

Arbitrages du tech lead sur ce rapport : le paquet `cn` de `package.json` est légitime (installé par shadcn v4, réexporté par `src/lib/utils.ts`), on ne le retire pas ; `readSimulationMode` vit dans `src/lib/simulation.ts` et non `src/domain/dev/`. Tout le reste est retenu.

## Faits vérifiés

| Fait | Source |
|---|---|
| `src/` ne contient que `app/layout.tsx`, `app/page.tsx`, `components/ui/button.tsx`, `lib/utils.ts`. A1 part d'une page blanche | `find dashboard/src` |
| `.env.example` porte toujours un `AUTH_SECRET` de 32 caractères qui passerait `min(32)` | `dashboard/.env.example:3` |
| Une Server Action est un POST public : « treat every action as an untrusted entry point ». Next vérifie `Origin` vs `Host`, plafonne le corps à 1 Mo, chiffre les identifiants d'action. Le reste (auth, validation, forme du retour) est à la charge de l'application | doc locale `server-actions.md` |
| Une vérification d'auth dans la page ne couvre pas l'action : « Always re-verify inside the action » | `data-security.md` |
| Les valeurs de retour d'une action sont sérialisées vers le client : « Only return what the UI needs, not raw database records » | `data-security.md` |
| `searchParams` est une `Promise<{ [key: string]: string \| string[] \| undefined }>` | `page.md` |
| Avec `useActionState`, l'action reçoit `(prevState, formData)` | `forms.md` |
| `revalidatePath` dans une Server Function met l'UI à jour dans la même réponse | `revalidatePath.md` |
| `import "server-only"` : installation optionnelle, Next le gère | `05-server-and-client-components.md` |
| `NODE_ENV` : `next dev` → `development`, toute autre commande → `production` ; Turbopack fige `NODE_ENV` à la compilation | `environment-variables.md`, `08-turbopack.md` |
| zod 4.5.4 : `z.enum(readonly)` accepte un tuple `as const` ; `z.iso.date()` ; `.catch()`, `.optional()` ; `z.discriminatedUnion` ; `z.flattenError(err)` remplace `err.flatten()` | types zod v4 |
| postgres.js : « No connection will be made until a query is made » | `postgres/README.md` |
| Vitest ne connaît pas `server-only` : un fichier testé ne doit ni l'importer ni importer un module qui l'importe | `vitest.config.mts` |

## 1. Couche de branchement (A1.3)

### Décisions

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| a | Forme du contrat | Objet de fonctions typé par annotation : `export const ordersMock: OrdersSource = { getOrders, getOrder }`. La façade réexporte avec le type extrait du contrat : `export const getOrders: OrdersSource["getOrders"] = (f) => source.getOrders(f)` | Une méthode manquante ou une signature fausse casse `tsc` à la déclaration, avant tout appel. `satisfies` marcherait mais l'annotation est plus lisible et élargit le type au contrat, ce qui empêche la façade de fuir des détails d'implémentation |
| a′ | Limite du typage structurel | Le mapper `toOrder(row): Order` (B3) déclare son type de retour et construit un objet littéral champ par champ, jamais `return row` ni `{ ...row }` | TypeScript accepte un objet qui a plus de champs que `Order` : `tsc` ne refuserait pas une ligne Drizzle avec 30 colonnes renvoyée comme `Order`. Seul l'objet littéral déclenche le contrôle des propriétés excédentaires. Test : `toOrder` sur une ligne factice enrichie d'un champ `secret`, `Object.keys` ne doit pas le contenir |
| b | `getOrders(filters?)` | À partir de A2. En A1 : `getOrders(): Promise<Order[]>` | Un paramètre accepté mais ignoré est un mensonge d'API. En A2 le mock applique `filterOrders(orders, filters)` pur dans `rules.ts` ; en B3 la version db traduit en `WHERE` |
| c | Mock mutable A2 | `updateOrderStatus(id, from, to): Promise<Order \| null>` ; `null` si id inconnu ou si le statut courant n'est plus `from`. Le mock renvoie une copie (`structuredClone`), jamais la référence interne | `null` pour « introuvable » est un résultat métier normal, pas une panne ; avec `strict`, `tsc` force l'appelant à le traiter, un `throw` s'oublie. Le paramètre `from` prépare la mise à jour conditionnelle de B3 (`UPDATE … WHERE id = $1 AND status = $2 RETURNING` → 0 ligne → `null`) : même contrat, aucune reprise de l'action |
| c′ | Reset et latence | `orders.mock.ts` exporte aussi `resetOrdersMock(): void` et `MOCK_LATENCY_MS = 400`. `resetOrdersMock` n'est pas dans `OrdersSource` et n'est réexporté par aucune façade | Les tests du mock ont besoin d'un état propre ; l'UI n'a jamais à remettre à zéro. Hors contrat, cette fonction n'existera jamais en version db |
| d | `DATA_SOURCE` (B1) | `z.discriminatedUnion("DATA_SOURCE", [mock, db])`, sans valeur par défaut ; `.env.example` contient `DATA_SOURCE=mock` | Avec `refine`, le type reste `DATABASE_URL?: string` et `client.ts` finit par écrire `env.DATABASE_URL!`. Avec l'union discriminée, `env.DATABASE_URL` n'est `string` que dans la branche `db` : `tsc` impose le `if`. Pas de défaut : un serveur de prod où on a oublié la variable ne doit pas servir des fixtures en silence |
| d′ | Client db paresseux | Amender le 1.4 du socle : remplacer `export const db` par `export function getDb()` qui vérifie `env.DATA_SOURCE === "db"` (sinon `throw`), construit le pool une fois (`globalThis` en dev) et le renvoie. `orders.db.ts` appelle `getDb()` dans chaque fonction | La façade importe statiquement `ordersMock` et `ordersDb` et choisit avec `env.DATA_SOURCE`. Rien n'est construit tant qu'on ne lit pas la base |
| e | Façade `server-only` + tests sur le mock | Cohérent, à trois conditions : `orders.mock.ts`, `fixtures.ts`, `rules.ts` n'importent que depuis `@/domain/**` ; seul `src/data/orders.ts` importe `orders.mock.ts` ; `grep -rn "orders.mock" src --include=*.tsx` vide | Même coupe que `env-schema.ts` (pur, testé) / `env.ts` (effet, `server-only`) |

### Signatures

```ts
// src/domain/orders/source.ts
export type OrderFilters = { status?: OrderStatus; date?: string }; // A2
export type OrdersSource = {
  getOrders(filters?: OrderFilters): Promise<Order[]>;             // A1 sans filters
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, from: OrderStatus, to: OrderStatus): Promise<Order | null>; // A2
};
```

```ts
// src/lib/env-schema.ts (B1)
const dbUrl = z.url({ protocol: /^postgres(ql)?$/ });
export const envSchema = z.discriminatedUnion("DATA_SOURCE", [
  z.object({ DATA_SOURCE: z.literal("mock"), DATABASE_URL: dbUrl.optional() }),
  z.object({ DATA_SOURCE: z.literal("db"), DATABASE_URL: dbUrl }),
]);
```

Cas de test B1 : `mock` sans `DATABASE_URL` → passe ; `db` sans `DATABASE_URL` → lève ; `DATA_SOURCE` absent → lève ; `DATA_SOURCE=prod` → lève. `AUTH_SECRET` reste hors schéma jusqu'à A7 : on ajoute une clé quand la fonctionnalité qui la consomme arrive.

### Risques

| Fichier | Scénario | Gravité | Correction |
|---|---|---|---|
| `src/data/orders.ts` | Un futur `orders.db.ts` renvoie `rows` bruts ; `tsc` accepte car `Order` est un sous-ensemble ; toutes les colonnes de la table du client partent dans le payload | haute (B3) | `toOrder` avec type de retour explicite et objet littéral ; test `Object.keys` |
| `src/lib/env-schema.ts` | `DATA_SOURCE` avec défaut `mock` : le déploiement oublie la variable, l'équipe du client « change des statuts » sur des fixtures | haute (B1) | Pas de défaut |
| Tout `.tsx` | Import direct de `@/data/orders.mock` (autocomplétion) contourne la façade | moyenne | Grep de vérification ; option : règle ESLint `no-restricted-imports` (à valider) |

## 2. `src/data/session.ts` (A1.3)

| Élément | Décision |
|---|---|
| Rôles | `src/domain/auth/roles.ts` : `export const ROLES = ["admin", "gestionnaire", "lecture"] as const; export type Role = (typeof ROLES)[number];` et `canChangeOrderStatus(role: Role): boolean` (pur, testé sur les trois rôles) |
| Type | `export type CurrentUser = { id: string; name: string; role: Role }` dans `src/domain/auth/types.ts`. A7 gardera exactement ce type en sortie de `verifySession()` |
| Fichier | `src/data/session.ts` : `import "server-only"` ligne 1 ; `export async function getCurrentUser(): Promise<CurrentUser>` |
| Garde | Fonction pure `assertMockSessionAllowed(nodeEnv: string \| undefined): void` dans `src/domain/auth/guards.ts`, appelée en première ligne de `getCurrentUser` avec `process.env.NODE_ENV` |
| Rôle du mock | `gestionnaire` par défaut, pas `admin` : c'est le rôle qui exerce le chemin nominal de A2 sans masquer les refus |

Garde en liste blanche, pour éviter l'inversion :

```ts
export function assertMockSessionAllowed(nodeEnv: string | undefined): void {
  const allowed = nodeEnv === "development" || nodeEnv === "test";
  if (!allowed) throw new Error("Session mock interdite hors development/test");
}
```

Tests : `"development"` et `"test"` → ne lève pas ; `"production"`, `undefined`, `"staging"` → lève. La liste blanche est plus stricte que « si production alors throw » : un runtime où `NODE_ENV` vaut autre chose tombe du bon côté. Le booléen porte un nom positif (`allowed`) : impossible de l'inverser sans que le nom devienne faux.

**Pourquoi un stub qui plante en prod vaut mieux qu'un stub silencieux.** Un stub silencieux fait de chaque visiteur anonyme un `gestionnaire`. Le dashboard a l'air de marcher, on le montre au client, on l'héberge « juste pour la démo » et une URL circule. Un stub qui lève transforme l'oubli en panne visible au premier `next start`. La frontière de confiance doit échouer bruyamment, jamais par défaut ouvert.

Risque associé : `next dev` lancé sur une machine publique → tout le monde est gestionnaire. Gravité critique si cela arrive ; parade procédurale : jamais `next dev` ailleurs que sur un poste de dev. À écrire dans le README.

## 3. Simulation dev (A1.3 / A1.6)

`src/lib/simulation.ts`, pur, sans import Next :

```ts
export type SimulationMode = "vide" | "erreur";
export function readSimulationMode(
  raw: string | string[] | undefined, isDev: boolean,
): SimulationMode | null;
```

Règles : `isDev === false` → `null` quoi qu'il arrive (vérifié en premier) ; tableau → `null` ; `"vide"` → `"vide"` ; `"erreur"` → `"erreur"` ; autre chaîne, `""`, `undefined` → `null`. Six cas de test, dont `("erreur", false) → null`.

Appel dans la page : `const mode = readSimulationMode((await searchParams).simuler, process.env.NODE_ENV === "development");` puis la page substitue `[]` ou lève une `Error` avant d'appeler la source. La source ne connaît pas la simulation.

**Audit : `?simuler=erreur` en production.** Cela marcherait si : la page passe `true` en dur ou calcule `process.env.NODE_ENV !== "production"` (une valeur inattendue devient « dev ») ; le serveur tourne avec `next dev` ; un composant client calcule `isDev` dans le navigateur. Conséquence : n'importe qui force la page d'erreur, ou un lien `?simuler=vide` envoyé à une gestionnaire lui montre « aucune commande » et des livraisons partent en retard. Gravité moyenne. Vérification à inscrire dans A1.6 : `npm run build && npm run start`, puis `curl -s "localhost:3000/commandes?simuler=vide" | grep -c "Aucune commande"` → `0`. Turbopack fige `NODE_ENV` à la compilation : exporter `NODE_ENV=development` avant `next start` ne réactive pas la simulation.

**Tranche : `NODE_ENV` suffit pour A1.** Une variable dédiée ajouterait un interrupteur que Zaki n'activera jamais. On réévalue si un environnement de recette partagé apparaît.

## 4. Validation zod dès A2, sur fixtures

### Schémas (`src/domain/orders/schemas.ts`)

| Schéma | Provenance | Sur valeur invalide | Pourquoi |
|---|---|---|---|
| `orderFiltersSchema` | `searchParams` (lecture) | Champ par champ : `status: z.enum(ORDER_STATUSES).optional().catch(undefined)`, `date: z.iso.date().optional().catch(undefined)` → filtre ignoré | Un marque-page périmé ne doit pas casser la page. C'est une lecture : ignorer est sans danger. Les `string[]` passent d'abord par un helper pur `firstParam(v)` |
| `changeStatusSchema` | `FormData` (écriture) | `z.object({ orderId: z.string().trim().min(1).max(64), nextStatus: z.enum(ORDER_STATUSES) })` → erreur, rien n'est écrit | Une écriture ne s'interprète jamais « au mieux ». `max(64)` borne l'entrée tant que le format d'id client est inconnu. Pas de `.strict()` : `z.object` retire les clés inconnues |

### Action (`src/app/(dashboard)/commandes/actions.ts`, `"use server"`)

```ts
export async function changeOrderStatus(
  _prev: ActionResult, formData: FormData,
): Promise<ActionResult>;
```

Ordre imposé, chaque échec renvoie un `ActionResult` d'erreur générique :

1. `const user = await getCurrentUser()` puis `canChangeOrderStatus(user.role)` : un `lecture` est refusé avant même de lire le formulaire.
2. `changeStatusSchema.safeParse(Object.fromEntries(formData))`.
3. `const order = await getOrder(parsed.data.orderId)` ; `null` → erreur.
4. `canTransition(order.status, parsed.data.nextStatus)` (pur, `rules.ts`, testé sur toute la matrice) ; `false` → erreur.
5. `await updateOrderStatus(order.id, order.status, parsed.data.nextStatus)` ; `null` → erreur « modifiée entre-temps ».
6. `revalidatePath("/commandes", "layout")`.
7. `return { status: "success", message: "Statut mis à jour." }`.

L'autorisation vient avant le parsing : un appelant non autorisé ne doit rien apprendre, pas même si un id existe.

```ts
// src/lib/action-result.ts
export type ActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };
export const idleActionResult: ActionResult = { status: "idle" };
```

`idle` est l'état initial de `useActionState`. `fieldErrors` vient de `z.flattenError(parsed.error).fieldErrors` : messages de forme, sans la valeur reçue.

**Pourquoi l'action relit la commande au lieu de croire le statut envoyé.** Le formulaire est du HTML dans le navigateur : un champ caché `currentStatus` se modifie dans l'inspecteur. Si l'action calculait `canTransition(formulaire.currentStatus, next)`, on pourrait faire passer une commande de `preparing` à `delivered` en prétendant qu'elle était `delivering`. Même sans malveillance, un onglet ouvert depuis une heure porte un statut périmé. La machine d'états juge la vérité serveur, et le paramètre `from` de `updateOrderStatus` verrouille cette vérité jusqu'à l'écriture.

Messages : un texte générique par famille (« Impossible de modifier cette commande. », « Vous n'avez pas les droits pour cette action. »), détail dans `console.error("[changeOrderStatus]", { userId, orderId, step, reason })`. Jamais de message zod brut, jamais `error.message` d'une exception, jamais de nom ou d'email dans le log.

### Risques

| Fichier | Scénario | Gravité | Correction |
|---|---|---|---|
| `actions.ts` | Avant A7, tout POST est « gestionnaire ». Acceptable sur un poste de dev, critique ailleurs | critique hors poste dev | La garde de session fait échouer l'action en prod ; A7 avant tout hébergement |
| `actions.ts` | L'action oublie l'étape 1 parce que la page vérifie déjà le rôle : un `lecture` rejoue le POST capturé | haute | Étape 1 obligatoire |
| `actions.ts` | `try/catch` global qui avale un futur `redirect()` (fonctionne par exception) | moyenne | Pas de `redirect` dans le `try` |
| `rules.ts` | `canTransition` écrite « tout est permis sauf… » : un nouveau statut devient joignable de partout | moyenne | Matrice en liste blanche `Record<OrderStatus, readonly OrderStatus[]>` ; `tsc` exige une entrée par statut |

## 5. Fixtures et données personnelles (A1.2)

| Règle | Valeur | Pourquoi |
|---|---|---|
| Noms | Liste fixe de prénoms/noms inventés, pas ceux de l'équipe ni de vrais clients | Une fixture est publique dès le premier `push` |
| Emails | `prenom.nom@example.invalid` | TLD réservé (RFC 2606) : jamais résolu |
| Téléphones | `06 39 98 00 01`, `06 39 98 00 02`, … | Tranche réservée par l'ARCEP à la fiction |
| Adresses | Ville + code postal uniquement (`"75011 Paris"`) | Une rue est une donnée personnelle |
| Déterminisme | Interdits : `Math.random`, `Date.now`, `new Date()`. Dates ISO 8601 dérivées de `FIXTURE_TODAY = "2026-09-07"` | Deux `npm run dev` doivent afficher la même liste |
| Ids | `cmd-0001`, `cmd-0002`, … | Lisibles dans l'URL, stables dans les tests |
| Vérification | `fixtures.test.ts` : chaque email finit par `@example.invalid`, chaque téléphone commence par `06 39 98`, aucun champ `street` ; `grep -n "Math.random\|Date.now\|new Date(" src/domain/orders/fixtures.ts` vide | Trois lignes qui survivent aux ajouts |

**Risque OneDrive.** Le dépôt est sous `OneDrive` : tout fichier posé dans l'arborescence est copié dans le cloud Microsoft, `.gitignore` ou pas. Scénario : le client envoie un dump réel, Zaki le décompresse dans `dashboard/dumps/` ; les données de tous les clients finaux de FIG sont chez un tiers, hors de tout accord. Gravité haute (incident RGPD). Parade : dumps hors OneDrive (`C:/dev-data/`), `dumps/`, `*.sql`, `*.sql.gz`, `*.dump` dans `.gitignore`, et demander d'abord un `pg_dump --schema-only`.

## 6. `docs/branchements.md` (A1.7)

Gabarit à copier ; il devient le cahier des charges du `drizzle-kit pull` (B2/B3).

```markdown
# Branchements : ce que le front attend, ce que la base devra fournir

## Fonctions de la source `OrdersSource`

| Fonction | Entrées | Sortie | Implémentation actuelle | Requête cible (B3) |
|---|---|---|---|---|
| `getOrders` | `filters?: OrderFilters` | `Order[]` triées par `createdAt` desc | `orders.mock.ts` + `filterOrders` pur | `SELECT … WHERE … ORDER BY … LIMIT` |
| `getOrder` | `id: string` | `Order \| null` | `Map.get` + clone | `SELECT … WHERE id = $1` |
| `updateOrderStatus` | `id, from, to` | `Order \| null` | `Map` : `null` si absent ou `status !== from` | `UPDATE … SET status = $3 WHERE id = $1 AND status = $2 RETURNING …` |

## Champs du type `Order`

| Type.champ | Type TS | Unité / format | Colonne client | Conversion dans `toOrder` |
|---|---|---|---|---|
| `Order.id` | `string` | opaque | inconnue | `String(row.id)` si entier |
| `Order.status` | `OrderStatus` | valeur de `ORDER_STATUSES` | inconnue | table de correspondance, `throw` si valeur inconnue |
| `Order.createdAt` | `string` | ISO 8601 avec fuseau | inconnue (`timestamptz` espéré) | `row.created_at.toISOString()` |
| `Order.totalCents` | `number` | centimes entiers | inconnue (`numeric` ?) | `Math.round(Number(x) * 100)` si euros décimaux |
| `Order.lines[].quantity` | `number` | grammes ou pièces selon `unit` | inconnue | à documenter |
| `Order.customer.*` | … | ville + code postal | inconnue | ne jamais mapper la rue ni les champs libres |

## Vocabulaire à aligner (question Q7/Q9 au client)

| Notion | Vocabulaire du front (A1) | Vocabulaire du client | Décision |
|---|---|---|---|
| Statuts de commande | `ORDER_STATUSES` | inconnu | `toOrder` traduit ; statut inconnu → erreur loguée, jamais deviné |
| Ordre des statuts | matrice `canTransition` | inconnu | à confronter aux règles/triggers de la base |
| Créneaux de livraison | `{ date, start, end }` | inconnu | |
| Unités | `unit: "g" \| "piece"` | inconnu | |
```

Règle : une ligne par fonction et par champ ; « colonne client » reste « inconnue » tant que le `pull` n'a pas eu lieu ; toute conversion découverte y est notée avant d'être codée.

## Points de vigilance pour Zaki

1. Imports en `@/…` partout ; `orders.mock.ts`, `fixtures.ts`, `rules.ts`, `schemas.ts` n'importent jamais `server-only`, `@/lib/env` ni rien de `next/*`, sinon Vitest casse.
2. La garde de session se lit « autorisé seulement si `development` ou `test` » ; tester avec `npm run build && npm run start` que la page lève.
3. Dans l'action : `getCurrentUser()` en première ligne, relecture `getOrder` avant `canTransition`, résultat de `canTransition` stocké et testé.
4. `updateOrderStatus` renvoie `null` : chaque appel doit gérer ce cas.
5. Aucun fichier `.sql`, `.dump` ni `.env.local` dans l'arborescence OneDrive ; `git status` avant chaque commit.
