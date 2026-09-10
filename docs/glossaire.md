# Glossaire du projet

Termes d'architecture employés dans le code et les documents, avec le fichier où on les rencontre. Tout terme nouveau est ajouté ici au premier emploi.

## Organisation du code

**Domaine (`src/domain/`)** : le métier du client, exprimé en TypeScript pur, sans dépendance à Next, à la base ni au navigateur. Types (`Order`), vocabulaire (`ORDER_STATUSES`), règles (`computeOrderTotalCents`), fixtures, contrats. C'est la partie du code qui resterait vraie si on changeait de framework.

**Couche de données (`src/data/`)** : tout ce qui va chercher ou modifie des données. Aujourd'hui des fixtures, demain la base du client. Le domaine dit *quoi*, la couche de données dit *comment*.

**Contrat (`OrdersSource`)** : un type TypeScript qui décrit ce qu'une source de données doit savoir faire (`getOrders`, `getOrder`), sans dire comment. Toute implémentation doit le respecter, et `tsc` refuse celle qui oublie une méthode. Dans le projet : `src/domain/orders/source.ts`.

**Implémentation** : une version concrète d'un contrat. `ordersMock` (fixtures) aujourd'hui, `ordersDb` (Drizzle) demain. Les deux ont la même forme, donc interchangeables.

**Façade (`src/data/orders.ts`)** : le seul module que le reste de l'app importe pour accéder aux données. Elle choisit l'implémentation en interne et n'expose que les fonctions du contrat. Le jour du branchement à la base, une ligne change dans la façade, zéro dans les pages.

**Mock** : une implémentation factice qui imite le comportement de la vraie (délai, forme des données) sans la dépendance réelle. `orders.mock.ts` imite une base avec 400 ms de latence.

**Fixtures** : données de test écrites à la main, fixes, sans personne réelle. `ordersFixtures` : 14 commandes inventées, toujours identiques.

**Stub** : une fonction qui a la vraie signature mais un corps factice qui renvoie une valeur fixe. `getCurrentUser()` renvoie toujours l'utilisateur démo jusqu'à l'arrivée de l'auth réelle (A7). Il existe pour que les appelants puissent être écrits maintenant.

**Mapper** (piste B3) : une fonction qui convertit une ligne de la base du client (ses noms de colonnes, ses unités) en type métier `Order`. C'est l'unique endroit où les deux vocabulaires se rencontrent.

**Machine d'états** (A2) : la liste des passages autorisés entre statuts (`pending → confirmed`, jamais `delivered → pending`). Écrite en liste blanche dans `ORDER_TRANSITIONS` : tout passage non listé est refusé. `canTransition(from, to)` la consulte, `allowedTransitions(from)` en tire les options du `<select>`.

**Idempotent** (A2) : une action qu'on peut rejouer sans effet supplémentaire. Renvoyer « déjà à ce statut » au lieu d'une erreur rend le double clic inoffensif.

**Logique pure / fonction pure** : une fonction dont le résultat dépend uniquement de ses arguments et qui ne modifie rien autour d'elle. Testable en isolation, réutilisable partout. `computeOrderTotalCents`, `readSimulationMode`, `assertMockSessionAllowed`.

## Sécurité et accès

**Auth (authentification)** : prouver qui est l'utilisateur, par exemple email + mot de passe. Prévue en A7 avec Auth.js.

**Autorisation** : une fois identifié, a-t-il le droit de faire cette action ? `canChangeOrderStatus(role)`. Distinct de l'auth : être connecté ne donne pas tous les droits.

**Session** : ce que le serveur sait de l'utilisateur connecté entre deux requêtes, généralement via un cookie signé. `getCurrentUser()` la lit ; en attendant A7, c'est un stub.

**Rôle / RBAC** (Role-Based Access Control) : les droits sont attachés à un rôle (`admin`, `gestionnaire`, `lecture`), pas à chaque personne. On vérifie le rôle, pas le nom.

**Garde (guard)** : un `if` en début de fonction qui refuse tôt un cas interdit, avant tout travail. `assertMockSessionAllowed` lève une erreur hors development/test. Une garde « à l'envers » laisse passer ce qu'elle devait bloquer : d'où les tests des deux côtés.

**Liste blanche** : n'autoriser que ce qui est explicitement listé, tout le reste est refusé. Plus sûr qu'une liste noire, où tout ce qu'on a oublié de lister passe.

**Frontière de confiance** : la limite au-delà de laquelle une donnée n'est plus digne de confiance. Tout ce qui vient du navigateur (`FormData`, paramètres d'URL, cookies) est hostile jusqu'à validation zod côté serveur. Les Server Actions sont cette frontière.

**`server-only`** : un import spécial que Next reconnaît. Si un composant `"use client"` importe un module qui le contient, le build échoue. Il empêche du code serveur (secrets, accès base) de partir dans le navigateur. Rien à installer.

**Fail fast / échouer tôt** : préférer une panne visible immédiate (le serveur ne démarre pas, l'action lève) à un comportement silencieusement faux. Le stub de session qui plante en prod en est un exemple.

## Next.js et interface

**Server Component** : composant React rendu uniquement sur le serveur ; le navigateur reçoit le HTML, jamais son code. C'est le défaut dans `src/app/`. Peut être `async` et appeler la façade directement.

**Client Component (`"use client"`)** : composant envoyé au navigateur, nécessaire dès qu'il y a un hook (`useState`, `usePathname`) ou un événement. Tout ce qu'il importe part avec lui.

**Server Action (`"use server"`)** : fonction qui s'exécute sur le serveur mais qu'un formulaire ou un composant client peut appeler. Reçoit un `FormData`, valide, écrit, renvoie un résultat. C'est un POST public : on y revérifie session et rôle à chaque fois.

**`useActionState`** (A2) : hook React qui relie un formulaire à une Server Action et expose son dernier résultat (`{ status, message }`) pour l'afficher.

**Groupe de routes `(dashboard)`** : dossier entre parenthèses qui n'apparaît pas dans l'URL. Sert à partager un layout (la sidebar) entre plusieurs pages sans changer leurs adresses.

**`loading.tsx`** : affiché automatiquement pendant que la page voisine attend ses données (frontière `Suspense`). **`error.tsx`** : affiché si la page voisine lève une erreur (error boundary React, donc forcément `"use client"`), avec un bouton `retry`.

**`searchParams`** : les paramètres d'URL (`?simuler=vide`). En Next 16, c'est une `Promise` : toujours `await`.

**Route dynamique `[id]`** (A2) : dossier entre crochets dont le nom devient un paramètre d'URL : `/commandes/cmd-0001` rend `commandes/[id]/page.tsx` avec `params` = `{ id: "cmd-0001" }`. En Next 16, `params` est une `Promise` : `await`. Le type `PageProps<"/commandes/[id]">` est généré par `next dev` ou `npx next typegen`.

**`notFound()` / `not-found.tsx`** (A2) : appeler `notFound()` interrompt le rendu et affiche le `not-found.tsx` le plus proche avec un code 404. Elle lève une exception spéciale : pas de `return` devant, et jamais dans un `try/catch`.

**`revalidatePath(chemin, "layout")`** (A2) : après une écriture, dit à Next que les pages sous ce chemin sont périmées et doivent être rerendues à la prochaine requête. Avec `"layout"`, `/commandes` et toutes les pages dessous (`/commandes/[id]`) sont couvertes en un appel.

**`next/form`** (A2) : le composant `Form` de Next. En GET, les champs deviennent les paramètres d'URL comme un `<form method="get">` classique, mais la navigation est faite côté client et `loading.tsx` s'affiche pendant le chargement. Composant serveur, aucun hook.

**Hydratation** : après réception du HTML, React « réveille » la page dans le navigateur. Si le HTML serveur et le rendu client diffèrent (dates formatées dans deux fuseaux, par exemple), avertissement `Hydration failed`.

**Skeleton** : silhouette grise de la future interface, affichée pendant le chargement pour éviter un saut de mise en page.

**Tokens (design)** : variables CSS de couleur et d'espacement (`--primary`, `--muted`) définies une fois dans `globals.css`. On les utilise à la place de couleurs en dur pour que le mode sombre et un futur rebranding marchent sans retoucher les composants.

## Base de données (piste B)

**ORM** (Drizzle) : bibliothèque qui traduit des appels TypeScript en SQL et les résultats en objets typés.

**Introspection (`drizzle-kit pull`)** : lire la structure d'une base existante pour en générer le schéma TypeScript, sans rien modifier. C'est ainsi qu'on découvrira le schéma du client.

**Migration** : script versionné qui modifie la structure d'une base. Interdit sur la base du client sans accord écrit.

**Compte lecture seule** : rôle SQL qui ne peut que `SELECT`. C'est ce qu'on demande au client pour l'introspection : impossible de casser quoi que ce soit.

**Dump anonymisé** : export de la base où les données personnelles ont été remplacées par des valeurs factices avant de sortir de chez le client.

**Mise à jour conditionnelle / compare-and-set** (A2 mock, B5 base) : `UPDATE … WHERE id = $1 AND status = $2`. Si le statut a changé entre-temps, zéro ligne modifiée et on le sait. Évite d'écraser le travail d'un collègue.

## Méthode

**Jalon** : un lot de travail qui finit démontrable. **WIP = 1** : un seul jalon ouvert à la fois.

**Parking** : la liste des bonnes idées hors périmètre, notées pour ne pas les perdre et ne pas les faire maintenant.

**Sous-traitant (RGPD)** : celui qui traite des données personnelles pour le compte d'un autre (le client, responsable du traitement). Il n'a le droit de faire que ce que le client a autorisé par écrit.
