# Jalon A2 : spécification UI « Filtres, détail, changement de statut »

Produite par `ui-ux-designer` le 2026-09-08, ajustée par le tech-lead (arbitrages en tête de [a2-consignes.md](a2-consignes.md)). Composants shadcn base-nova, thème mauve par tokens de `globals.css`. Textes en français.

Faits vérifiés : composants installés en A1 : badge (variantes `success`/`warning`), button (`render`), empty, input, separator, sheet, sidebar, skeleton, table, tooltip. `commandes/error.tsx` couvre aussi le segment `[id]` : pas de second `error.tsx`. `readSimulationMode` reste tel quel : un formulaire GET fait simplement disparaître `?simuler=…`.

## 0. Installation

```bash
npx shadcn@latest add card label native-select
npm run format
```

Pas de `select` base-ui (composant JS à état contrôlé, impossible dans un formulaire GET sans client), pas de `field`, pas d'`alert`. Si `native-select` n'existe pas dans le registre : `<select>` natif avec les classes de `input.tsx` (`border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30`).

## 1. Filtres : `src/components/orders/orders-filters.tsx` (serveur)

**Objectif.** Le gestionnaire réduit la liste aux commandes d'un statut et/ou d'une date de livraison, et partage l'URL à un collègue. Action principale : « Filtrer ».

**Décision : formulaire GET, composant serveur** via `Form` de `next/form` (`action="/commandes"`). L'URL est déjà l'état : le navigateur fait soumission, historique, retour arrière, lien partageable, sans `"use client"`, `useRouter`, `useSearchParams` ni debounce. `next/form` ajoute la navigation côté client et déclenche `loading.tsx`. Un `router.replace` à chaque changement économise un clic mais coûte un fichier client et un `Suspense` obligatoire : pas rentable pour deux champs.

Props : `{ filters: OrderFilters }` (résultat de `parseOrderFilters` ; une URL bricolée donne `{}` : jamais de message d'erreur).

Structure :
- `<Form action="/commandes" aria-label="Filtres des commandes" className="flex flex-col gap-3 md:flex-row md:items-end">`
  - `<div className="grid gap-1.5 md:w-48">` : `Label htmlFor="statut"` « Statut » ; `NativeSelect id="statut" name="statut" defaultValue={filters.status ?? ""}` : option `value=""` « Tous les statuts », puis `ORDER_STATUSES.map` → `ORDER_STATUS_LABELS[s]`.
  - `<div className="grid gap-1.5 md:w-48">` : `Label htmlFor="date"` « Date de livraison » ; `Input id="date" type="date" name="date" defaultValue={filters.date ?? ""} className="dark:scheme-dark"` (sans `scheme-dark`, l'icône du calendrier reste noire sur fond sombre).
  - `<div className="flex gap-2">` : `Button type="submit"` « Filtrer » ; si un filtre est actif : `Button variant="ghost" render={<Link href="/commandes" />}` « Réinitialiser » (un lien, pas `type="reset"` : `reset` vide le formulaire, pas l'URL).

Libellés visibles, pas `sr-only` : un `<input type="date">` n'a pas de placeholder. Valeur courante préservée par `defaultValue` (le HTML arrive déjà rempli).

**Compteur** dans la page, sous la barre : `<p role="status" className="text-muted-foreground text-sm">{formatOrdersCount(orders.length)}</p>` (« 1 commande », « 5 commandes »). `role="status"` implique `aria-live="polite"`.

Placement dans `page.tsx` : `PageHeader` → `<div className="flex flex-col gap-4">` : `OrdersFilters`, compteur, tableau ou état vide.

**État vide filtré** (quand `orders.length === 0` et qu'un filtre est actif) : `Empty` mêmes classes qu'en A1, icône `SearchX`, `EmptyTitle` « Aucune commande ne correspond », `EmptyDescription` « Modifiez les filtres ou réinitialisez-les pour revoir toutes les commandes. », `EmptyContent` > `Button variant="outline" render={<Link href="/commandes" />}` « Réinitialiser les filtres ». Sans filtre actif : l'état vide A1 inchangé.

**Chargement.** `loading.tsx` ne connaît pas l'URL : silhouette de la barre avant le tableau, mêmes classes de conteneur, deux `Skeleton className="h-8 w-full md:w-48"` précédés d'un `h-4 w-16` (libellé) et un `h-8 w-20` (bouton). Le tableau squelette A1 reste.

Responsive : 375 px, champs empilés pleine largeur, boutons côte à côte dessous ; 768 px et plus, une ligne alignée en bas (`md:items-end`).

Accessibilité : focus statut → date → Filtrer → Réinitialiser ; `Label htmlFor` sur chaque contrôle ; le compteur annonce le résultat après navigation.

## 2. Lien de ligne (`orders-table.tsx`)

```tsx
<TableCell className="font-mono text-xs">
  <Link
    href={`/commandes/${order.id}`}
    className="text-foreground font-medium underline-offset-4 hover:underline focus-visible:underline"
  >
    {order.reference}
  </Link>
</TableCell>
```

- Retirer `text-muted-foreground` : un lien doit passer le contraste texte (≥ 4,5:1) et se distinguer des cellules mortes ; dans une colonne où tous les liens sont alignés, `font-medium` + soulignement au survol/focus suffisent.
- Pas de `<tr>` cliquable : non focusable, non annoncé comme lien, deux cibles désorientent au clavier. `hover:bg-muted/50` de `TableRow` donne le retour visuel.
- Nom accessible = la référence, unique par ligne : aucun `aria-label`.

## 3. Page détail `src/app/(dashboard)/commandes/[id]/page.tsx`

**Objectif.** Vérifier qui, où, quoi, puis faire avancer la commande d'un statut. Action principale : « Changer le statut ».

```
src/app/(dashboard)/commandes/[id]/page.tsx        serveur, async, PageProps<"/commandes/[id]">, await params
src/app/(dashboard)/commandes/[id]/loading.tsx     serveur (§6)
src/app/(dashboard)/commandes/[id]/not-found.tsx   serveur, aucune prop
src/components/orders/order-detail.tsx             serveur
src/components/orders/order-status-form.tsx        "use client" (§4)
```

`metadata = { title: "Détail de la commande" }` statique : `generateMetadata` rappellerait `getOrder` (latence doublée). Titre dynamique → parking.

Structure :
- `PageHeader` : `title` « Commande FIG-260907-001 » ; `description` « Amel Benali · lun. 7 sept., 09:00–11:00 » (`${customer.fullName} · ${formatSlot(deliverySlot)}`) ; `actions` : `Button variant="outline" size="sm" render={<Link href="/commandes" />}` > `ArrowLeft` + « Retour aux commandes » (texte toujours visible : « ← Commandes » seul est cryptique pour un lecteur d'écran).
- `<OrderDetail order={order} />` : `<div className="grid gap-4 lg:grid-cols-3">`, ordre DOM = ordre visuel :
  - `Card` **Client**
  - `Card` **Livraison**
  - `Card` **Statut** `className="lg:row-span-2"`
  - `Card` **Articles** `className="lg:col-span-2"`

Desktop : Client | Livraison | Statut en première ligne, Articles sous les deux premières, Statut sur deux lignes à droite. Mobile : empilement dans le même ordre.

Titres de cartes : `CardHeader` > `CardTitle render={<h2 />}` si la prop existe, sinon `<h2>` dedans : hiérarchie `h1` page → `h2` cartes.

**Client** : `CardContent` > `<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">`, `dt className="text-muted-foreground"`, `dd className="font-medium"`. Nom / `fullName` ; E-mail / `<a href="mailto:…" className="underline-offset-4 hover:underline">` ; Téléphone / `<a href="tel:+33…">` (retirer les espaces, `0` initial → `+33` dans le `href`, afficher le numéro tel quel).

**Livraison** : même `<dl>`. Date / `formatDateFr(deliverySlot.date)` ; Créneau / `${start}–${end}` ; Adresse / `${deliveryPostalCode} ${deliveryCity}`.

**Articles** : `CardContent className="p-0"` (le tableau touche les bords). `Table` > `TableCaption className="sr-only"` « Articles de la commande {reference}. » > en-tête Produit · Quantité (`text-right`) · Total (`text-right`) > lignes `productName` ; `formatQuantity(quantity, unit)` en `text-right tabular-nums` ; `formatEuros(lineTotalCents)` idem > `TableFooter` > `TableCell colSpan={2} className="font-medium"` « Total » + `TableCell className="text-right font-medium tabular-nums"` `formatEuros(totalCents)`. Trois colonnes : tient à 375 px sans masquage.

**Statut** : `CardContent className="flex flex-col gap-4"` > `OrderStatusBadge status={order.status}` puis :
- `allowed.length > 0` : `<OrderStatusForm orderId currentStatus allowed />`
- `allowed.length === 0` : `<p className="text-muted-foreground text-sm">Statut final : aucune transition possible.</p>`

`allowed = allowedTransitions(order.status)` calculé côté serveur dans `order-detail.tsx`. Le message « compte en lecture seule » viendra en A7 avec la vraie session (arbitrage tech-lead).

**`not-found.tsx`** : `Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed"` > `EmptyHeader` > `EmptyMedia variant="icon"` (mêmes classes dégradé qu'en A1) > `PackageSearch` ; `EmptyTitle` « Commande introuvable » ; `EmptyDescription` « Cette commande n'existe pas ou n'est plus disponible. Vérifiez la référence ou revenez à la liste. » ; `EmptyContent` > `Button variant="outline" render={<Link href="/commandes" />}` « Retour aux commandes ». Pas de `PageHeader`.

Responsive : palier `lg`, pas `md` : à 768 px avec la sidebar dépliée, trois cartes côte à côte font moins de 200 px.

Accessibilité : un `h1`, quatre `h2` ; focus Retour → mailto → tel → select → bouton ; caption sr-only ; `tabular-nums` sur quantités et montants.

## 4. Formulaire `src/components/orders/order-status-form.tsx` (client)

Props `{ orderId: string; currentStatus: OrderStatus; allowed: OrderStatus[] }`. Importe `ORDER_STATUS_LABELS` (module pur), l'action depuis `@/app/(dashboard)/commandes/[id]/actions`, `idleActionResult` et `ActionResult` depuis `@/lib/action-result`. `const [result, formAction, pending] = useActionState(changeOrderStatus, idleActionResult)`.

- `<form action={formAction} onSubmit={confirmIfCancelling} className="flex flex-col gap-3">`
  - `<input type="hidden" name="orderId" value={orderId} />`
  - `<div className="grid gap-1.5">` : `Label htmlFor="nextStatus"` « Nouveau statut » ; `NativeSelect key={currentStatus} id="nextStatus" name="nextStatus" required defaultValue=""` : option `value="" disabled` « Choisir un statut », puis `allowed.map` → `ORDER_STATUS_LABELS[s]`.
  - `Button type="submit" disabled={pending}` : « Changer le statut » ; en `pending` : `LoaderCircle className="animate-spin"` + « Enregistrement… ».
  - `<p role="status" className={cn("flex items-center gap-1.5 text-sm", …)}>` toujours rendu : `success` → `CircleCheck className="size-4"` + message, `text-success` ; `error` → `CircleAlert` + message, `text-destructive` ; `idle` → vide.

Détails qui comptent :
- **Option vide + `required`** : sinon le premier statut est présélectionné et un clic réflexe change la commande.
- **`key={currentStatus}` sur le select, pas sur le form** : après un succès la page se re-rend avec un nouveau `currentStatus` ; la `key` remet « Choisir un statut ». Sur le `<form>`, elle remonterait `useActionState` et effacerait le message.
- **Annulation = destructrice** : `confirmIfCancelling` lit `new FormData(e.currentTarget).get("nextStatus")` ; si `"cancelled"` et `!window.confirm("Annuler cette commande ? Le client ne sera pas livré.")` → `e.preventDefault()`. `AlertDialog` → parking.
- Région `role="status"` présente dès le premier rendu : un lecteur d'écran n'annonce que les changements d'une région déjà dans le DOM.
- Le bouton `disabled` en `pending` bloque la double soumission ; le texte change aussi, la couleur n'est jamais le seul signal.

Messages renvoyés par l'action (copiés dans `actions.ts`, voir spec branchements §3) :

| Cas | `status` | Message |
|---|---|---|
| Succès | success | Statut mis à jour : En préparation. |
| Déjà à ce statut | success | La commande est déjà à ce statut. |
| `FormData` invalide | error | Le statut choisi n'est pas valide. |
| Transition interdite | error | Le passage de « En attente » à « Livrée » n'est pas autorisé. |
| Conflit (`from` périmé) | error | Cette commande a changé entre-temps, la page a été actualisée. |
| Commande absente | error | Cette commande n'existe plus. |
| Rôle non autorisé | error | Vous n'avez pas les droits pour modifier le statut d'une commande. |
| Panne | error | Impossible d'enregistrer le changement. Réessayez dans un instant. |

## 5. `formatQuantity` et `formatOrdersCount` (`src/lib/format.ts`)

```ts
export function formatQuantity(quantity: number, unit: "piece" | "g"): string;
export function formatOrdersCount(count: number): string;
```

- `g` : sous 1000 → « 500 g » ; sinon `/ 1000` formaté par `Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })` + « kg » : 1000 → « 1 kg », 1500 → « 1,5 kg », 1250 → « 1,25 kg ».
- `piece` : 1 → « 1 pièce », sinon « 3 pièces » (`quantity > 1 ? "pièces" : "pièce"` ; 0 → « 0 pièce »).
- Espace insécable (` `) entre nombre et unité.
- `formatOrdersCount` : « 1 commande » / « 5 commandes » / « 0 commande ».
- Union inline plutôt qu'un import de `OrderLine["unit"]` : `src/lib` reste sans dépendance vers le domaine.

## 6. `commandes/[id]/loading.tsx`

Même grille que la page, `aria-busy="true"` sur le conteneur, `<p className="sr-only">Chargement de la commande…</p>`. Pas de `PageHeader` (titre requis) : reproduire sa structure : `Skeleton h-8 w-64` (titre), le trait `bg-gradient-brand h-1 w-10 rounded-full` réel, `Skeleton h-4 w-72` (description), `Skeleton h-8 w-44` à droite (bouton).

Puis `<div className="grid gap-4 lg:grid-cols-3">` avec quatre `Card` **réelles** (mêmes `col-span`/`row-span`) :
- Client, Livraison : `CardHeader` > `Skeleton h-5 w-20` ; `CardContent` > 3 × `Skeleton h-4` (`w-40`, `w-56`, `w-32`).
- Statut : `Skeleton h-5 w-24 rounded-4xl` (badge), `h-4 w-28`, `h-8 w-full` (select), `h-8 w-40` (bouton).
- Articles : `CardHeader` > `Skeleton h-5 w-20` ; `CardContent className="p-0"` > `Table` avec le vrai `TableHeader` et 3 lignes de `Skeleton h-4` (`w-40`, `w-14 ml-auto`, `w-16 ml-auto`).

Cartes réelles plutôt que des rectangles : le cadre ne bouge pas à l'arrivée des données.

## Textes récapitulés

| Emplacement | Texte |
|---|---|
| Filtres | Filtres des commandes (aria-label) · Statut · Tous les statuts · Date de livraison · Filtrer · Réinitialiser |
| Compteur | {n} commande(s) |
| Vide filtré | Aucune commande ne correspond / Modifiez les filtres ou réinitialisez-les pour revoir toutes les commandes. / Réinitialiser les filtres |
| Détail | Commande {reference} / {client} · {créneau} / Retour aux commandes / Client · Livraison · Articles · Statut / Nom · E-mail · Téléphone · Date · Créneau · Adresse / Produit · Quantité · Total |
| Statut | Nouveau statut · Choisir un statut · Changer le statut · Enregistrement… / Statut final : aucune transition possible. |
| Confirmation | Annuler cette commande ? Le client ne sera pas livré. |
| Introuvable | Commande introuvable / Cette commande n'existe pas ou n'est plus disponible. Vérifiez la référence ou revenez à la liste. / Retour aux commandes |
| Chargement | Chargement de la commande… |

Icônes lucide : `ArrowLeft`, `SearchX`, `PackageSearch`, `LoaderCircle`, `CircleCheck`, `CircleAlert`.

## Parking

- `AlertDialog` pour confirmer l'annulation ; toast `sonner`.
- Titre d'onglet dynamique via `generateMetadata` (exige `cache()` sur `getOrder`).
- « Commandée le … » (`createdAt`, nécessite `formatDateTimeFr`).
- Tri des colonnes, pagination, filtre par ville ; `Suspense` autour du tableau seul.
- Fil d'Ariane dans `site-header.tsx` remplaçant le bouton Retour ; `error.tsx` propre à `[id]`.
- Message « compte en lecture seule » sur la carte Statut (A7).
