# Jalon A1 : consignes d'implémentation (A1.3 → A1.7)

**Jalon A1 clos le 2026-09-08** : toutes les étapes ci-dessous sont livrées et vérifiées. Ce fichier reste comme référence ; les consignes de A2 viendront dans `docs/a2-consignes.md`.

Mis à jour le 2026-09-08. A1.0 à A1.2 sont livrés. Tu implémentes, Claude corrige et écrit les tests dans `test/`. Toutes les commandes se lancent depuis `dashboard/`. Détails d'interface dans [a1-spec-ui.md](a1-spec-ui.md), détails backend dans [a1-spec-branchements.md](a1-spec-branchements.md) : ce fichier te dit quoi faire, ceux-là pourquoi en profondeur si tu en as besoin.

Règles valables partout : imports en `@/…`, `import type` pour un type, `"use client"` seulement là où un hook ou un error boundary l'exige.

---

## A1.3 : source de données, session, simulation

Objectif : le front lit des commandes via une façade, sans savoir que ce sont des fixtures. Le jour du branchement à la base, une seule ligne change.

### 1. `src/domain/orders/source.ts`

```ts
export type OrdersSource = {
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
};
```

Async dès maintenant : la vraie base le sera, on évite d'ajouter des `await` partout plus tard. `null` pour « introuvable » : c'est un cas métier normal, pas une panne, et `strict` force l'appelant à le traiter.

### 2. `src/data/orders.mock.ts`

- `export const MOCK_LATENCY_MS = 400;` et un petit `sleep(ms)` local (`new Promise` + `setTimeout`).
- `export const ordersMock: OrdersSource = { getOrders, getOrder };` avec les deux fonctions déclarées au-dessus.
- `getOrders` : attend la latence, renvoie `structuredClone([...ordersFixtures])`. `getOrder` : attend, `find` par id, clone ou `null`.

L'annotation `: OrdersSource` fait refuser par `tsc` toute méthode manquante. Le clone empêche un composant de muter les fixtures partagées. Ce fichier n'importe rien de `next/*` ni `server-only` : Vitest doit pouvoir le charger.

### 3. `src/data/orders.ts` (façade)

```ts
import "server-only";
import type { OrdersSource } from "@/domain/orders/source";
import { ordersMock } from "@/data/orders.mock";

const source: OrdersSource = ordersMock;

export const getOrders: OrdersSource["getOrders"] = () => source.getOrders();
export const getOrder: OrdersSource["getOrder"] = (id) => source.getOrder(id);
```

`server-only` : rien à installer, Next l'intercepte et fait échouer le build si un composant client importe ce module. Seul ce fichier importe le mock ; les pages importent `@/data/orders`.

### 4. `src/domain/auth/roles.ts`, `types.ts`, `guards.ts`

- `roles.ts` : `ROLES = ["admin", "gestionnaire", "lecture"] as const`, type `Role`, et `canChangeOrderStatus(role: Role): boolean` (vrai pour `admin` et `gestionnaire`).
- `types.ts` : `CurrentUser = { id: string; name: string; role: Role }`.
- `guards.ts` :

```ts
export function assertMockSessionAllowed(nodeEnv: string | undefined): void {
  const allowed = nodeEnv === "development" || nodeEnv === "test";
  if (!allowed) throw new Error("Session mock interdite hors development/test");
}
```

Liste blanche plutôt que `=== "production"` : une valeur inattendue tombe du côté sûr.

### 5. `src/data/session.ts`

`import "server-only"` en ligne 1, puis `export async function getCurrentUser(): Promise<CurrentUser>` qui appelle `assertMockSessionAllowed(process.env.NODE_ENV)` en première ligne et renvoie `{ id: "usr-demo", name: "Utilisateur démo", role: "gestionnaire" }`. En A7, `verifySession()` remplacera le corps sans changer la signature. Le stub plante en prod exprès : un back-office ouvert à tous par oubli est pire qu'une panne.

### 6. `src/lib/simulation.ts`

```ts
export type SimulationMode = "vide" | "erreur";
export function readSimulationMode(
  raw: string | string[] | undefined,
  isDev: boolean,
): SimulationMode | null;
```

Ordre des gardes : `!isDev` → `null` en premier ; `Array.isArray(raw)` → `null` ; `"vide"` ou `"erreur"` → la valeur ; sinon `null`. La page passera `process.env.NODE_ENV === "development"`.

### Vérif A1.3

```bash
npm run check
grep -rn "orders.mock" src            # une seule ligne attendue : src/data/orders.ts
head -1 src/data/orders.ts src/data/session.ts   # import "server-only";
```

Reviens à ce point : Claude corrige et écrit `test/domain/auth/guards.test.ts`, `test/lib/simulation.test.ts`, `test/data/orders.mock.test.ts`.

---

## A1.4 : coquille (layout, sidebar, pages vides)

### 1. Installer les composants

```bash
npx shadcn@latest add sidebar separator skeleton table badge empty
npm run format
```

Répondre non si la CLI propose d'écraser `button.tsx`. La commande crée aussi `sheet`, `tooltip`, `input` et `src/hooks/use-mobile.ts` ; vérifier `git diff src/app/globals.css` (normalement vide).

Dans `src/components/ui/sidebar.tsx`, traduire les quatre libellés lus par les lecteurs d'écran : `Sidebar` → `Menu de navigation`, `Displays the mobile sidebar.` → `Navigation principale du back-office.`, les deux `Toggle Sidebar` → `Afficher ou masquer le menu`.

### 2. `src/lib/navigation.ts`

`NAV_ITEMS as const` avec `{ title, href, icon }` pour Tableau de bord `/`, Commandes, Catalogue, Clients, Métriques (icônes lucide `LayoutDashboard`, `ShoppingBasket`, `Carrot`, `Users`, `ChartColumn`), et `isNavItemActive(pathname, href)` : égalité stricte pour `/`, sinon `pathname === href || pathname.startsWith(href + "/")`.

### 3. Composants, dans `src/components/`

| Fichier | Client ? | Contenu |
|---|---|---|
| `page-header.tsx` | non | `{ title, description?, actions? }` → un `h1` `text-xl font-semibold tracking-tight`, un `p` `text-sm text-muted-foreground`, les actions à droite (`flex-col gap-3 md:flex-row md:justify-between`). |
| `coming-soon.tsx` | non | `{ feature }` → `Empty className="min-h-[50vh] border"` avec `EmptyMedia variant="icon"` + `Hourglass`, titre « Bientôt disponible », description « {feature} arrive dans une prochaine version du back-office. » |
| `site-header.tsx` | non | `header` `flex h-12 items-center gap-2 border-b px-4` : `SidebarTrigger`, `Separator orientation="vertical" className="mx-1 data-vertical:h-4"`, `span` « FIG Back-office ». |
| `nav-main.tsx` | **oui** | `usePathname()` + `useSidebar().setOpenMobile`. `SidebarGroup` > `SidebarGroupLabel` « Navigation » > `SidebarGroupContent` > `<nav aria-label="Navigation principale">` > `SidebarMenu` > pour chaque item `SidebarMenuItem` > `SidebarMenuButton isActive={active} tooltip={item.title} onClick={() => setOpenMobile(false)} render={<Link href={item.href} aria-current={active ? "page" : undefined} />}` avec l'icône et le titre dedans. |
| `app-sidebar.tsx` | non | `Sidebar collapsible="icon"` : `SidebarHeader` (logo carré `size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground` avec `Carrot`, nom + sous-titre « Livraison de fruits et légumes »), `SidebarContent` > `NavMain`, `SidebarFooter` (`SidebarMenuButton size="lg" render={<div />}` avec `CircleUser`, « Utilisateur démo » / « Gestionnaire »), `SidebarRail`. |

Seul `nav-main.tsx` est client : `usePathname` est un hook. Le pied utilise un `div`, pas un bouton : un bouton focusable sans action est un piège clavier. `collapsible="icon"` plutôt qu'`offcanvas` : la navigation reste visible toute la journée et libère 13 rem pour le tableau.

### 4. Layout et pages, dans `src/app/(dashboard)/`

- `layout.tsx` (serveur, `LayoutProps<"/">`) : lien d'évitement `<a href="#contenu" className="sr-only focus:not-sr-only">Aller au contenu</a>` en premier, puis `SidebarProvider` > `AppSidebar` + `SidebarInset id="contenu" tabIndex={-1}` > `SiteHeader` + `<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>`.
- `page.tsx` (existant) : `PageHeader` « Tableau de bord » / « Vue d'ensemble de l'activité du jour. » + `ComingSoon feature="Le tableau de bord"`.
- `catalogue/page.tsx`, `clients/page.tsx`, `metriques/page.tsx` : même modèle, chacune avec `export const metadata: Metadata = { title: "Catalogue" }` etc. Titres et descriptions dans la table des textes de `a1-spec-ui.md` partie 1. Supprimer les `.gitkeep` devenus inutiles.
- `commandes/page.tsx` : `PageHeader` seul pour l'instant, la liste arrive en A1.6.

### Vérif A1.4

```bash
npm run check
npm run dev
# les 5 URLs répondent 200 ; Tab parcourt lien d'évitement → nav → trigger → contenu ;
# à 375 px la sidebar devient un panneau ; l'entrée active est marquée.
```

---

## A1.5 : formateurs

`src/lib/format.ts`, trois fonctions pures :

- `formatEuros(cents: number): string` → `new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)`.
- `formatDateFr(iso: string): string` → `Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" })` sur `new Date(iso)`. `new Date` est autorisé ici : on parse une valeur reçue, on n'en génère pas.
- `formatSlot(slot: { date; start; end }): string` → `${formatDateFr(slot.date)}, ${slot.start}–${slot.end}`.

Claude écrit `test/lib/format.test.ts` (les espaces insécables d'`Intl` y sont normalisés).

---

## A1.6 : liste des commandes et ses états

### 1. `src/components/orders/order-status-badge.tsx` (serveur)

`{ status: OrderStatus }` → `Badge` avec `ORDER_STATUS_LABELS[status]` et la variante : `pending` → `outline`, `confirmed` → `secondary`, `preparing` et `delivering` → `default`, `delivered` → `outline` + `text-muted-foreground`, `cancelled` → `destructive`. Le texte est toujours affiché : la couleur n'est jamais le seul signal.

### 2. `src/components/orders/orders-table.tsx` (serveur)

`{ orders: Order[] }` → `Table` avec `TableCaption className="sr-only"` « Liste des commandes triées par créneau de livraison. », sept colonnes dans cet ordre : Référence (`font-mono text-xs`), Client (`font-medium`), Créneau (`formatSlot`), Ville (`hidden md:table-cell`), Articles (`lines.length`, `hidden md:table-cell text-right tabular-nums`), Total (`formatEuros`, `text-right tabular-nums`), Statut (`OrderStatusBadge`). Les classes de masquage et d'alignement vont sur le `TableHead` **et** le `TableCell` de la colonne.

### 3. `src/app/(dashboard)/commandes/page.tsx` (serveur, async)

```ts
export default async function CommandesPage({ searchParams }: PageProps<"/commandes">) {
  const { simuler } = await searchParams;
  const mode = readSimulationMode(simuler, process.env.NODE_ENV === "development");
  if (mode === "erreur") throw new Error("Simulation d'erreur");
  const orders = mode === "vide" ? [] : await getOrders();
  // PageHeader, puis OrdersTable ou l'état vide
}
```

`searchParams` est une `Promise` en Next 16. État vide : `Empty` avec `Inbox`, « Aucune commande », « Les commandes passées dans l'application FIG apparaîtront ici. »

### 4. `commandes/loading.tsx` (serveur)

`PageHeader` réel + `<div aria-busy="true">` contenant le vrai `TableHeader` et six `TableRow` de `Skeleton` (`h-4 w-20`, `w-32`, `w-36`, `w-20`, `w-6 ml-auto`, `w-14 ml-auto`, `h-5 w-24 rounded-4xl`). Reproduire la grille évite le saut de mise en page.

### 5. `commandes/error.tsx` (**client**)

```ts
"use client";
export default function CommandesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) { … }
```

`useEffect(() => console.error(error), [error])`, puis `Empty` avec `RefreshCw`, « Impossible de charger les commandes », « Une erreur est survenue de notre côté. Réessayez dans un instant ; si le problème persiste, contactez l'administrateur. », `Button variant="outline" onClick={retry}` « Réessayer ». Jamais `error.message` à l'écran. `retry` est le nom Next 16 (`reset` existe encore, la doc dit `retry`).

### Vérif A1.6

```bash
npm run dev
curl -s localhost:3000/commandes | grep -c "cmd-"          # 14
curl -s "localhost:3000/commandes?simuler=vide" | grep -c "Aucune commande"   # 1
# ?simuler=erreur → message + bouton Réessayer ; skeleton visible ~400 ms
npm run build && npm run start
curl -s "localhost:3000/commandes?simuler=vide" | grep -c "Aucune commande"   # 0 : la simulation est inerte en prod
```

---

## A1.7 : contrat de branchement et commit

- `docs/branchements.md` : copier le gabarit de `a1-spec-branchements.md` § 6 et le remplir avec les fonctions et champs réellement consommés (`getOrders`, `getOrder`, `getCurrentUser` ; chaque champ d'`Order`). Les colonnes client restent « inconnue ».
- `npm run check`, `git status` (aucun `.env*` sauf `.env.example`), puis commit `feat: coquille du back-office et liste des commandes sur fixtures`.

Fin du jalon A1. Suite : A2 (filtres, détail, changement de statut via Server Action sur le mock mutable).
