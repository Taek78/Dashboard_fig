# Jalon 1 : spécification backend et sécurité

> **Reporté (2026-09-07).** Le projet est passé en « frontend d'abord » : ce document reste la spécification de la piste **B1** (socle base de données) du [backlog](backlog.md). Amendement de l'architecte : `export const db` devient `export function getDb()` paresseux gardé par `DATA_SOURCE === "db"`, et `env-schema.ts` prend une union discriminée sur `DATA_SOURCE` (voir [a1-spec-branchements.md](a1-spec-branchements.md) §1.d). Le concept 2 (module serveur vs client, `server-only`, alias `@/`) sert dès A1.3.

Rédigée par l'agent `security-backend-architect` le 2026-09-07 sur le brief B1 du tech lead. Zaki écrit le code ; ce document dit quoi faire et pourquoi, pas comment ligne par ligne.

## Faits vérifiés dans le projet

| Fait | Source |
|---|---|
| Aucun `src/db/`, `src/lib/env.ts`, `src/app/api/` n'existe encore ; seul `src/lib/utils.ts` est là | `find src` |
| `.gitignore` ignore `.env*` sauf `.env.example` ; `git ls-files` ne trace aucun `.env` | `dashboard/.gitignore` |
| Le placeholder `AUTH_SECRET=changez-moi-avec-npx-auth-secret` fait exactement 32 caractères : il passerait la validation `min(32)` | `dashboard/.env.example:3` |
| `drizzle.config.ts:13` fait `process.env.DATABASE_URL!` : le `!` masque une variable absente | `dashboard/drizzle.config.ts` |
| Route Handlers `GET` non cachés par défaut depuis Next 15 ; `cacheComponents` n'est pas activé | doc locale `route-handlers.md`, `route.md` |
| `import "server-only"` fonctionne sans installer le paquet : Next le traite en interne et déclare le module dans ses types | doc locale `05-server-and-client-components.md` |
| zod v4 : `z.url({ protocol: RegExp })`, regex testée sur le protocole sans le `:` final | `zod/v4/classic/schemas.d.ts` |
| postgres.js : options `max`, `idle_timeout` (secondes), `connect_timeout` (secondes) | `postgres/types/index.d.ts` |
| `instrumentation.ts` → `register()` est appelé une fois au démarrage du serveur, avant la première requête | doc locale `instrumentation.md` |

## 1.2 `dashboard/compose.yaml`

| Clé | Valeur | Pourquoi |
|---|---|---|
| `image` | `postgres:16-alpine` | À réaligner au jalon 4 sur `SELECT version();` chez le client : une version majeure différente change les types renvoyés par `drizzle-kit pull`. |
| `environment` | `POSTGRES_USER=fig`, `POSTGRES_PASSWORD=fig`, `POSTGRES_DB=fig` | Valeurs de dev volontairement triviales (voir ci-dessous). |
| `ports` | `"127.0.0.1:5432:5432"` | Pas `"5432:5432"` : sans le préfixe, Docker publie le port sur toutes les interfaces et `fig/fig` devient joignable depuis le Wi-Fi du café. |
| `volumes` | `fig-pgdata:/var/lib/postgresql/data` + bloc racine `volumes: { fig-pgdata: {} }` | Volume nommé : les données survivent à `docker compose down` ; `down -v` pour repartir de zéro. |
| `healthcheck` | `test: ["CMD-SHELL", "pg_isready -U fig -d fig"]`, `interval: 5s`, `timeout: 3s`, `retries: 10` | `docker compose ps` affiche `healthy` ; un futur service peut attendre la base via `depends_on: condition: service_healthy`. |

Pas de `container_name` ni de `restart: always`. Le fichier est commité : il ne contient aucun secret réel, c'est le seul endroit où un mot de passe a le droit d'apparaître en clair.

**Pourquoi `fig/fig` est acceptable ici.** Il protège une base qui ne contient que des données factices ou anonymisées, joignable uniquement depuis `127.0.0.1`, sur un poste dont Zaki est déjà administrateur. Un attaquant capable de s'y connecter a déjà tout le poste.

**Pourquoi il ne doit jamais servir ailleurs.** Il est dans un fichier versionné : dès le premier `git push`, il est public par construction. Toute base joignable par le réseau doit avoir un secret généré, jamais commité.

`.env.example` :

```
DATABASE_URL=postgresql://fig:fig@localhost:5432/fig
# générer avec : npx auth secret
AUTH_SECRET=
```

## 1.3 `src/lib/env-schema.ts` et `src/lib/env.ts`

Schéma et signatures :

```ts
const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_SECRET: z.string().min(32),
});
export type Env = z.infer<typeof envSchema>;
export function parseEnv(raw: Record<string, string | undefined>): Env {
  return envSchema.parse(raw);
}
```

Points d'API : en zod v4, `z.url()` est une fonction de premier niveau (`z.string().url()` est l'ancienne forme). `z.object` retire les clés inconnues : `env` ne contient que les deux champs validés. Une `ZodError` n'inclut pas la valeur d'entrée par défaut : le secret n'apparaît pas dans la trace.

**Échouer au démarrage plutôt qu'à la première requête.** Si `DATABASE_URL` manque, on veut le savoir au `npm run dev`, pas quand un collègue clique sur « Commandes » à 18 h. Nuance : un `export const env = parseEnv(process.env)` au niveau module s'exécute au premier import, donc à la première requête serveur touchant ce module. Pour un vrai « au démarrage », `src/instrumentation.ts` avec `register()` qui importe `@/lib/env` (optionnel).

**Pourquoi séparer la fonction pure de l'export.** `parseEnv` est testable : on lui passe un objet fabriqué. `env` est un effet de bord (lit le vrai `process.env`) : on ne veut pas que le test dépende de la machine.

**Pourquoi deux fichiers.** Importer un module contenant `export const env = parseEnv(process.env)` dans Vitest exécute cette ligne ; Vitest n'a pas `DATABASE_URL`, l'import lève, le test échoue avant de commencer. Et `import "server-only"` n'est pas résolu par Vitest. Donc :

- `src/lib/env-schema.ts` : `envSchema` + `parseEnv` + `Env`. Pur, sans `server-only`, testé.
- `src/lib/env.ts` : `import "server-only"` puis `export const env = parseEnv(process.env)`.

Le principe « pur vs effet » devient visible dans l'arborescence.

Cas de test dans `src/lib/env.test.ts` :

1. Entrée valide `{ DATABASE_URL: "postgresql://fig:fig@localhost:5432/fig", AUTH_SECRET: "a".repeat(32), AUTRE: "x" }` → renvoie exactement les deux champs, `AUTRE` absent. Ajouter `postgres://…` en cas positif pour couvrir la regex.
2. `DATABASE_URL` absente ou de mauvais protocole (`mysql://…`) → `toThrow()`.
3. `AUTH_SECRET` de 31 caractères → `toThrow()` ; 32 → passe. Teste la borne exacte.

## 1.4 `src/db/client.ts` et `src/db/schema.ts`

Structure de `client.ts`, dans cet ordre : (1) `import "server-only"` en première ligne, (2) `drizzle` depuis `drizzle-orm/postgres-js`, `postgres` depuis `postgres`, `env` depuis `@/lib/env`, `* as schema` depuis `@/db/schema`, (3) création du pool, (4) `export const db = drizzle(sql, { schema })`. Aucun autre export.

```ts
postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10 })
```

| Option | Valeur | Pourquoi |
|---|---|---|
| `max` | 5 | Back-office : une poignée d'utilisateurs, un seul processus Node. Au jalon 4 la base est celle du client, son appli en a besoin : on prend le minimum. |
| `idle_timeout` | 20 s | Ferme les connexions inutilisées ; le dashboard dort la nuit. |
| `connect_timeout` | 10 s | Échec rapide si la base est injoignable : la route santé répond 503 en 10 s au lieu de pendre. |

`prepare: false` seulement si le client met un pooler en mode transaction (PgBouncer) devant sa base : question du jalon 4.

**Piège du rechargement à chaud.** En `next dev`, chaque modification d'un module en amont ré-exécute le niveau module de `client.ts` → nouveau pool → au bout de vingt sauvegardes, `too many clients`. Parade : en développement uniquement, mémoriser l'instance `sql` sur `globalThis` et la réutiliser. Vérifier que la garde ne s'applique pas en production.

`src/db/schema.ts` : fichier vide avec un commentaire « Schéma du client obtenu par `npx drizzle-kit pull` au jalon 4. Ne rien déclarer à la main : la base appartient au client. » Attention : `pull` écrit dans `./drizzle/` (le `out` de `drizzle.config.ts`), pas dans `src/db/schema.ts` ; il faudra déplacer ou pointer.

### Empêcher l'import côté client

**Option A, retenue : `import "server-only"`.** Sans dépendance à ajouter : Next déclare le type et intercepte l'import. À mettre dans `client.ts` et `env.ts`. Si un composant `"use client"` importe, même indirectement, un de ces modules, le build échoue avec un message clair. Compromis : ne fonctionne que sous le bundler Next ; Vitest ne le résout pas, d'où la séparation `env-schema.ts`.

**Option B, filet tardif :** `if (typeof window !== "undefined") throw new Error(…)`. L'erreur n'arrive qu'au moment où le code tourne dans le navigateur, jamais au build. À réserver au cas où l'option A serait refusée.

Dans les deux cas, `process.env.DATABASE_URL` n'atteint jamais le navigateur (Next remplace par une chaîne vide toute variable sans `NEXT_PUBLIC_`), mais le but est d'échouer tôt et lisiblement.

## 1.5 `src/app/api/health/route.ts`

Comportement du `GET` (aucun paramètre, body ni cookie lu) :

1. `await db.execute(sql\`select 1\`)` avec `sql` de `drizzle-orm` et `db` de `@/db/client`.
2. Succès → `Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })`.
3. Échec (`catch`) → `console.error("[health] base injoignable", error)` puis `Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } })`.

Ce que la réponse ne doit jamais contenir : `error.message` (hôte, port, utilisateur, nom de base), la pile, la version de Postgres ou du driver, la latence, `env.DATABASE_URL`. Le corps est strictement `{ ok: boolean }`. Même côté logs, on ne journalise jamais la chaîne de connexion.

**Cache.** Les `GET` de Route Handlers ne sont pas cachés par défaut dans cette version. Ne jamais ajouter `export const dynamic = "force-static"` ni `export const revalidate`. `export const dynamic = "force-dynamic"` est une ceinture explicite acceptable. Le header `Cache-Control: no-store` empêche un navigateur, proxy ou CDN de resservir un `200` pendant une panne.

**Risque en production.** Scénario : la route est publique ; un script envoie 500 requêtes par seconde ; chaque appel occupe une connexion d'un pool de 5 ; les Server Actions attendent, le dashboard devient inutilisable et, au jalon 4, la charge frappe la base de production du client. Gravité : **haute** dès que `DATABASE_URL` pointe vers la base du client, moyenne en local. Pistes pour le jalon 10 : retirer la route ; ou exiger `Authorization: Bearer <HEALTH_TOKEN>` (comparaison `crypto.timingSafeEqual`, réponse 404 sinon) ; ou restreindre au reverse proxy ; et limiter le débit. Variante propre : séparer liveness (`{ ok: true }` sans toucher la base) et readiness (la requête SQL, protégée).

## Pour le jalon 4 : compte SQL lecture seule et dump

Ordres à transmettre au client (mot de passe fourni par un canal séparé) :

```sql
CREATE ROLE dashboard_ro LOGIN PASSWORD '<mot-de-passe-fort>' CONNECTION LIMIT 3;
GRANT CONNECT ON DATABASE <base> TO dashboard_ro;
GRANT USAGE ON SCHEMA public TO dashboard_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_ro;
```

Rien d'autre : pas d'`INSERT/UPDATE/DELETE`, pas de `CREATE`, pas de séquences, pas de `SUPERUSER`. `drizzle-kit pull` lit `information_schema` et `pg_catalog`, accessibles à tout rôle. Ceinture optionnelle : `ALTER ROLE dashboard_ro SET default_transaction_read_only = on;`. Si plusieurs schémas, répéter `USAGE` + `SELECT` par schéma. Le dashboard en exploitation aura plus tard son propre rôle aux droits d'écriture ciblés, jamais celui-ci.

**RGPD pour le dump.** La base contient des données de personnes. Le dashboard est sous-traitant au sens du RGPD ; accord écrit du client sur ce qui sort de son infra.

- Premier choix : `pg_dump --schema-only`. Zéro donnée personnelle, suffisant pour `drizzle-kit pull` et un seed synthétique.
- Si données réelles indispensables : anonymisation chez le client avant transfert (emails → `client_<id>@example.invalid`, noms génériques, adresses réduites au code postal et à la ville, téléphones constants, champs libres vidés, hachages et tokens supprimés). Transfert chiffré, durée de conservation convenue, suppression tracée.
- Le dépôt est sous OneDrive : un dump posé dans le projet part dans le cloud. Stocker les dumps hors OneDrive et ajouter `dumps/` et `*.sql.gz` à `dashboard/.gitignore`.

## Points de vigilance pour Zaki

1. Imports en `@/lib/env`, `@/db/client`, `@/db/schema`, jamais `../lib/env`. Exception : `drizzle.config.ts` tourne hors Next et ne connaît pas l'alias.
2. `parseEnv(process.env);` seul ne sert à rien : c'est `export const env = parseEnv(process.env);`.
3. Dans la route santé, le `200` vit dans le `try`, le `503` dans le `catch`, et le `503` porte `ok: false`.
4. `git status` avant chaque commit : `.env.local` ne doit jamais apparaître. Seul `compose.yaml` a le droit de contenir `fig/fig`.
5. `import "server-only"` en ligne 1 de `client.ts` et `env.ts`. Vider le placeholder `AUTH_SECRET` de `.env.example`.
