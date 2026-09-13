# Jalon A2 : consignes d'implémentation (A2.0 → A2.8)

**Jalon A2 livré le 2026-09-13.** A2.1 et A2.2 codés par Zaki avec corrections, A2.3 à A2.8 codés par Claude à sa demande. Ce fichier reste comme référence et comme modèle de format pour A3.

Rédigé le 2026-09-08 après cadrage par l'équipe (tech-lead, security-backend-architect, ui-ux-designer). Tu implémentes, Claude corrige et écrit les tests dans `test/`. Toutes les commandes se lancent depuis `dashboard/`. Détails d'interface dans [a2-spec-ui.md](a2-spec-ui.md), détails sécurité et flux d'écriture dans [a2-spec-branchements.md](a2-spec-branchements.md) : ce fichier dit quoi faire, ceux-là pourquoi en profondeur.

**Objectif A2** : filtrer la liste par l'URL (`?statut=pending&date=2026-09-08`), ouvrir une commande sur `/commandes/[id]`, changer son statut via une première Server Action sur un mock devenu mutable. Critère d'acceptation (backlog) : une transition interdite est refusée avec un message français, le mock reflète le changement.

Règles valables partout : imports en `@/…`, `import type` pour un type, `"use client"` seulement dans `order-status-form.tsx` (imposé par `useActionState`). Un seul nouveau fichier client en A2.

**Arbitrages du tech-lead** (pour ne pas les rediscuter) :
- Clés d'URL en français (`statut`, `date`, comme `simuler`), clés de code en anglais (`status`, `date`) : le schéma zod fait la traduction.
- Le mock **compose** deux fonctions pures : `filterOrders` filtre, `sortOrdersBySlot` trie (créneau croissant). Une fonction nommée « filter » ne trie pas.
- `actions.ts` vit dans le dossier de la route `[id]/`, à côté de son unique consommateur.
- Formulaire de filtres en GET via `Form` de `next/form`, composant serveur. Pas de `router.replace`.
- La page de détail n'appelle pas `getCurrentUser()` en A2 : le stub lève hors dev/test, ce qui casserait le détail en `npm run start`. La garde de rôle vit dans l'action (frontière de confiance) ; le masquage du formulaire pour le rôle `lecture` arrive en A7 avec la vraie session.
- Composants shadcn : `card`, `label`, `native-select`. Pas de `select` base-ui (client, inutile en GET), pas de `alert` (un `<p role="status">` suffit).

---

## A2.0 : point de départ

1. Le passage de style est appliqué et vérifié mais non commité : dis « commit et push » et Claude s'en occupe.
2. Installer les composants :
   ```bash
   npx shadcn@latest add card label native-select
   npm run format
   ```
   Répondre **non** si la CLI propose d'écraser un fichier existant. Si `native-select` n'existe pas dans le registre base-nova : ne rien installer d'autre, écrire un `<select>` natif avec les classes de `input.tsx` (voir spec UI §0).

Vérif : `ls src/components/ui` montre `card.tsx`, `label.tsx`, `native-select.tsx` ; `npm run check` vert.

---

## A2.1 : machine d'états (`src/domain/orders/status.ts`)

Ajouter sous les libellés :

```ts
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean;
export function allowedTransitions(from: OrderStatus): OrderStatus[]; // copie : [...ORDER_TRANSITIONS[from]]
```

Pourquoi un `Record` en liste blanche : tout ce qui n'est pas listé est refusé, et `tsc` refuse un statut sans entrée. `from → from` est faux : rester au même statut n'est pas une transition (le cas « déjà à ce statut » se traite dans l'action). `delivering → cancelled` refusé et aucun retour arrière : ce sont des questions client (Q4, Q7/Q9), notées dans `branchements.md`, pas des décisions à prendre seul.

Vérif : `npx vitest run test/domain/orders/status.test.ts` vert (Claude écrit le test : les 36 couples, terminaux sans sortie, cohérence `allowedTransitions` ↔ `canTransition`).

---

## A2.2 : règles pures, schémas d'entrée, formateurs

### 1. `src/domain/orders/types.ts`

```ts
export type OrderFilters = { status?: OrderStatus; date?: string }; // date = deliverySlot.date, AAAA-MM-JJ
```

### 2. `src/domain/orders/rules.ts`

```ts
export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[];
export function sortOrdersBySlot(orders: readonly Order[]): Order[];
```

`filterOrders` : garde une commande si (`status` absent ou égal) et (`date` absente ou égale à `deliverySlot.date`). `sortOrdersBySlot` : tri par `deliverySlot.date`, puis `start`, puis `reference` (stabilité) ; via `toSorted` (ES2023, connu de `tsc` grâce à `lib: esnext` et de Node 20.9+ exigé par Next) : copie triée garantie, et accepte un `readonly Order[]` là où `sort` est refusé. Les deux renvoient un nouveau tableau : le résultat se stocke.

### 3. `src/domain/orders/schemas.ts` (nouveau)

```ts
import { z } from "zod";

export const orderIdSchema = z.string().trim().min(1).max(64);

export const changeStatusSchema = z.object({
  orderId: orderIdSchema,
  nextStatus: z.enum(ORDER_STATUSES),
});

export const orderFiltersSchema = z
  .object({
    statut: z.enum(ORDER_STATUSES).optional().catch(undefined),
    date: z.iso.date().optional().catch(undefined),
  })
  .transform(({ statut, date }) => ({ status: statut, date }));

export function parseOrderFilters(raw: Record<string, string | string[] | undefined>): OrderFilters;
```

Pourquoi : les seuls schémas zod du domaine valident des **entrées** (URL, `FormData`). En lecture, une valeur invalide est **ignorée** (`.catch(undefined)`) : un lien mal tapé affiche la liste complète, jamais une page cassée. Un paramètre répété (`?statut=a&statut=b`) arrive en tableau, échoue sur l'enum et tombe aussi dans `catch`. En écriture, `changeStatusSchema` est strict : pas de `catch`. Pas de regex sur `orderId` : le format des ids appartient au client (B2).

zod v4 : `z.enum(ORDER_STATUSES)` accepte le tuple `as const` tel quel ; `safeParse` → `{ success, data } | { success, error }` ; `error.issues` (plus `.errors`).

### 4. `src/lib/format.ts`

```ts
export function formatQuantity(quantity: number, unit: "piece" | "g"): string; // "500 g", "1,5 kg", "1 pièce", "3 pièces"
export function formatOrdersCount(count: number): string;                      // "1 commande", "5 commandes"
```

`g` sous 1000 → « 500 g » ; sinon division par 1000 avec `Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })` + « kg ». Espace insécable (` `) entre nombre et unité. Union inline plutôt qu'un import du domaine : `src/lib` reste sans dépendance vers `src/domain`.

Vérif : `npx vitest run test/domain/orders test/lib` vert (Claude : `rules.test.ts` étendu, `schemas.test.ts`, `format.test.ts` étendu). Attendus sur les fixtures : `status: "pending"` → 3 commandes ; `date: "2026-09-08"` → 5 ; les deux → 2 ; premier trié = `cmd-0007`, dernier = `cmd-0012`. `grep -rn 'from "\.\.' src` vide.

---

## A2.3 : contrat et mock mutable

Format des consignes à partir d'ici (demande du 2026-09-13) : chaque point est une instruction d'implémentation, suivie d'une phrase sur ce que fait la ligne et pourquoi.

### 1. `src/domain/orders/source.ts`

1. Ajouter `import type { OrderFilters } from "@/domain/orders/types"` et `import type { OrderStatus } from "@/domain/orders/status"`. Le contrat ne manipule que des types : `import type` disparaît à la compilation, aucune dépendance à l'exécution.
2. Changer `getOrders()` en `getOrders(filters?: OrderFilters)`. Paramètre optionnel : la page sans filtre continue d'appeler `getOrders()` sans argument.
3. Ajouter `updateOrderStatus(id: string, from: OrderStatus, to: OrderStatus): Promise<Order | null>`. `from` est le statut attendu au moment de l'écriture ; `null` signifie « rien n'a été écrit » (id absent ou statut déjà changé).
4. Retirer la ligne de commentaire « A2 : updateOrderStatus… », devenue vraie.
5. Lancer `npm run typecheck` : il **doit** échouer sur `orders.mock.ts` (« Property 'updateOrderStatus' is missing »). C'est le contrat qui travaille : une implémentation incomplète casse à la déclaration, pas au premier appel.

### 2. `src/data/orders.mock.ts`

`Map` : structure clé → valeur avec `set(clé, valeur)`, `get(clé)` (valeur ou `undefined`), `values()`, `clear()`. Typée `Map<string, Order>` : la clé est l'id, la valeur est **une** commande.

1. Importer `filterOrders` et `sortOrdersBySlot` depuis `@/domain/orders/rules`, et en `import type` : `Order`, `OrderFilters` depuis `types`, `OrderStatus` depuis `status`.
2. Au-dessus de `ordersMock`, créer `const store = new Map<string, Order>();`. C'est la « table » en mémoire : un objet par id, modifiable, partagé par tout le processus serveur.
3. Créer une fonction locale `function seed(): void` dont le corps fait `store.clear()`, puis une boucle `for (const order of ordersFixtures)` qui appelle `store.set(order.id, structuredClone(order))`. Le clone à l'entrée sépare le store des fixtures : une écriture dans le store ne touche jamais `ordersFixtures`, que les tests lisent aussi.
4. Appeler `seed();` une fois, juste après sa déclaration. C'est le remplissage au chargement du module ; à chaque redémarrage du serveur on repart des fixtures, c'est voulu.
5. Réécrire `getOrders` avec la signature `async (filters: OrderFilters = {})`. Corps : la latence, puis `const all = [...store.values()]` (le spread transforme l'itérateur en tableau), puis `const result = sortOrdersBySlot(filterOrders(all, filters))`, puis `return structuredClone(result)`. Filtrer avant de trier réduit ce qu'il y a à trier ; le clone à la sortie empêche un composant de modifier le store par référence.
6. Réécrire `getOrder` : latence, `const order = store.get(id)`, puis `return order ? structuredClone(order) : null`. Lire la `Map` et plus les fixtures : sinon une mise à jour ne serait jamais visible.
7. Ajouter `updateOrderStatus` avec la signature `async (id: string, from: OrderStatus, to: OrderStatus)`. Corps : la latence, `const current = store.get(id)`, puis la garde `if (!current || current.status !== from) return null;`, puis `current.status = to;`, puis `return structuredClone(current)`. On modifie l'objet **du store** (c'est le but), et la garde est la mise à jour conditionnelle : si un collègue a changé le statut entre la lecture et l'écriture, `from` ne correspond plus et on n'écrase rien. C'est le `UPDATE … WHERE id = $1 AND status = $2` que fera la base en B5. Pas de `canTransition` ici : la règle appartient à l'action.
8. Sous l'objet `ordersMock`, ajouter `export function resetOrdersMock(): void { seed(); }`. Hors contrat : réservée aux tests pour repartir propre avant chaque cas ; la façade ne la réexporte pas.
9. Mettre le commentaire d'en-tête au présent (la `Map`, la mise à jour conditionnelle, `resetOrdersMock` hors contrat).

Vérif : `npm run typecheck` vert ; `grep -n "ordersFixtures" src/data/orders.mock.ts` ne montre que l'import et `seed()`.

### 3. `src/data/orders.ts`

1. Changer `getOrders` en `(filters) => source.getOrders(filters)`. La façade transmet, elle ne décide rien.
2. Ajouter `export const updateOrderStatus: OrdersSource["updateOrderStatus"] = (id, from, to) => source.updateOrderStatus(id, from, to);`. Même patron que les deux autres : le type vient du contrat, l'implémentation reste cachée.
3. Ne **pas** réexporter `resetOrdersMock`. Ce qui n'est pas dans le contrat n'existe pas pour le reste de l'app.

Vérif : `npm run typecheck` vert ; `npx vitest run test/data` vert (Claude met à jour `orders.mock.test.ts`) ; `grep -rn "resetOrdersMock" src` → uniquement `orders.mock.ts`.

---

## A2.4 : page de détail en lecture

Avant : `npx shadcn@latest add card label native-select` puis `npm run format` (A2.0) si ce n'est pas fait.

### 1. `src/components/orders/order-detail.tsx` (serveur)

1. Importer `Card`, `CardHeader`, `CardTitle`, `CardContent` depuis `@/components/ui/card`, les composants `Table*` depuis `@/components/ui/table`, `OrderStatusBadge`, `formatDateFr`, `formatEuros`, `formatQuantity`, `allowedTransitions`, et en `import type` `Order`.
2. Déclarer `export function OrderDetail({ order }: { order: Order })`. Composant serveur : il reçoit une commande déjà chargée et ne fait que l'afficher.
3. Rendre `<div className="grid gap-4 lg:grid-cols-3">` avec quatre `Card` dans cet ordre : Client, Livraison, Statut (`className="lg:row-span-2"`), Articles (`className="lg:col-span-2"`). Le palier est `lg` et non `md` : à 768 px avec la sidebar dépliée, trois colonnes seraient trop étroites. Ordre DOM = ordre visuel pour les lecteurs d'écran.
4. Chaque carte : `CardHeader` > `CardTitle` contenant un `<h2>` (« Client », « Livraison », « Statut », « Articles »). La page a un seul `h1` (PageHeader), les cartes sont des `h2`.
5. Carte Client : `CardContent` > `<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">` avec trois paires `dt`/`dd` : « Nom » / `order.customer.fullName` ; « E-mail » / un `<a href={`mailto:${order.customer.email}`}>` ; « Téléphone » / un `<a href={`tel:${…}`}>` où le `href` retire les espaces et remplace le `0` initial par `+33`, le texte affiché reste le numéro tel quel. `dt` en `text-muted-foreground`, `dd` en `font-medium`. Une liste de définitions dit « libellé → valeur » à un lecteur d'écran.
6. Carte Livraison : même `<dl>`. « Date » / `formatDateFr(order.deliverySlot.date)` ; « Créneau » / `${start}–${end}` ; « Adresse » / `${order.deliveryPostalCode} ${order.deliveryCity}`.
7. Carte Statut : `CardContent className="flex flex-col gap-4"`. Première ligne `<OrderStatusBadge status={order.status} />`. Puis `const allowed = allowedTransitions(order.status);` calculé **dans le composant** (côté serveur). Si `allowed.length === 0`, rendre `<p className="text-muted-foreground text-sm">Statut final : aucune transition possible.</p>` ; sinon, en A2.4, un commentaire `{/* A2.6 : OrderStatusForm */}`. Le client ne décide jamais des options : elles viennent du serveur.
8. Carte Articles : `CardContent className="p-0"` (le tableau touche les bords). `Table` > `TableCaption className="sr-only"` « Articles de la commande {order.reference}. » > en-tête « Produit », « Quantité » (`text-right`), « Total » (`text-right`) > une `TableRow` par ligne avec `productName`, `formatQuantity(line.quantity, line.unit)` en `text-right tabular-nums`, `formatEuros(line.lineTotalCents)` idem, `key={line.productId}` > `TableFooter` > `TableRow` > `TableCell colSpan={2} className="font-medium"` « Total » + `TableCell className="text-right font-medium tabular-nums"` `formatEuros(order.totalCents)`.

### 2. `src/app/(dashboard)/commandes/[id]/page.tsx` (serveur, async)

Route dynamique : le dossier `[id]` fait de `/commandes/cmd-0001` un appel de cette page avec `params` = `{ id: "cmd-0001" }`. En Next 16, `params` est une `Promise`.

1. Importer `notFound` depuis `next/navigation`, `Metadata` en type, `getOrder` depuis `@/data/orders`, `orderIdSchema`, `PageHeader`, `OrderDetail`, `Button`, `Link`, `ArrowLeft`, `formatSlot`.
2. `export const metadata: Metadata = { title: "Détail de la commande" };`. Statique : un titre avec la référence obligerait un second `getOrder` (parking).
3. Déclarer `export default async function CommandePage({ params }: PageProps<"/commandes/[id]">)`. Le type est généré par `next dev` ou `npx next typegen`.
4. `const { id } = await params;` puis `const parsed = orderIdSchema.safeParse(id);` puis `if (!parsed.success) notFound();`. Un `params` est une entrée hostile comme un `FormData` ; `notFound()` lève et affiche `not-found.tsx` : pas de `return` devant, jamais dans un `try/catch`.
5. `const order = await getOrder(parsed.data);` puis `if (!order) notFound();`. Après cette ligne, `tsc` sait que `order` n'est pas `null`.
6. Rendre `PageHeader` avec `title={`Commande ${order.reference}`}`, `description={`${order.customer.fullName} · ${formatSlot(order.deliverySlot)}`}` et `actions={<Button variant="outline" size="sm" render={<Link href="/commandes" />}><ArrowLeft /> Retour aux commandes</Button>}`. Texte du retour toujours visible : une flèche seule n'a pas de sens pour un lecteur d'écran.
7. Rendre `<OrderDetail order={order} />` sous l'en-tête.

### 3. `[id]/not-found.tsx` (serveur, sans props)

1. Déclarer `export default function CommandeNotFound()` sans paramètre.
2. Rendre `Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed"` > `EmptyHeader` > `EmptyMedia variant="icon"` (mêmes classes dégradé que `coming-soon.tsx`) > `<PackageSearch />` ; `EmptyTitle` « Commande introuvable » ; `EmptyDescription` « Cette commande n'existe pas ou n'est plus disponible. Vérifiez la référence ou revenez à la liste. » ; `EmptyContent` > `Button variant="outline" render={<Link href="/commandes" />}` « Retour aux commandes ». Pas de `PageHeader` : rien à titrer pour une ressource absente.

### 4. `[id]/loading.tsx` (serveur)

1. Rendre un conteneur `<div aria-busy="true">` avec `<p className="sr-only">Chargement de la commande…</p>`. `aria-busy` prévient le lecteur d'écran que la zone est en cours de chargement.
2. Reproduire la structure de `PageHeader` sans l'utiliser (le titre est inconnu) : `Skeleton className="h-8 w-64"`, le trait réel `bg-gradient-brand h-1 w-10 rounded-full`, `Skeleton className="h-4 w-72"`, et à droite `Skeleton className="h-8 w-44"`.
3. Rendre la même grille `grid gap-4 lg:grid-cols-3` avec quatre `Card` **réelles** (mêmes `col-span`/`row-span`) contenant des `Skeleton` : Client et Livraison, `h-5 w-20` dans le header puis trois `h-4` (`w-40`, `w-56`, `w-32`) ; Statut, `h-5 w-24 rounded-4xl`, `h-4 w-28`, `h-8 w-full`, `h-8 w-40` ; Articles, `h-5 w-20` puis un `Table` avec le vrai `TableHeader` et trois lignes de `Skeleton h-4`. Cartes réelles plutôt que des rectangles : le cadre ne bouge pas à l'arrivée des données.
4. Pas d'`error.tsx` ici : celui de `commandes/` couvre le segment enfant.

### 5. `src/components/orders/orders-table.tsx`

1. Importer `Link` depuis `next/link`.
2. Dans la cellule Référence, remplacer le texte par `<Link href={`/commandes/${order.id}`} className="text-foreground font-medium underline-offset-4 hover:underline focus-visible:underline">{order.reference}</Link>` et retirer `text-muted-foreground` de la cellule. Un lien doit passer le contraste texte (4,5:1) ; le soulignement au survol et au focus le distingue des cellules mortes.
3. Ne pas rendre la ligne cliquable : un `<tr>` n'est ni focusable ni annoncé comme lien. Une seule cible au clavier, la référence.

Vérif : `npx next typegen && npm run typecheck` vert ; avec le dev sur 3000 :
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/commandes/cmd-0003   # 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/commandes/cmd-9999   # 404
curl -s localhost:3000/commandes | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l   # 14
```

---

## A2.5 : résultat d'action et Server Action

### 1. `src/lib/action-result.ts` (pur, aucun import)

1. Déclarer `export type ActionResult = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };`. Union discriminée sur `status` : après `if (result.status === "error")`, `tsc` sait que `message` existe.
2. Déclarer `export const idleActionResult: ActionResult = { status: "idle" };`. C'est l'état initial passé à `useActionState`.
3. Aucun import Next dans ce fichier : le composant client et les tests doivent pouvoir le charger. Attention en lisant l'action : `result.status` (ActionResult) et `order.status` (OrderStatus) n'ont rien à voir.

### 2. `src/app/(dashboard)/commandes/[id]/actions.ts`

Server Action : fonction qui s'exécute sur le serveur mais qu'un formulaire peut appeler. C'est un POST public : tout ce qu'elle reçoit est hostile, et elle revérifie session et rôle à chaque appel, même si la page l'a déjà fait.

1. Première ligne du fichier : `"use server";`. Elle s'applique à tout le fichier : n'y mettre que des actions.
2. Importer `revalidatePath` depuis `next/cache`, `getCurrentUser` depuis `@/data/session`, `canChangeOrderStatus`, `getOrder` et `updateOrderStatus` depuis `@/data/orders`, `changeStatusSchema`, `canTransition`, `ORDER_STATUS_LABELS`, et en type `ActionResult`.
3. Déclarer une constante locale `MESSAGES` avec les textes français figés (droits, statut invalide, introuvable, déjà à ce statut, conflit, panne). Jamais `error.message` ni une valeur reçue reflétée telle quelle : on n'affiche que des libellés issus de l'enum validé.
4. Déclarer `export async function changeOrderStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult>`. Le premier paramètre est l'état précédent, imposé par `useActionState` ; on ne s'en sert pas, d'où le `_`.
5. Étape 1 : `const user = await getCurrentUser();`. Hors dev/test le stub lève : panne visible plutôt que back-office ouvert.
6. Étape 2 : `if (!canChangeOrderStatus(user.role)) return { status: "error", message: MESSAGES.forbidden };`. Avant zod : un appelant non autorisé n'obtient aucune information de validation.
7. Étape 3 : `const parsed = changeStatusSchema.safeParse(Object.fromEntries(formData));` puis `if (!parsed.success) return { status: "error", message: MESSAGES.invalid };`. `Object.fromEntries` transforme le `FormData` en objet simple. Avant toute lecture : la source ne reçoit jamais une valeur non validée.
8. `const { orderId, nextStatus } = parsed.data;` puis ouvrir un `try {`.
9. Étape 4 : `const order = await getOrder(orderId);` puis `if (!order) return { status: "error", message: MESSAGES.notFound };`. On relit l'état réel au lieu de croire un statut envoyé par le formulaire.
10. Étape 5 : `if (order.status === nextStatus) return { status: "success", message: MESSAGES.alreadySet };`. Rejouer la même demande ne fait rien : double clic et rafraîchissement deviennent inoffensifs.
11. Étape 6 : `const allowed = canTransition(order.status, nextStatus);` puis `if (!allowed) return { status: "error", message: `Le passage de « ${ORDER_STATUS_LABELS[order.status]} » à « ${ORDER_STATUS_LABELS[nextStatus]} » n'est pas autorisé.` };`. Résultat **stocké** puis testé ; les libellés viennent de l'enum, pas de l'entrée.
12. Étape 7 : `const updated = await updateOrderStatus(order.id, order.status, nextStatus);` puis `if (!updated) { revalidatePath("/commandes", "layout"); return { status: "error", message: MESSAGES.conflict }; }`. Le `from` passé est `order.status` **relu**, jamais une valeur du client ; `null` = quelqu'un a changé le statut entre la lecture et l'écriture, on rafraîchit au lieu d'écraser.
13. Étape 8 : `revalidatePath("/commandes", "layout");`. Un seul appel couvre la liste et toutes les pages de détail dessous.
14. Étape 9 : `return { status: "success", message: `Statut mis à jour : ${ORDER_STATUS_LABELS[nextStatus]}.` };`.
15. Fermer le `try` avec `} catch (error) { console.error("[changeOrderStatus]", { userId: user.id, orderId }); return { status: "error", message: MESSAGES.failure }; }`. Le log ne contient ni nom ni e-mail ; le client reçoit un message générique. Rien d'autre dans un `try/catch` : les étapes 1 à 3 ne lèvent pas, sauf le stub, volontairement.

Vérif : `npm run check` vert ; `head -1 "src/app/(dashboard)/commandes/[id]/actions.ts"` → `"use server";` ; `grep -n "currentStatus" "src/app/(dashboard)/commandes/[id]/actions.ts"` vide ; `grep -rn "orders.mock" src` → une ligne.

---

## A2.6 : formulaire de statut (`useActionState`)

`useActionState` : hook React qui relie un formulaire à une Server Action. Il renvoie `[result, formAction, pending]` : le dernier `ActionResult` reçu, la fonction à donner à `<form action>`, et un booléen vrai pendant l'aller-retour serveur.

### 1. `src/components/orders/order-status-form.tsx`

1. Première ligne : `"use client";`. Imposé par le hook. Seul nouveau fichier client de A2.
2. Importer `useActionState` depuis `react`, `changeOrderStatus` depuis `@/app/(dashboard)/commandes/[id]/actions`, `idleActionResult`, `ORDER_STATUS_LABELS`, `Label`, `NativeSelect` (ou `<select>` natif), `Button`, `cn`, les icônes `LoaderCircle`, `CircleCheck`, `CircleAlert`, et en type `OrderStatus`. Jamais `@/data/*` : ce fichier part dans le navigateur.
3. Déclarer les props `{ orderId: string; currentStatus: OrderStatus; allowed: OrderStatus[] }` et `export function OrderStatusForm({ orderId, currentStatus, allowed }: Props)`.
4. `const [result, formAction, pending] = useActionState(changeOrderStatus, idleActionResult);`.
5. Déclarer `function confirmIfCancelling(event: React.FormEvent<HTMLFormElement>)` : `const next = new FormData(event.currentTarget).get("nextStatus");` puis `if (next === "cancelled" && !window.confirm("Annuler cette commande ? Le client ne sera pas livré.")) event.preventDefault();`. Annuler est destructif : on demande confirmation avant d'envoyer.
6. Rendre `<form action={formAction} onSubmit={confirmIfCancelling} className="flex flex-col gap-3">`.
7. Dedans, `<input type="hidden" name="orderId" value={orderId} />`. C'est le seul moyen pour l'action de savoir de quelle commande il s'agit ; elle le revalide.
8. Puis `<Label htmlFor="nextStatus">Nouveau statut</Label>` et `<NativeSelect key={currentStatus} id="nextStatus" name="nextStatus" required defaultValue="">` avec une première `<option value="" disabled>Choisir un statut</option>` puis `allowed.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)`. Option vide + `required` : sans elle, le premier statut est présélectionné et un clic réflexe change la commande. `key={currentStatus}` sur le **select** : après un succès, la page se re-rend avec un nouveau statut, la `key` remet « Choisir un statut » sans effacer le message (une `key` sur le `<form>` remonterait le hook).
9. Puis `<Button type="submit" disabled={pending}>` avec, si `pending`, `<LoaderCircle className="animate-spin" />` et « Enregistrement… », sinon « Changer le statut ». Désactivé pendant l'envoi : pas de double soumission ; le texte change aussi, la couleur n'est jamais le seul signal.
10. Puis `<p role="status" className={cn("flex items-center gap-1.5 text-sm", result.status === "success" && "text-success", result.status === "error" && "text-destructive")}>` **toujours rendu**, avec l'icône et `result.message` quand `result.status !== "idle"`. Un lecteur d'écran n'annonce que les changements d'une région live déjà présente dans le DOM.

### 2. `src/components/orders/order-detail.tsx`

1. Remplacer le commentaire `A2.6` par `<OrderStatusForm orderId={order.id} currentStatus={order.status} allowed={allowed} />`. `allowed` reste calculé côté serveur ; l'action le recalcule de toute façon.

Vérif dans le navigateur : `cmd-0001` « En attente → Confirmée », message de succès, badge mis à jour, la liste affiche « Confirmée ». Deux onglets sur `cmd-0002` : changer dans le premier, soumettre le second → message de conflit. Via l'inspecteur, ajouter `<option value="delivered">` sur une `pending` → refus FR, statut inchangé. `grep -rln '"use client"' src/components src/app` → `nav-main.tsx`, `commandes/error.tsx`, `order-status-form.tsx`, `ui/*` et rien d'autre.

---

## A2.7 : filtres dans l'interface

`next/form` : le composant `Form` de Next. En GET, les champs deviennent les paramètres d'URL comme un `<form method="get">`, mais la navigation est faite côté client et `loading.tsx` s'affiche pendant le chargement. Composant serveur, aucun hook.

### 1. `src/components/orders/orders-filters.tsx` (serveur)

1. Importer `Form` depuis `next/form`, `Link`, `Label`, `NativeSelect`, `Input`, `Button`, `ORDER_STATUSES`, `ORDER_STATUS_LABELS`, et en type `OrderFilters`.
2. Déclarer `export function OrdersFilters({ filters }: { filters: OrderFilters })`. Il reçoit les filtres déjà validés par `parseOrderFilters`, jamais l'URL brute.
3. Rendre `<Form action="/commandes" aria-label="Filtres des commandes" className="flex flex-col gap-3 md:flex-row md:items-end">`.
4. Premier bloc `<div className="grid gap-1.5 md:w-48">` : `<Label htmlFor="statut">Statut</Label>` et `<NativeSelect id="statut" name="statut" defaultValue={filters.status ?? ""}>` avec `<option value="">Tous les statuts</option>` puis `ORDER_STATUSES.map(...)`. `name="statut"` en français : c'est la clé d'URL que `orderFiltersSchema` attend. `defaultValue` préremplit depuis l'URL courante.
5. Deuxième bloc, même `div` : `<Label htmlFor="date">Date de livraison</Label>` et `<Input id="date" type="date" name="date" defaultValue={filters.date ?? ""} className="dark:scheme-dark" />`. Libellé visible : un champ date n'a pas de placeholder ; `scheme-dark` évite l'icône calendrier noire sur fond sombre.
6. Troisième bloc `<div className="flex gap-2">` : `<Button type="submit">Filtrer</Button>`, puis, seulement si `filters.status !== undefined || filters.date !== undefined`, `<Button variant="ghost" render={<Link href="/commandes" />}>Réinitialiser</Button>`. Un lien et non `type="reset"` : `reset` vide le formulaire, pas l'URL.

### 2. `src/app/(dashboard)/commandes/page.tsx`

1. Importer `parseOrderFilters`, `formatOrdersCount`, `OrdersFilters`, `SearchX`, `EmptyContent`, `Button`, `Link`.
2. Remplacer `const { simuler } = await searchParams;` par `const raw = await searchParams;` puis `const mode = readSimulationMode(raw.simuler, process.env.NODE_ENV === "development");` et `const filters = parseOrderFilters(raw);`. Une seule lecture de l'URL, deux usages.
3. Remplacer `await getOrders()` par `await getOrders(filters)`.
4. Ajouter `const isFiltered = filters.status !== undefined || filters.date !== undefined;`. Sert à choisir l'état vide.
5. Sous `PageHeader`, rendre `<div className="flex flex-col gap-4">` contenant `<OrdersFilters filters={filters} />`, puis `<p role="status" className="text-muted-foreground text-sm">{formatOrdersCount(orders.length)}</p>`, puis le tableau ou l'état vide. `role="status"` annonce le nouveau compte après chaque filtrage.
6. État vide : si `orders.length === 0 && isFiltered`, un `Empty` avec `<SearchX />`, `EmptyTitle` « Aucune commande ne correspond », `EmptyDescription` « Modifiez les filtres ou réinitialisez-les pour revoir toutes les commandes. », `EmptyContent` > `Button variant="outline" render={<Link href="/commandes" />}` « Réinitialiser les filtres » ; sinon l'état vide A1 inchangé. Deux messages différents : « rien ne correspond » et « rien du tout » n'appellent pas la même action.

### 3. `commandes/loading.tsx`

1. Avant le tableau squelette, ajouter la silhouette de la barre : deux blocs `Skeleton className="h-4 w-16"` + `Skeleton className="h-8 w-full md:w-48"`, et un `Skeleton className="h-8 w-20"`, dans le même conteneur `flex flex-col gap-3 md:flex-row md:items-end`. `loading.tsx` ne connaît pas l'URL, il montre la forme.

Vérif :
```bash
curl -s "localhost:3000/commandes?statut=pending" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l          # 3
curl -s "localhost:3000/commandes?date=2026-09-08" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l        # 5
curl -s "localhost:3000/commandes?statut=pending&date=2026-09-08" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l   # 2
curl -s "localhost:3000/commandes?statut=foo" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l              # 14 (ignoré)
curl -s "localhost:3000/commandes?statut=delivered&date=2026-09-08" | grep -c "Aucune commande ne correspond"         # 1
```

---

## A2.8 : clôture

- `docs/branchements.md` : consommateurs `[id]/page.tsx` et `[id]/actions.ts`, tri par créneau (fait), trois questions client sur la matrice (Claude).
- Glossaire : machine d'états, route dynamique, `notFound()`, `revalidatePath`, compare-and-set, `next/form` (Claude).
- `npm run check` vert ; `npm run build` compile ; `npm run start -p 3124` : `/commandes?statut=pending` → 3 liens, `/commandes/cmd-0001` → 200, `?simuler=erreur` inerte.
- Commit : `feat(a2): filtres, détail et changement de statut des commandes sur mock mutable`.

---

## Points de vigilance

- **Imports relatifs** : `[id]/` est profond, la tentation `../../../components` est forte. `grep -rn 'from "\.\.' src` vide à chaque étape.
- **Résultat pur non stocké** : `canTransition(order.status, next);` seul ne protège rien ; `sortOrdersBySlot(orders);` sans affectation ne trie rien.
- **Gardes** : `if (!order) notFound()`, `if (!parsed.success)`, `if (!canChangeOrderStatus(user.role))`. Relire le sens de chaque `if`.
- **Statut envoyé par le formulaire** : l'action ne lit que `orderId` et `nextStatus` ; le `from` de `updateOrderStatus` vient de `getOrder`, jamais d'un champ caché.
- **`"use server"`** s'applique au fichier entier : rien d'autre que des actions dans `actions.ts`, et la première ligne de chaque action est `getCurrentUser()`.
- **`sort()` mute** : utiliser `toSorted`, jamais `sort` sur un paramètre.
- **shadcn** : `npm run format` après `add`, relire le diff de `globals.css`.

## Parking

- Recherche texte (référence, client) → A5. Auto-soumission des filtres, pagination, tri par colonne, filtre par ville.
- Statut « échec de livraison » (aujourd'hui `delivering → cancelled` refusé), retour arrière réservé à `admin` : questions client Q4, Q7/Q9.
- Masquer le formulaire de statut pour le rôle `lecture` (A7, avec `verifySession()`).
- `AlertDialog` à la place de `window.confirm` ; toast `sonner` ; `generateMetadata` avec la référence (exige `cache()` sur `getOrder`) ; `error.tsx` propre à `[id]` ; fil d'Ariane ; « Commandée le … » (`createdAt`).
- Journal des changements de statut (qui, quand) → B6.
- Règle ESLint `no-restricted-imports` sur `orders.mock` et `resetOrdersMock`.
