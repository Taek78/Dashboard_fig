# Jalon A1 « Frontend d'abord » : les quatre concepts à comprendre avant de coder (A1.0 à A1.3)

Rédigé par l'agent `mentor-reviewer` le 2026-09-07. Chaque affirmation a été vérifiée sur ton installation (Next 16.3.4, React 19.2.8, TypeScript 5.9, Vitest 5.0, zod 4.5). Ce n'est pas une relecture : c'est une préparation, une idée à la fois.

Note d'arbitrage du tech lead : `computeOrderTotalCents` fait la **somme des `lineTotalCents`** de chaque ligne (chaque ligne porte déjà son total), pas `prix × quantité` : la règle de tarification dépend du client et on ne l'invente pas. Les pages vivent dans `src/app/(dashboard)/…` ; le groupe `(dashboard)` n'apparaît pas dans l'URL. La garde de session est celle de l'architecte (liste blanche `development` / `test`). Les explications ci-dessous restent valables.

État de départ dans `dashboard/src/` : `layout.tsx` a encore `title: "Create Next App"` et `<html lang="en">` ; `page.tsx` est l'accueil du template ; `src/domain/` et `src/data/` n'existent pas ; aucun test.

Architecture décidée (tu la construis, on ne la rediscute pas) :

```
src/domain/orders/      le métier : types, statuts, règles pures, fixtures
src/data/               la façade : ce que le front importe pour obtenir des données
src/lib/                utilitaires purs (simulation.ts, format.ts, navigation.ts)
```

---

## A1.0 : `metadata` avec `title.template`, et `lang="fr"`

### Image mentale

Un classeur de dossiers dans un bureau. Chaque dossier porte une étiquette : « Commandes », « Clients ». Sur la tranche du classeur, une seule fois, le nom de l'entreprise : « FIG Back-office ». Tu n'écris pas « FIG Back-office » sur chaque étiquette. Le classeur le fait pour toi.

`title.template` est la tranche du classeur. Le `title` de chaque page est l'étiquette.

### Mécanisme réel

**Ce qu'est `metadata`.** Dans l'App Router, un `layout.tsx` ou `page.tsx` peut exporter une constante `metadata` (un objet qui décrit la page : titre, description). Next lit cet objet et fabrique lui-même les balises `<title>` et `<meta>` du `<head>`. Tu n'écris jamais `<title>` toi-même.

**Qui lit le titre.** Le navigateur l'affiche dans l'onglet et l'historique : avec dix onglets ouverts, « Commandes · FIG Back-office » se retrouve, « Create Next App » non. Un lecteur d'écran (logiciel qui lit la page à voix haute) annonce le titre en premier à chaque changement de page : c'est son seul moyen de savoir où il est arrivé. Les moteurs de recherche l'utilisent comme ligne principale d'un résultat.

**Pourquoi `template`.** Sans template, chaque page devrait écrire `title: "Commandes · FIG Back-office"`. Le jour où le client veut « FIG Admin », tu modifies dix fichiers et tu en oublies un. Avec le template dans le layout racine, tu écris `title: "Commandes"` dans la page et Next remplace `%s`.

**Règles vérifiées dans la doc locale :**

- `title.default` est obligatoire dès qu'il y a un `template`. C'est le titre utilisé quand une page n'en définit aucun.
- Le template s'applique aux segments **enfants** du layout, pas au `page.tsx` du même dossier. Donc l'accueil `(dashboard)/page.tsx` est enfant du layout racine : il reçoit le template si tu lui donnes un titre, et `default` sinon.
- Écrire `title.template` dans un `page.tsx` ne fait rien : une page n'a pas d'enfants.
- `metadata` ne fonctionne que dans un Server Component. Si un jour tu ajoutes `"use client"` en haut d'une page, l'export cesse de marcher : la page reste serveur, le morceau interactif part dans un composant séparé.

**`lang="fr"`.** L'attribut `lang` de `<html>` dit la langue du document. Le lecteur d'écran choisit sa voix et sa prononciation d'après lui : avec `lang="en"`, un texte français est lu avec un accent anglais, incompréhensible. Le navigateur s'en sert aussi pour proposer ou non une traduction et pour la césure.

### Extrait annoté

Dans `src/app/layout.tsx` :

```ts
export const metadata: Metadata = {
  title: {
    template: "%s · FIG Back-office",   // 1. %s sera remplacé par le title de chaque page enfant
    default: "FIG Back-office",         // 2. obligatoire avec template ; sert aux pages sans title
  },
  description: "Back-office de gestion des commandes et livraisons FIG",
};
```

Et `<html lang="fr" …>` à la place de `"en"`.

Dans une page enfant, `src/app/(dashboard)/commandes/page.tsx` :

```ts
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Commandes" };   // 3. rendu : <title>Commandes · FIG Back-office</title>

export default async function CommandesPage() { … }
```

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Sans `default` avec un `template` : `npm run typecheck` passe, mais l'accueil affiche un titre vide ou incohérent. Regarde l'onglet sur `/`.
- Template dans `page.tsx` : rien ne se passe, aucun message. « J'ai écrit une config et rien n'a changé » = mauvais endroit.
- `lang="en"` : aucun outil ne prévient. Seul un test avec le lecteur d'écran de Windows (Narrateur, Windows + Ctrl + Entrée) le révèle. Fais-le une fois.

### Question de compréhension

Tu laisses `(dashboard)/page.tsx` sans `metadata`. Qu'affichera l'onglet sur `/` ? Et si tu y ajoutes `title: "Tableau de bord"` ?

---

## A1.1 : un tableau `as const` qui engendre un type union

### Image mentale

Une liste de choix imprimée sur le mur de la cuisine : « en attente, confirmée, en préparation, en livraison, livrée, annulée ». Tout le monde la regarde : celui qui remplit le bon, celui qui fait le tableau d'affichage, celui qui vérifie les bons reçus. Il n'y a qu'une liste. Si on ajoute « reportée », on l'ajoute au mur, et tout le monde la voit.

`ORDER_STATUSES` est cette liste. Le type `OrderStatus`, les libellés français, plus tard le `z.enum` et le `<select>` la lisent tous.

### Mécanisme réel

**Le problème de départ.** Si tu écris `const STATUTS = ["pending", "delivered"]`, TypeScript en déduit `string[]` : « un tableau de chaînes quelconques ». Il oublie les valeurs. Vérifié : `(typeof STATUTS)[number]` vaut `string`, et `const l: Large = "n_importe_quoi"` compile sans un mot.

**`as const`.** Une assertion (indication donnée à TypeScript, sans effet à l'exécution) qui dit : « garde les valeurs exactes et considère ce tableau comme figé ». Le type devient `readonly ["pending", "confirmed", …]` : un tuple (tableau de longueur fixe dont chaque case a un type précis) en lecture seule.

**`(typeof ORDER_STATUSES)[number]`**, à lire de l'intérieur vers l'extérieur : `typeof ORDER_STATUSES` = le type de cette constante (le tuple) ; `[number]` = le type de ce qu'on obtient en indexant par n'importe quel nombre, c'est-à-dire l'union de toutes les cases. Résultat : `"pending" | "confirmed" | "preparing" | "delivering" | "delivered" | "cancelled"`. Une union (type qui accepte exactement l'une de ces valeurs et rien d'autre).

**Ce que TypeScript affiche en cas de faute de frappe.** Testé sur ton poste avec `const s: OrderStatus = "deliverd"` :

```
error TS2820: Type '"deliverd"' is not assignable to type '"pending" | "confirmed" | "preparing" | "delivering" | "delivered" | "cancelled"'. Did you mean '"delivered"'?
```

Il liste les valeurs permises et suggère la correction. Avec `string[]`, la faute passerait, la commande ne serait jamais affichée comme livrée, et tu la chercherais en production.

**Une seule source de vérité.** Le tableau sert quatre fois : au type `OrderStatus` ; aux libellés `ORDER_STATUS_LABELS: Record<OrderStatus, string>` (`Record<K, V>` est un objet dont les clés sont exactement `K` : si tu oublies `cancelled`, TypeScript refuse `Property 'cancelled' is missing`) ; plus tard au `z.enum(ORDER_STATUSES)` dans les Server Actions ; au `<select>` via `ORDER_STATUSES.map(…)`.

### Extrait annoté

`src/domain/orders/status.ts` :

```ts
export const ORDER_STATUSES = ["pending", "confirmed", "preparing", "delivering", "delivered", "cancelled"] as const;
//                                                                                                        ^^^^^^^^ 1. fige les valeurs
export type OrderStatus = (typeof ORDER_STATUSES)[number];   // 2. l'union dérivée du tableau, jamais écrite à la main

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {   // 3. une clé par statut, ni plus ni moins
  pending: "En attente",
  confirmed: "Confirmée",
  // … les quatre autres ; en oublier une = erreur de compilation
};
```

Dans `types.ts`, `Order` a un champ `status: OrderStatus`, importé depuis `@/domain/orders/status`.

### Pourquoi les dates sont des chaînes ISO, pas des `Date`

Une chaîne ISO (`AAAA-MM-JJ` ou `AAAA-MM-JJTHH:mm:ssZ`) a trois qualités que `Date` n'a pas ici :

- **Sérialisable partout.** Sérialiser, c'est transformer une donnée en texte pour la transporter. Dès qu'une donnée passe par JSON, une `Date` devient une chaîne. Vérifié : `JSON.stringify({ d: new Date("2026-09-07") })` donne `{"d":"2026-09-07T00:00:00.000Z"}`. Si ton type dit `Date` mais que la valeur réelle est une chaîne, `order.createdAt.getDay()` plante à l'exécution avec `getDay is not a function`, et TypeScript n'avait rien vu. Un type qui ment est pire qu'un type absent.
- **Comparable par `<`.** Deux chaînes ISO se comparent alphabétiquement, et cet ordre est l'ordre chronologique. Vérifié : `"2026-09-07" < "2026-09-08"` vaut `true`.
- **Déterministe.** `new Date()` dépend de l'heure et du fuseau de la machine. Une chaîne écrite en dur ne bouge pas.

Le piège spécifique à l'App Router : le serveur rend le HTML, puis le navigateur le « réhydrate » (React compare le HTML reçu avec ce qu'il rendrait lui-même). Si le serveur formate une `Date` dans son fuseau et le navigateur dans un autre, les deux textes diffèrent et React affiche `Hydration failed`. Avec une chaîne ISO stockée et un formatage explicite à l'affichage, tu maîtrises ce qui est rendu.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Sans `as const` : aucune erreur, jusqu'au jour où un `"deliverd"` glisse dans une fixture. Symptôme : une commande qui n'apparaît dans aucun filtre. Réflexe : survole `ORDER_STATUSES` dans VS Code ; si l'info-bulle dit `string[]`, le `as const` manque.
- Avec `status: string` dans `Order` : `ORDER_STATUS_LABELS[order.status]` provoque `Element implicitly has an 'any' type because expression of type 'string' can't be used to index`.
- Avec `Date` dans le type et des fixtures en JSON : `getDay is not a function` au premier rendu.

### Question de compréhension

Tu ajoutes `"reportee"` à `ORDER_STATUSES`. Quel fichier refuse de compiler en premier, et pourquoi est-ce une bonne nouvelle ?

---

## A1.2 : fonction pure et test de cohérence des fixtures

### Image mentale

Une calculatrice. Tu tapes `12 + 30`, elle affiche `42`. Elle ne range pas le résultat dans un tiroir, elle ne l'envoie à personne. Si tu ne lis pas l'écran, le calcul a eu lieu et il est perdu. Si tu tapes les mêmes touches demain, tu obtiens le même chiffre.

`computeOrderTotalCents` est cette calculatrice. Pure (son résultat dépend uniquement de ses arguments) et sans effet de bord (elle ne change rien autour d'elle). Elle **renvoie** un nombre. Point.

### Mécanisme réel

**Un résultat renvoyé doit être stocké ou utilisé.** Cette ligne, seule, est correcte pour TypeScript et ne fait rien d'utile :

```ts
computeOrderTotalCents(order.lines);   // calcul effectué, résultat jeté
```

Pour que le total serve, il faut soit le stocker (`const total = computeOrderTotalCents(order.lines)`), soit le passer directement à qui en a besoin (`expect(computeOrderTotalCents(order.lines)).toBe(order.totalCents)`). Réflexe : quand tu appelles une fonction dont le nom commence par `compute`, `format`, `parse`, `read`, demande-toi « où va le résultat ? ». Si la réponse est « nulle part », il manque un `const x =` ou un `return`.

**Pourquoi en centimes entiers.** Les nombres à virgule en JavaScript sont approximatifs. Vérifié :

```
0.1 + 0.2          →  0.30000000000000004
0.1 + 0.2 === 0.3  →  false
10 + 20            →  30
```

Avec des euros à virgule, une commande à 3 × 1,10 € peut valoir 3,3000000000000003 €, et un test `toBe(3.3)` échoue de façon incompréhensible. Avec des centimes entiers, `3 * 110` vaut exactement `330`. La conversion en euros se fait uniquement à l'affichage.

**Fixtures déterministes.** Une fixture (donnée factice écrite à la main pour développer et tester sans la vraie base) doit donner le même résultat à chaque exécution. Jamais `Math.random()`, `Date.now()` ni `new Date()` dans `fixtures.ts`. On écrit `FIXTURE_TODAY = "2026-09-07"` en dur et toutes les dates par rapport à elle. Sinon un test passe le lundi et échoue le mardi.

**Le test de cohérence.** Chaque commande des fixtures porte un `totalCents` écrit à la main. Le test vérifie que la règle métier retrouve ce même nombre à partir des lignes. Si les deux divergent, soit la fixture est fausse, soit la règle est fausse. Dans les deux cas tu veux le savoir avant d'afficher un montant faux au client.

### Extrait annoté

`src/domain/orders/rules.ts` :

```ts
export function computeOrderTotalCents(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  //     ^^^^^^ 1. reduce parcourt les lignes et accumule ; 0 est la valeur de départ
  //                                              2. entiers + entiers = entier exact
}
```

`src/domain/orders/rules.test.ts` (Vitest le trouve grâce au motif `src/**/*.test.ts`) :

```ts
import { describe, expect, it } from "vitest";
import { computeOrderTotalCents } from "@/domain/orders/rules";      // 1. alias @/, jamais ../
import { ordersFixtures } from "@/domain/orders/fixtures";

describe("computeOrderTotalCents", () => {
  it("renvoie 0 pour une commande sans ligne", () => {
    expect(computeOrderTotalCents([])).toBe(0);                    // 2. le résultat va DANS expect
  });
  it.each(ordersFixtures)("fixture $id : total cohérent", (order) => {   // 3. un cas par fixture
    expect(computeOrderTotalCents(order.lines)).toBe(order.totalCents);
  });
});
```

`it.each(tableau)` crée un `it` par élément ; `$id` dans le nom est remplacé par la propriété `id` : dans la sortie de `npm run test`, tu vois exactement quelle commande échoue.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- `computeOrderTotalCents(order.lines);` puis `expect(order.totalCents).toBe(…)` : le test « passe » sans rien vérifier. Signe à repérer : un appel de fonction seul sur sa ligne, sans `const`, sans `return`, sans être à l'intérieur d'un autre appel.
- Un `new Date()` dans les fixtures : un test qui filtre « les commandes d'aujourd'hui » renvoie 3 résultats le matin, 2 le lendemain. Message Vitest : `expected 2 to be 3`, sans que tu aies rien changé.
- Montants en euros flottants : `expected 3.3000000000000003 to be 3.3`. Une longue traîne de décimales dans un message de test, c'est le flottant.
- Sans le test de cohérence : `totalCents: 1250` et des lignes qui font 1350. Le tableau affiche 12,50 €, la fiche 13,50 €. Le client le voit avant toi.

### Question de compréhension

`computeOrderTotalCents` est appelée et renvoie `4200`. Rien ne s'affiche, rien ne change. Quelle est la ligne la plus probable, et que manque-t-il ?

---

## A1.3 : la façade de données

### Image mentale

Une prise électrique murale. Ta lampe a une fiche standard. Derrière le mur, l'électricité peut venir d'un groupe électrogène (aujourd'hui) ou du réseau (demain). La lampe ne le sait pas. Le jour du branchement au réseau, l'électricien travaille derrière le mur ; personne ne touche à la lampe.

`src/data/orders.ts` est la prise murale. Le type `OrdersSource` est la forme standard de la fiche. `orders.mock.ts` est le groupe électrogène. La future implémentation Drizzle sera le réseau. Les pages sont les lampes.

Pour « module serveur vs module client, `server-only`, alias `@/` », relis le concept 2 de [jalon-1-concepts.md](jalon-1-concepts.md). Tout y est encore vrai.

### Mécanisme réel

**Le contrat.** `OrdersSource` décrit ce qu'une source de commandes doit savoir faire : `getOrders()` et `getOrder(id)`, tous deux asynchrones (ils renvoient une `Promise`, une valeur qui arrivera plus tard). Pourquoi asynchrones dès aujourd'hui, alors que les fixtures sont en mémoire ? Parce que la vraie base sera asynchrone. Si le mock était synchrone, le branchement obligerait à ajouter des `await` dans toutes les pages. Avec une petite latence simulée, les pages sont écrites une fois pour toutes, et tu vois le skeleton.

**La façade.** `src/data/orders.ts` contient une ligne clé :

```ts
const source: OrdersSource = ordersMock;
```

`: OrdersSource` : « je m'engage sur ce contrat ». `= ordersMock` : « aujourd'hui, c'est le mock qui le remplit ». Le jour du branchement, elle devient `= ordersDb`. Rien ne connaît `ordersMock` en dehors de ce fichier. Si le mock ne respecte pas le contrat, c'est sa déclaration qui refuse de compiler, pas une page au hasard.

**La règle : le front importe `@/data/orders`, jamais le mock.** Si une page importe `@/data/orders.mock`, tu as court-circuité la prise : au branchement, cette page continuera d'afficher des fixtures. Pour la repérer : `Ctrl + Maj + F` dans VS Code, cherche `orders.mock`. Il ne doit y avoir que `src/data/orders.ts` et les tests.

**`import "server-only"` dans la façade.** La façade parlera un jour à la base : elle est un module serveur dès aujourd'hui, pour que personne ne prenne l'habitude de l'importer dans un composant `"use client"`. Vérifié : le paquet `server-only` n'est pas dans `node_modules`, et ce n'est pas nécessaire ; Next déclare le module dans ses types et gère l'import. Tu n'installes rien.

**Pourquoi les tests n'importent jamais la façade.** Vitest n'est pas Next : `import "server-only"` est compris par le compilateur de Next ; sous Vitest, ce module n'existe pas, et le test échouerait sur `Cannot find module 'server-only'`. Et la façade, c'est du branchement, pas de la logique. On teste la logique : `src/domain/**` et le comportement du mock. Même séparation qu'entre `env-schema.ts` (testé) et `env.ts` (branchement).

**`session.ts`.** `getCurrentUser()` renvoie un utilisateur factice pour développer les écrans. La garde en liste blanche (« autorisé seulement si `development` ou `test`, sinon jette ») garantit qu'on ne déploiera jamais un back-office où tout le monde est connecté d'office. Sans elle, l'oubli serait silencieux : un faux gestionnaire en production.

### Extrait annoté

`src/data/orders.ts` :

```ts
import "server-only";                                   // 1. module serveur ; import côté client = erreur de build explicite
import type { OrdersSource } from "@/domain/orders/source";
import { ordersMock } from "@/data/orders.mock";       // 2. le SEUL fichier du projet autorisé à importer le mock

const source: OrdersSource = ordersMock;               // 3. la seule ligne qui changera au branchement

export const getOrders: OrdersSource["getOrders"] = () => source.getOrders();   // 4. les pages importent ceci
export const getOrder: OrdersSource["getOrder"] = (id) => source.getOrder(id);
```

Dans une page (Server Component, donc `async` autorisé) :

```ts
import { getOrders } from "@/data/orders";             // jamais "@/data/orders.mock"

export default async function CommandesPage() {
  const orders = await getOrders();                    // résultat STOCKÉ, puis affiché
  …
}
```

### Le piège à voir venir : une garde écrite à l'envers dans `readSimulationMode`

`readSimulationMode(raw, isDev)` lit un paramètre d'URL (`?simuler=vide` ou `?simuler=erreur`) pour tester les écrans « liste vide » et « erreur ». Ce mode ne doit exister qu'en développement : `isDev` est un booléen que la page lui passe. La fonction est pure : elle ne lit pas `process.env`, c'est la page qui le fait.

Une garde (un `if` qui fait sortir tôt) peut s'écrire dans le mauvais sens sans que TypeScript s'en aperçoive :

```ts
export function readSimulationMode(raw: string | string[] | undefined, isDev: boolean) {
  if (isDev) return null;            // à l'envers : désactive la simulation en développement, l'autorise en production
  if (raw === "vide" || raw === "erreur") return raw;
  return null;
}
```

Relis-la à voix haute : « si je suis en développement, je renvoie rien ». C'est l'inverse du besoin. La bonne garde est `if (!isDev) return null`. Tout compile dans les deux cas. Seul un test le voit, et il lui faut un cas de chaque côté de la frontière :

```ts
it("ignore le paramètre hors développement", () => {
  expect(readSimulationMode("vide", false)).toBeNull();     // 1. production : toujours null
});
it("lit un mode valide en développement", () => {
  expect(readSimulationMode("vide", true)).toBe("vide");    // 2. dev + valeur connue : la valeur
});
it("ignore une valeur inconnue en développement", () => {
  expect(readSimulationMode("plouf", true)).toBeNull();     // 3. dev + valeur inconnue : null
});
```

Avec la garde inversée, les cas 1 et 2 échouent. Avec seulement le cas 3, la garde inversée passerait : `null` dans les deux sens. L'architecte demande six cas (tableau, chaîne vide, `undefined` en plus) : même logique.

### Ce qui casse si on ne le fait pas, et comment tu le verrais

- Une page importe `@/data/orders.mock` : rien ne casse aujourd'hui. Au branchement, cette page montre des commandes de septembre 2026 alors que le reste montre la vraie base.
- La façade sans `server-only` : le jour où un composant client l'importe, soit tout part dans le navigateur, soit `Module not found: Can't resolve 'net'`. Avec la directive, le message dit quel fichier client importe un module serveur.
- Un test qui importe `@/data/orders` : `Cannot find module 'server-only'`. La solution n'est pas d'installer le paquet : c'est d'importer le mock ou le domaine.
- `readSimulationMode` avec `if (isDev)` : `?simuler=erreur` ne fait rien chez toi et affiche une fausse erreur à l'équipe du client en production.

### Question de compréhension

Le jour du branchement à la base du client, quels fichiers de `src/` seront modifiés ? Lesquels ne le seront pas, et grâce à quoi ?

---

## Mini-exercice de 5 minutes, sur papier

Dessine la chaîne d'imports entre ces six fichiers, avec une flèche « A importe B » : `src/app/(dashboard)/commandes/page.tsx`, `src/data/orders.ts`, `src/data/orders.mock.ts`, `src/domain/orders/fixtures.ts`, `src/domain/orders/types.ts`, `src/domain/orders/status.ts`.

Puis, pour chaque fichier, écris une lettre :

- **S** (serveur) : il porte `import "server-only"`, ou il touchera la base. Un composant `"use client"` ne doit jamais l'importer.
- **C** (client) : il porte `"use client"`.
- **N** (neutre) : du code pur, importable des deux côtés sans danger, testable sous Vitest.

Deux indices. Les flèches vont toujours dans le même sens, du plus haut niveau (la page) vers le plus bas (les types). Et un fichier neutre ne doit jamais importer un fichier serveur : si tu trouves une flèche N → S, quelque chose est mal rangé.

Quand tu as ton dessin, compare avec la règle des tests : les fichiers marqués N sont exactement ceux que tes `*.test.ts` ont le droit d'importer.

## Vérif : commandes lancées depuis `dashboard/` le 2026-09-07

| Commande | Résultat |
|---|---|
| `npm run typecheck` | Passe. |
| `npm run lint` | Passe. |
| `npm run test` | `No test files found, exiting with code 0`. Normal : aucun test n'existe encore. |
| `node -e "console.log(0.1 + 0.2)"` | `0.30000000000000004` ; `0.1 + 0.2 === 0.3` vaut `false`. |
| `node -e "console.log('2026-09-07' < '2026-09-08')"` | `true`. |
| `tsc --strict` sur un brouillon avec `const s: OrderStatus = "deliverd"` | `error TS2820 … Did you mean '"delivered"'?`. Sans `as const`, `"n_importe_quoi"` passe. |
| Doc locale `generate-metadata.md` | `default` obligatoire avec `template` ; le template ne s'applique qu'aux segments enfants. |
| Doc locale `05-server-and-client-components.md`, `next/types/global.d.ts` | `server-only` : installation optionnelle, géré et typé par Next. |

Une fois les fichiers de A1.0 à A1.3 écrits, lance `npm run check` depuis `dashboard/` et reviens avec le résultat, ton dessin, et tes réponses aux quatre questions. On relira ensemble, puis on passera aux concepts de A1.4 à A1.7.
