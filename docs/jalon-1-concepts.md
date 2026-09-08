# Jalon 1 « Socle » : les trois concepts à comprendre avant de coder

> **Reporté (2026-09-07).** Le projet est passé en « frontend d'abord » : ce document reste la spécification de la piste **B1** (socle base de données) du [backlog](backlog.md). Amendement de l'architecte : `export const db` devient `export function getDb()` paresseux gardé par `DATA_SOURCE === "db"`, et `env-schema.ts` prend une union discriminée sur `DATA_SOURCE` (voir [a1-spec-branchements.md](a1-spec-branchements.md) §1.d). Le concept 2 (module serveur vs client, `server-only`, alias `@/`) sert dès A1.3.

Rédigé par l'agent `mentor-reviewer` le 2026-09-07. Chaque affirmation a été vérifiée dans le projet réel (versions installées, doc locale de Next 16.3.4). Note d'arbitrage du tech lead : là où ce texte diffère de la spécification backend (`AUTH_SECRET` en `min(32)` et non `min(1)`, corps de réponse `{ ok: boolean }`, schéma dans `env-schema.ts`), c'est la spécification backend qui fait foi. Les explications restent valables.

Bonjour Zaki. Avant que tu écrives `src/lib/env-schema.ts`, `src/lib/env.ts`, `src/db/client.ts` et `src/app/api/health/route.ts`, voici les trois idées que ces fichiers mettent en jeu. Une idée à la fois.

État de départ :

- `dashboard/src/lib/` ne contient que `utils.ts`. `dashboard/src/db/` n'existe pas encore.
- `dashboard/drizzle.config.ts` ligne 13 lit `process.env.DATABASE_URL!` avec un point d'exclamation. Garde cet exemple en tête : c'est exactement ce que le concept 1 va remplacer.
- `dashboard/.env.example` déclare deux variables : `DATABASE_URL` et `AUTH_SECRET`.

---

## Concept 1 : valider `process.env` avec zod

### Image mentale

Imagine que tu ouvres un restaurant. Chaque matin, un livreur dépose des cartons à la porte. Tu peux les rentrer en cuisine sans regarder, ou vérifier à la porte que les tomates et les carottes sont bien là, et refuser d'ouvrir si un carton manque. Le second choix est plus sûr : tu sais tout de suite ce qui manque, et personne n'attend qu'une commande arrive pour découvrir qu'il n'y a pas de tomates.

`process.env` (l'objet Node.js qui contient les variables d'environnement, c'est-à-dire les réglages fournis à ton programme de l'extérieur, comme `DATABASE_URL`) est ce livreur. Il dépose ce qu'il a. Il ne garantit rien.

### Mécanisme réel

**Pourquoi `process.env.DATABASE_URL` est de type `string | undefined`.** TypeScript ne peut pas savoir ce qu'il y aura dans ton `.env.local` au moment où le programme tournera. Il déclare donc chaque clé comme « peut-être une chaîne, peut-être rien ». C'est honnête : si tu oublies la ligne, la valeur est vraiment `undefined`.

Le `!` de `drizzle.config.ts` s'appelle une assertion non nulle (une promesse faite à TypeScript : « fais-moi confiance, ce n'est pas `undefined` »). TypeScript te croit et se tait. Si la variable manque vraiment, rien ne te prévient. L'erreur surgit plus tard, ailleurs, avec un message obscur du pilote PostgreSQL.

**Ce que fait zod.** zod (une bibliothèque qui décrit une forme attendue et vérifie qu'une donnée s'y conforme) te permet de dire : « je veux un objet avec `DATABASE_URL` qui est une URL et `AUTH_SECRET` qui est une chaîne d'au moins 32 caractères ». Si la donnée ne colle pas, zod te dit précisément quelle clé pose problème.

**Pourquoi une fonction pure `parseEnv(raw)` séparée de l'export `env`.** Une fonction pure (dont le résultat dépend uniquement de ses arguments, sans lire ni modifier quoi que ce soit à l'extérieur) est facile à tester : tu lui passes un objet, tu regardes ce qu'elle renvoie. Si tu écrivais directement `envSchema.parse(process.env)`, ton test dépendrait du vrai environnement de ta machine. Or Vitest (ton lanceur de tests) ne lit pas `.env.local` : c'est `next dev` qui le charge. Ton test échouerait chez toi, réussirait chez un collègue, sans raison visible. Avec `parseEnv(raw)`, le test fabrique lui-même son petit objet `raw`.

Ton `CLAUDE.md` le formule ainsi : « Logique pure isolée dans des fonctions testables, sans dépendance à Next ; les composants ne font que brancher ». `parseEnv` est la logique pure, `export const env = parseEnv(process.env)` est le branchement.

### Extrait annoté

```ts
const envSchema = z.object({                 // 1. la forme attendue
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),  // une URL postgres, sinon erreur
  AUTH_SECRET: z.string().min(32),           //    32 caractères minimum, sinon erreur
});

export function parseEnv(raw: Record<string, string | undefined>) {  // 2. pure : ne lit que `raw`
  const result = envSchema.safeParse(raw);           //    safeParse ne lance pas d'exception, il renvoie { success, data | error }
  if (!result.success) throw new Error(z.prettifyError(result.error));  // 3. message lisible, une ligne par clé fautive
  return result.data;                                // 4. ici TypeScript SAIT que DATABASE_URL est un string
}
```

Et dans l'autre fichier, `env.ts` :

```ts
import "server-only";
import { parseEnv } from "@/lib/env-schema";
export const env = parseEnv(process.env);    // 5. le branchement : exécuté une seule fois, au premier import
```

Ligne 5, le point crucial. `parseEnv` **renvoie** un objet, elle ne modifie rien. Si tu écris seulement `parseEnv(process.env);`, la validation a lieu, puis le résultat est jeté. Le `export const env =` est ce qui **stocke** le résultat pour que `src/db/client.ts` puisse écrire `env.DATABASE_URL`.

Vérifié sur ton installation (zod 4.5.4) : `z.prettifyError` existe et, avec un objet vide, affiche :

```
✖ Invalid input: expected string, received undefined
  → at DATABASE_URL
```

C'est ce message que tu verras dans le terminal de `npm run dev` si tu oublies une variable.

### Le test Vitest (`src/lib/env.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env-schema";

describe("parseEnv", () => {
  it("rejette un environnement sans DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();                       // objet vide : doit lancer une erreur
  });
  it("accepte un environnement complet", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/fig", AUTH_SECRET: "a".repeat(32) });
    expect(env.DATABASE_URL).toContain("localhost");            // résultat STOCKÉ dans `env`, puis vérifié
  });
});
```

Remarque le `expect(() => parseEnv({}))` : on passe une fonction fléchée, pas l'appel direct. Sinon l'erreur serait lancée avant que `expect` puisse la capturer.

Pourquoi le test importe `@/lib/env-schema` et pas `@/lib/env` : importer `env.ts` exécuterait `parseEnv(process.env)` sous Vitest, où `DATABASE_URL` est vide, et tout le fichier de test planterait avant le premier `it`. C'est pour cela que le schéma vit dans son propre fichier.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Sans validation : `npm run dev`, la page d'accueil s'affiche, tout semble bien. Tu ouvres `/api/health` : erreur `ECONNREFUSED` ou `Invalid URL` venue des profondeurs du pilote `postgres`, sans mention de `DATABASE_URL`. Tu perds vingt minutes.
- Sans le `export const env =` : `npm run typecheck` te dira dans `src/db/client.ts` que `env` n'existe pas (`has no exported member 'env'`). C'est le signal à reconnaître.

### Question de compréhension

Si tu écris `parseEnv(process.env);` seul sur sa ligne, la validation a-t-elle lieu ? Et pourquoi cela ne suffit-il pas ?

---

## Concept 2 : module serveur vs module client dans l'App Router

### Image mentale

Une banque a un guichet et un coffre. Le guichet est ouvert au public : tout le monde voit ce qui s'y passe. Le coffre est derrière, fermé. Le mot de passe de la base du client FIG est dans le coffre. Si tu l'écris sur un post-it collé au guichet, n'importe quel passant le lit.

Dans Next.js, le serveur est le coffre. Le navigateur de l'utilisateur est le guichet.

### Mécanisme réel

**Server Component par défaut.** Dans l'App Router (le système de routage de Next.js basé sur le dossier `src/app/`), chaque composant React est par défaut un Server Component (un composant qui s'exécute uniquement sur le serveur ; le navigateur reçoit le HTML déjà produit, jamais son code source). Ton `page.tsx` et ton `layout.tsx` sont des Server Components : ils n'ont aucune directive en haut du fichier.

**`"use client"`.** C'est une directive (une chaîne placée seule à la toute première ligne du fichier) qui dit à Next : « ce composant doit aussi tourner dans le navigateur ». Il en a besoin dès qu'il utilise un `useState`, un `onClick`, ou une bibliothèque comme recharts. Le code de ce fichier, **et de tout ce qu'il importe**, est alors envoyé au navigateur.

**Ce qui fuit.** C'est le « et de tout ce qu'il importe » qui est dangereux. Si un jour un composant `"use client"` importe `@/db/client` (même par étourderie, même via un fichier intermédiaire), Next essaie d'empaqueter ce module pour le navigateur. Soit le bundler (l'outil qui assemble le code pour le navigateur) échoue parce que le pilote `postgres` utilise des modules Node.js (`net`, `tls`) qui n'existent pas dans un navigateur ; soit il passe, et le code de connexion se retrouve dans le JavaScript public. Les variables sans préfixe `NEXT_PUBLIC_` sont remplacées par des chaînes vides côté client, donc le secret lui-même ne part pas. Mais la logique, les noms de tables, et la tentative de connexion depuis le navigateur, oui.

**Comment on se protège.** La doc de Next 16.3 installée sur ton poste (section « Preventing environment poisoning ») recommande `import "server-only"` en première ligne des modules qui ne doivent jamais aller côté client. Effet : si un composant client l'importe, `npm run build` échoue avec un message explicite. Vérifié : le paquet `server-only` n'est pas dans ton `node_modules`, mais Next le gère en interne et fournit lui-même les types. Tu n'as **rien à installer**.

### Extrait annoté

```ts
import "server-only";                        // 1. garde-fou : import côté client = erreur de build claire
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";             // 2. alias @/ ; `env` est déjà validé, DATABASE_URL est un string sûr

const sql = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10 });  // 3. la connexion physique
export const db = drizzle(sql);              // 4. l'objet que le reste du serveur utilisera pour requêter
```

Ligne 3 : la connexion s'ouvre au premier import du module. C'est voulu : un seul module, une seule connexion partagée. La spécification backend ajoute une garde `globalThis` pour le rechargement à chaud en développement.

### Pourquoi `@/lib/env` et jamais `../lib/env`

Pratique : `../lib/env` dépend de **l'endroit où se trouve le fichier qui importe**. Depuis `src/db/client.ts`, c'est `../lib/env`. Depuis `src/app/api/health/route.ts`, ce serait `../../../lib/env`. Si tu déplaces un fichier, tous ses imports relatifs cassent. `@/lib/env` veut toujours dire `src/lib/env`.

Robustesse : l'alias doit être connu de **deux outils différents**, et ton projet le fait déjà :

- `dashboard/tsconfig.json` : `"paths": { "@/*": ["./src/*"] }`. Lu par TypeScript et Next.
- `dashboard/vitest.config.mts` : `alias: { "@": path.resolve(import.meta.dirname, "src") }`. Lu par Vitest, qui ignore le tsconfig.

Si tu utilises `@/` partout, les deux outils résolvent le même chemin. Si tu mélanges, tu auras un test qui passe et un build qui échoue, ou l'inverse.

Un piège cousin : les éditeurs proposent parfois en autocomplétion un chemin du type `next/dist/...`. C'est l'intérieur de Next, pas son API publique. On importe depuis `next/server`, `next/navigation`, `next/headers`, jamais depuis `next/dist`.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Sans `import "server-only"` : le jour où un composant client importe `@/db/client`, soit une erreur de build `Module not found: Can't resolve 'net'`, soit rien du tout, ce qui est pire. Avec la directive, le message dit clairement que tu importes un module serveur dans un composant client, et pointe le fichier fautif.
- Avec un import relatif : `npm run test` peut afficher `Failed to resolve import "../lib/env"` si le fichier a bougé.

### Question de compréhension

Un composant marqué `"use client"` importe un fichier `src/lib/format-price.ts` qui ne fait que des calculs. Faut-il mettre `import "server-only"` dans ce fichier ? Pourquoi ?

---

## Concept 3 : Route Handler = frontière serveur

### Image mentale

À l'entrée d'un immeuble, un interphone. Tu appuies, quelqu'un répond « oui, montez » ou « désolé, service fermé ». Il ne te récite pas le contenu de son agenda ni le nom de ses collègues absents. Une réponse courte, un état, rien de plus.

Ton `/api/health` est cet interphone. Il dit « la base répond » ou « la base ne répond pas ». C'est tout.

### Mécanisme réel

**Ce qu'est un Route Handler.** Un Route Handler (un fichier `route.ts` dans `src/app/` qui répond directement à une requête HTTP sans produire de page) reçoit une requête et renvoie une réponse. Vérifié dans la doc de ta version :

- on exporte une fonction nommée comme la méthode HTTP : `export async function GET()` ;
- on renvoie un objet `Response` standard du Web, par exemple `Response.json({ ... }, { status: 200 })` ;
- un `route.ts` ne peut pas cohabiter avec un `page.tsx` dans le même dossier ;
- depuis la v15, un `GET` n'est plus mis en cache par défaut : chaque appel s'exécute vraiment ;
- si tu ajoutes un jour des segments dynamiques (`[id]`), `params` est une `Promise` qu'il faut `await`. Changement cassant de cette version.

**Pourquoi un code HTTP.** Le code HTTP (le nombre à trois chiffres que le serveur renvoie en premier) est lu par les machines. Un outil de supervision, un script de déploiement, ou ton `curl` regardent ce chiffre. 200 signifie « OK ». 503 signifie « Service Unavailable » : le service existe mais ne peut pas répondre en ce moment. C'est précisément « le dashboard tourne mais la base ne répond pas ».

**Pourquoi un message générique et le détail dans `console.error`.** `/api/health` est accessible à quiconque connaît l'URL. Si tu renvoies le message d'erreur brut du pilote PostgreSQL, tu peux exposer le nom d'hôte, le port, le nom de la base ou de l'utilisateur du client FIG. `console.error(error)` écrit dans le terminal du serveur, que toi seul vois. Le navigateur reçoit `{ "ok": false }`.

### Extrait annoté

```ts
export async function GET() {
  try {
    await db.execute(sql`select 1`);                              // 1. requête minimale : la base répond-elle ?
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });   // 2. succès → 200
  } catch (error) {
    console.error("[health] base injoignable", error);            // 3. le détail reste côté serveur
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });  // 4. échec → 503
  }
}
```

`db` vient de `@/db/client`, `sql` vient de `drizzle-orm`. `select 1` est la requête SQL la plus légère qui existe : elle ne touche aucune table, elle prouve juste que la connexion fonctionne.

**Le piège de la garde inversée.** Une garde (un `if` qui décide de sortir tôt d'une fonction) peut être écrite à l'envers sans que TypeScript s'en plaigne :

```ts
const ok = await ping();
if (ok) return Response.json({ ok: false }, { status: 503 });  // faux : on punit le succès
```

Quand la base répond, on renvoie 503. Quand elle ne répond pas, on tombe dans le 200. Tout compile, et la supervision te dira l'inverse de la vérité. Le `try/catch` évite ce piège : le chemin heureux est dans le `try`, le chemin d'erreur dans le `catch`, sans booléen à inverser. Si tu utilises quand même un `if`, relis-le à voix haute : « si ça marche, alors je renvoie une erreur » doit te faire tiquer.

### Comment tu vérifies

Lance `npm run dev` dans un terminal, puis dans un autre (Git Bash ; dans PowerShell écris `curl.exe`) :

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
```

`-s` silencieux, `-o /dev/null` jette le corps, `-w "%{http_code}"` affiche uniquement le code. Tu dois voir `200` si `.env.local` est correct et que PostgreSQL tourne ; `503` si tu coupes PostgreSQL. Dans le terminal de `npm run dev`, la ligne `[health] base injoignable` suivie du détail. Dans le navigateur, seulement `{"ok":false}`.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Si tu oublies le `status: 503` dans le `catch` : `curl` affiche `200` même quand la base est coupée.
- Si tu renvoies `error.message` au client : ouvre `/api/health` avec la base coupée. Si tu lis un nom d'hôte ou d'utilisateur dans la réponse, c'est une fuite.
- Si tu écris `export default function GET()` par réflexe : Next répond `405 Method Not Allowed`. L'export nommé `GET` est obligatoire.

### Question de compréhension

Quelqu'un appelle `/api/health` alors que PostgreSQL est éteint. Quel code HTTP doit-il recevoir, quel texte doit-il voir dans son navigateur, et où doit se trouver le message d'erreur complet ?

---

## Mini-exercice de 5 minutes

Avant de coder, écris sur un brouillon :

1. La chaîne d'imports complète : qui importe qui, entre `env-schema.ts`, `env.ts`, `client.ts` et `route.ts` ? (Elle va toujours dans le même sens, du plus « bas niveau » vers le plus « haut niveau ».)
2. Pour chacun de ces fichiers : peut-il être importé par un composant `"use client"` sans danger ? Oui ou non, et pourquoi.

Si tu réponds à ces deux points, tu as compris la frontière serveur, et le code suivra naturellement.

Une fois les fichiers écrits, lance `npm run check` depuis `dashboard/`, puis reviens avec le résultat et tes réponses aux questions. On relira ensemble.
