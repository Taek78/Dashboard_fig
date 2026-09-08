# Jalon A1 : spécification UI « Coquille + liste des commandes »

Rédigée par l'agent `ui-ux-designer` le 2026-09-07 sur le brief A du tech lead. Zaki écrit le code ; ce document dit quoi construire et pourquoi. Arbitrage du tech lead : le template de titre est `"%s · FIG Back-office"` (point médian) et non `" | "`.

Faits vérifiés avant de spécifier :

- `import { cn } from "cn"` dans `button.tsx` n'est pas une erreur : `cn` est un vrai paquet npm installé par shadcn v4, et `src/lib/utils.ts` le réexporte. Ne pas le « corriger ».
- Le layout racine est encore en `lang="en"` avec les métadonnées du template : à corriger en A1.0.
- Convention Next 16 vérifiée dans la doc locale `error.md` : la prop s'appelle `retry` (`reset` existe encore, la doc dit d'utiliser `retry`).
- `SidebarMenuButton` (base-nova) pose `data-active` quand `isActive` est vrai, mais pas `aria-current`. À poser à la main sur le `Link`.
- Le registre `sidebar` ne déclare aucun `cssVars` : les tokens `--sidebar-*` sont déjà dans `globals.css`.
- `table.tsx` base-nova commence par `"use client"` : le tableau est une frontière client, mais la page reste serveur et lui passe des props sérialisables.

## 0. Installation des composants

Depuis `dashboard/` :

```bash
npx shadcn@latest add sidebar separator skeleton table badge empty
npm run format
```

Ce que la commande touche :

- Crée `src/components/ui/sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `input.tsx`, `separator.tsx`, `skeleton.tsx`, `table.tsx`, `badge.tsx`, `empty.tsx` (`sheet`, `tooltip`, `input` sont des dépendances de `sidebar`).
- Crée `src/hooks/use-mobile.ts` (breakpoint mobile 768 px, `matchMedia`).
- `button.tsx` existe déjà : si la CLI propose de l'écraser, répondre non.
- `globals.css` : normalement inchangé. Vérifier avec `git diff src/app/globals.css` ; retirer les lignes dupliquées s'il y en a.
- Les fichiers du registre n'ont pas de point-virgule : `npm run format` juste après, sinon `format:check` échoue.

Traductions à faire sur place dans `sidebar.tsx` (les composants nous appartiennent) :

| Ligne d'origine | Remplacer par |
|---|---|
| `<SheetTitle>Sidebar</SheetTitle>` | `Menu de navigation` |
| `<SheetDescription>Displays the mobile sidebar.</SheetDescription>` | `Navigation principale du back-office.` |
| `<span className="sr-only">Toggle Sidebar</span>` (SidebarTrigger) | `Afficher ou masquer le menu` |
| `aria-label="Toggle Sidebar"` et `title="Toggle Sidebar"` (SidebarRail) | `Afficher ou masquer le menu` |

Ces textes sont lus par les lecteurs d'écran : les traduire est une exigence d'accessibilité, pas de style.

## Partie 1 : coquille (A1.4)

### Objectif utilisateur

Un membre de l'équipe FIG ouvre le back-office le matin et navigue toute la journée entre Commandes, Catalogue, Clients et Métriques sans perdre ses repères. Action principale : atteindre une section en un clic, avec la section courante toujours identifiable.

### Structure

Fichiers à créer (imports `@/` uniquement) :

```
src/app/layout.tsx                         existant : lang="fr", metadata
src/app/(dashboard)/layout.tsx             serveur
src/app/(dashboard)/page.tsx               Tableau de bord (déplacer l'ancien src/app/page.tsx ici, sinon conflit de route)
src/app/(dashboard)/commandes/page.tsx
src/app/(dashboard)/catalogue/page.tsx
src/app/(dashboard)/clients/page.tsx
src/app/(dashboard)/metriques/page.tsx
src/components/app-sidebar.tsx             serveur
src/components/nav-main.tsx                "use client"  (seul fichier client de la coquille)
src/components/site-header.tsx             serveur
src/components/page-header.tsx             serveur
src/components/coming-soon.tsx             serveur
src/lib/navigation.ts                      NAV_ITEMS + isNavItemActive()
```

**(a) `(dashboard)/layout.tsx`**, composant serveur typé `LayoutProps<"/">` (le groupe de routes ne change pas l'URL ; si `tsc` se plaint, relancer `npm run dev` pour régénérer `.next/types`).

- Lien d'évitement en tout premier élément : `<a href="#contenu" className="sr-only focus:not-sr-only …">Aller au contenu</a>`
- `SidebarProvider`
  - `AppSidebar`
  - `SidebarInset` (rend un `<main>`) avec `id="contenu"` et `tabIndex={-1}`
    - `SiteHeader`
    - `<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>`

**Décision `collapsible="icon"`.** `offcanvas` fait disparaître la navigation entièrement : deux clics au lieu d'un pour changer de section, et l'indicateur de section courante disparaît. `icon` réduit la barre à 3 rem : navigation visible, un clic, infobulle sur chaque icône (prop `tooltip` de `SidebarMenuButton`, active seulement en mode réduit). On gagne environ 13 rem pour le tableau des commandes, ce qui compte à 1280 px avec sept colonnes. Sur mobile les deux modes se comportent pareil (`Sheet`). Bonus : raccourci Ctrl/Cmd + B et état écrit dans un cookie `sidebar_state` ; en A1 on ne lit pas ce cookie, en A2 lire `cookies()` dans le layout et passer `defaultOpen` évitera le clignotement.

**(b) `app-sidebar.tsx`**, composant serveur (il rend `Sidebar` qui est client : c'est une frontière, le serveur peut passer des enfants serveur à un composant client).

- `Sidebar collapsible="icon"`
  - `SidebarHeader` > `SidebarMenu` > `SidebarMenuItem` > `SidebarMenuButton size="lg" render={<Link href="/" />}`
    - carré `size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground` contenant `Carrot` (`size-4`)
    - `<span className="font-medium">FIG Back-office</span>` puis `<span className="text-xs text-sidebar-foreground/70">Livraison de fruits et légumes</span>` (tronqué et masqué automatiquement en mode icône)
  - `SidebarContent` > `NavMain`
  - `SidebarFooter` > `SidebarMenu` > `SidebarMenuItem` > `SidebarMenuButton size="lg" render={<div />}` : un `div` et non un bouton, car un bouton focusable qui ne fait rien est un piège clavier. En A2 ce `div` deviendra le déclencheur d'un `DropdownMenu`.
    - `CircleUser` (`size-4`), `<span className="font-medium">Utilisateur démo</span>` + `<span className="text-xs text-sidebar-foreground/70">Gestionnaire</span>`
  - `SidebarRail` (bande cliquable pour replier ; `tabIndex={-1}` d'origine, le trigger reste le moyen clavier)

Icônes lucide, toutes vérifiées présentes dans `lucide-react@1.42.0` : `LayoutDashboard`, `ShoppingBasket`, `Carrot`, `Users`, `ChartColumn`, `CircleUser`, `PanelLeft`, `Hourglass`, `Inbox`, `RefreshCw`.

`src/lib/navigation.ts` :

```ts
export const NAV_ITEMS = [
  { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { title: "Commandes", href: "/commandes", icon: ShoppingBasket },
  { title: "Catalogue", href: "/catalogue", icon: Carrot },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Métriques", href: "/metriques", icon: ChartColumn },
] as const;
```

Ajouter une fonction pure `isNavItemActive(pathname: string, href: string): boolean` : égalité stricte pour `/`, sinon `pathname === href || pathname.startsWith(href + "/")`. Ainsi `/commandes/abc` (A2) gardera « Commandes » actif. Test `src/lib/navigation.test.ts`, trois cas : racine, section, sous-page.

**(c) `nav-main.tsx`**, `"use client"`. Pourquoi ce fichier et lui seul : `usePathname()` est un hook, il ne peut vivre que dans un composant client, et c'est la seule information de la coquille qui dépend du navigateur. Il a aussi besoin de `useSidebar().setOpenMobile(false)` : sur mobile, le `Sheet` ne se ferme pas seul après un clic sur un lien. Tout le reste est statique : le laisser côté serveur garde le bundle client minimal.

- `SidebarGroup` > `SidebarGroupLabel` « Navigation » > `SidebarGroupContent`
  - `<nav aria-label="Navigation principale">` (le composant rend des `div`, le repère `nav` doit être ajouté)
    - `SidebarMenu` → pour chaque item : `SidebarMenuItem` > `SidebarMenuButton`

```tsx
<SidebarMenuButton
  isActive={active}
  tooltip={item.title}
  onClick={() => setOpenMobile(false)}
  render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
>
```

**(d) `site-header.tsx`**, serveur.

- `<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">`
  - `SidebarTrigger`
  - `Separator orientation="vertical" className="mx-1 data-vertical:h-4"` (base-nova étire le séparateur en `self-stretch`, la hauteur explicite reprend la main)
  - `<span className="text-sm font-medium">FIG Back-office</span>`

Le titre de la page n'est pas ici : titre par page via `page-header.tsx`. En A2 un fil d'Ariane remplacera le `span`.

**(e) `page-header.tsx`**, serveur, props `{ title: string; description?: string; actions?: React.ReactNode }`.

- `<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">`
  - `<h1 className="text-xl font-semibold tracking-tight">` + `<p className="text-sm text-muted-foreground">` si `description`
  - `{actions}` dans `<div className="flex shrink-0 items-center gap-2">` uniquement si fourni

Un seul `h1` par page, toujours dans ce composant.

**(f) `coming-soon.tsx`**, serveur, prop `{ feature: string }`.

- `Empty className="min-h-[50vh] border"` (la classe de base a `border-dashed` sans épaisseur : sans `border` rien ne s'affiche)
  - `EmptyHeader` > `EmptyMedia variant="icon"` > `Hourglass` ; `EmptyTitle` « Bientôt disponible » ; `EmptyDescription` « {feature} arrive dans une prochaine version du back-office. »

Pages catalogue / clients / métriques / tableau de bord = `PageHeader` + `ComingSoon`. Chaque page exporte `metadata = { title: "Catalogue" }`.

### États

- Chargement : le layout est statique, aucun skeleton pour la coquille.
- Vide : `ComingSoon` sur les quatre sections non livrées.
- Erreur : aucune source d'erreur dans la coquille ; les erreurs de données sont gérées par le `error.tsx` de chaque section.
- Pas de bouton de soumission en A1, donc pas d'état pending.

### Responsive

- 375 px : sidebar absente du flux, ouverte dans un `Sheet` de 18 rem par le trigger ; contenu pleine largeur `p-4` ; `PageHeader` empile titre puis actions.
- 768 px : sidebar dépliée (16 rem) dans le flux, contenu `p-6` ; réductible en icônes ; `PageHeader` passe en ligne.
- 1280 px : identique avec plus d'air.

### Accessibilité

- Ordre de focus réel : sur desktop, sidebar (nav) → header (trigger) → contenu ; sur mobile la sidebar est dans un portail donc trigger → contenu, la nav n'arrive qu'à l'ouverture du sheet (focus piégé dedans, Échap ferme). Ne pas forcer un autre ordre avec du CSS `order` : désynchroniser ordre visuel et ordre de tabulation est pire. Compenser avec le lien d'évitement.
- `aria-current="page"` posé sur le `Link` actif (le composant ne le fait pas, vérifié dans la source).
- `<nav aria-label="Navigation principale">` autour du menu ; `SidebarInset` est déjà un `<main>`.
- Libellés du trigger et du rail traduits. Infobulles = texte de l'item.
- Contraste : tokens `sidebar-*` neutres et conformes en clair et en sombre ; `text-sidebar-foreground/70` reste au-dessus de 4,5:1 sur `--sidebar`.
- `lang="fr"` sur `<html>`.

### Textes

| Emplacement | Texte |
|---|---|
| Nom de l'application | FIG Back-office |
| Sous-titre sidebar | Livraison de fruits et légumes |
| Libellé groupe | Navigation |
| Items | Tableau de bord · Commandes · Catalogue · Clients · Métriques |
| Pied (démo) | Utilisateur démo / Gestionnaire |
| Lien d'évitement | Aller au contenu |
| Trigger (sr-only) | Afficher ou masquer le menu |
| Tableau de bord | Tableau de bord / Vue d'ensemble de l'activité du jour. |
| Commandes | Commandes / Suivez et préparez les commandes à livrer. |
| Catalogue | Catalogue / Produits, prix et stocks proposés dans l'application. |
| Clients | Clients / Comptes clients et historique de leurs commandes. |
| Métriques | Métriques / Chiffres clés pour piloter l'activité. |
| État vide commun | Bientôt disponible / « {Le tableau de bord \| Le catalogue \| La gestion des clients \| Les métriques} arrive(nt) dans une prochaine version du back-office. » |

## Partie 2 : liste des commandes (A1.6)

### Objectif utilisateur

Le gestionnaire ouvre « Commandes » pour préparer sa journée : il repère en un coup d'œil qui est livré, quand, où, combien d'articles à préparer et l'état de chaque commande. Action principale en A1 : lire ; en A2 : ouvrir une commande.

### Structure

```
src/app/(dashboard)/commandes/page.tsx       serveur, async, appelle getOrders()
src/app/(dashboard)/commandes/loading.tsx    serveur
src/app/(dashboard)/commandes/error.tsx      "use client" (obligatoire : error boundary)
src/components/orders/orders-table.tsx       serveur (rend Table qui est client)
src/components/orders/order-status-badge.tsx serveur
src/domain/orders/status.ts                  ORDER_STATUS_LABELS
```

**`page.tsx`** : `PageHeader` puis, selon `orders.length`, `OrdersTable orders={orders}` ou l'état vide.

**(a) Colonnes**, dans l'ordre « quoi → pour qui → quand → où → combien → état » :

| # | En-tête | Contenu | Classes cellule | Mobile |
|---|---|---|---|---|
| 1 | Référence | `order.reference` | `font-mono text-xs` | visible |
| 2 | Client | `customer.fullName` | `font-medium` | visible |
| 3 | Créneau | `formatSlot(deliverySlot)` → « lun. 8 sept., 09:00–11:00 » | | visible |
| 4 | Ville | `deliveryCity` | `hidden md:table-cell` | masquée |
| 5 | Articles | `lines.length` | `hidden md:table-cell text-right tabular-nums` | masquée |
| 6 | Total | `formatEuros(totalCents)` → « 24,90 € » | `text-right tabular-nums` | visible |
| 7 | Statut | `OrderStatusBadge status={status}` | | visible |

Les classes `hidden md:table-cell` et `text-right` s'appliquent à la fois au `TableHead` et au `TableCell` de la colonne, sinon l'en-tête se décale. `tabular-nums` aligne les chiffres.

- `Table`
  - `TableCaption className="sr-only"` « Liste des commandes triées par créneau de livraison. »
  - `TableHeader` > `TableRow` > 7 × `TableHead scope="col"`
  - `TableBody` > pour chaque `order` : `TableRow key={order.id}` > 7 × `TableCell`

**(b) `order-status-badge.tsx`**, serveur, prop `{ status: OrderStatus }`. Quatre variantes `Badge` adaptées à un statut (`default`, `secondary`, `outline`, `destructive`) :

| Statut | Libellé | Variante | Lecture |
|---|---|---|---|
| `pending` | En attente | `outline` | neutre, pas encore pris en charge |
| `confirmed` | Confirmée | `secondary` | validée, en file |
| `preparing` | En préparation | `default` | en cours, le plus visible |
| `delivering` | En livraison | `default` | en cours |
| `delivered` | Livrée | `outline` + `className="text-muted-foreground"` | terminée |
| `cancelled` | Annulée | `destructive` | à ne pas préparer |

Le libellé est toujours affiché : la couleur n'est jamais le seul porteur d'information. `ORDER_STATUS_LABELS: Record<OrderStatus, string>` dans `src/domain/orders/status.ts`, mapping variante dans le composant.

Token sémantique manquant, proposition pour après A1 : le thème n'a ni succès ni avertissement. Quand le client voudra distinguer « Livrée » (vert) et « En attente » (ambre) :

```css
:root  { --success: oklch(0.627 0.194 149.214); --warning: oklch(0.666 0.179 58.318); }
.dark  { --success: oklch(0.723 0.219 149.579); --warning: oklch(0.769 0.188 70.08); }
@theme inline { --color-success: var(--success); --color-warning: var(--warning); }
```

puis une variante `success` / `warning` dans `badge.tsx` sur le modèle de `destructive` (`bg-success/10 text-success`).

**(c) `loading.tsx`**, serveur. Reproduire la page pour éviter le saut de mise en page :

- `PageHeader` réel
- `<div aria-busy="true">` + `<p className="sr-only">Chargement des commandes…</p>`
  - `Table` avec le vrai `TableHeader`
  - `TableBody` > 6 × `TableRow` > 7 × `TableCell` contenant un `Skeleton` : `h-4 w-20` (réf), `h-4 w-32` (client), `h-4 w-36` (créneau), `h-4 w-20` (ville, `hidden md:table-cell`), `h-4 w-6 ml-auto` (articles, idem), `h-4 w-14 ml-auto` (total), `h-5 w-24 rounded-4xl` (statut)

**(d) État vide**, dans `page.tsx` à la place du tableau :

- `Empty className="min-h-[50vh] border"` > `EmptyHeader` > `EmptyMedia variant="icon"` > `Inbox` ; `EmptyTitle` « Aucune commande » ; `EmptyDescription` « Les commandes passées dans l'application FIG apparaîtront ici. » Pas d'`EmptyContent`.

**(e) `error.tsx`**, `"use client"` :

```tsx
export default function CommandesError({ error, retry }: {
  error: Error & { digest?: string }; retry: () => void;
}) { … }
```

- `useEffect(() => { console.error(error); }, [error])` : la trace va dans la console du navigateur pour le développeur, jamais dans l'interface.
- `Empty className="min-h-[50vh] border"` > `EmptyHeader` > `EmptyMedia variant="icon"` > `RefreshCw` ; `EmptyTitle` « Impossible de charger les commandes » ; `EmptyDescription` « Une erreur est survenue de notre côté. Réessayez dans un instant ; si le problème persiste, contactez l'administrateur. » ; `EmptyContent` > `Button variant="outline" onClick={retry}` « Réessayer ».
- Optionnel : `<p className="text-xs text-muted-foreground">Code : {error.digest}</p>` si `digest` existe. `error.message` reste interdit.

`error.tsx` protège `page.tsx` et ses enfants, pas le `layout.tsx` du même dossier : la coquille reste affichée quand la liste échoue, c'est voulu.

**(g) Ligne cliquable (A2)** : ne pas rendre le `<tr>` cliquable (un `onClick` sur une ligne n'est ni focusable ni annonçable). En A2, la cellule Référence contiendra `<Link href={`/commandes/${order.id}`} className="font-medium underline-offset-4 hover:underline">`.

### États

- Chargement : `loading.tsx`, affiché par Next pendant `getOrders()`.
- Vide : `Empty` « Aucune commande ».
- Erreur : `error.tsx`, message non technique + « Réessayer ».
- Succès : le tableau ; pas de toast.

### Responsive

- 375 px : Ville et Articles masquées ; cinq colonnes ; `overflow-x-auto` de `Table` autorise un défilement horizontal si nécessaire.
- 768 px : sept colonnes ; réduire la sidebar en icônes règle les cas serrés.
- 1280 px : sept colonnes à l'aise.

### Accessibilité

- `TableCaption` `sr-only` nomme le tableau ; `scope="col"` sur chaque `TableHead`.
- Montants et nombres alignés à droite avec `tabular-nums`.
- Badges : `default` et `secondary` très contrastés ; `destructive` ≈ 4,6:1 en clair ; `text-muted-foreground` ≈ 4,6:1, AA pour `text-xs font-medium`. Vérifier avec l'inspecteur du navigateur.
- Aucun `aria-*` supplémentaire hors `aria-busy` sur le skeleton.

### Textes

| Emplacement | Texte |
|---|---|
| Caption (sr-only) | Liste des commandes triées par créneau de livraison. |
| En-têtes | Référence · Client · Créneau · Ville · Articles · Total · Statut |
| Statuts | En attente · Confirmée · En préparation · En livraison · Livrée · Annulée |
| Chargement (sr-only) | Chargement des commandes… |
| Vide | Aucune commande / Les commandes passées dans l'application FIG apparaîtront ici. |
| Erreur | Impossible de charger les commandes / Une erreur est survenue de notre côté. Réessayez dans un instant ; si le problème persiste, contactez l'administrateur. / Réessayer / Code : {digest} |

## Points de vigilance pour Zaki

1. Imports `@/…` partout, y compris `@/components/ui/sidebar` et `@/hooks/use-mobile` ; l'import `from "cn"` dans les fichiers ui est normal.
2. `"use client"` uniquement dans `nav-main.tsx` et `commandes/error.tsx` (plus les fichiers ui livrés tels quels).
3. Déplacer `src/app/page.tsx` vers `src/app/(dashboard)/page.tsx` : deux fichiers pour la même route font échouer le build.
4. `lang="fr"` et `metadata` dans `src/app/layout.tsx`.
5. Ne jamais afficher `error.message` ; `retry`, pas `reset`.
6. Tests attendus : `src/lib/navigation.test.ts` (`isNavItemActive`) et `src/lib/format.test.ts`.
