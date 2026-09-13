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

**`Map`** (A2) : structure clé → valeur du langage (`set`, `get`, `values()`, `clear()`), typée `Map<string, Order>` dans le mock : la « table » en mémoire, un objet par id, modifiable.

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

## Ajouts A3 à B1 (2026-09-13)

**Upsert** (A3) : écrire « en remplaçant si ça existe déjà ». `assignOrder` remplace l'attribution d'une commande au lieu d'en ajouter une seconde.

**DAL (Data Access Layer) de session** (A7) : `src/lib/dal.ts`, l'unique endroit qui lit la session Auth.js et la traduit en `CurrentUser`. Sans session valide, `verifySession()` redirige vers `/connexion`.

**JWT** (A7) : jeton signé (pas chiffré) qui porte l'identité et le rôle de l'utilisateur, stocké dans un cookie HttpOnly. Le serveur vérifie la signature avec `AUTH_SECRET` : impossible de forger un rôle sans le secret.

**Credentials (fournisseur)** (A7) : la méthode « e-mail + mot de passe » d'Auth.js. `authorize()` reçoit le formulaire, vérifie, et renvoie l'utilisateur ou `null`, sans jamais dire lequel des deux champs est faux.

**scrypt / hachage salé** (A7) : on ne stocke jamais un mot de passe, seulement son hachage avec un sel aléatoire. Vérifier = rehacher la saisie et comparer en temps constant (`timingSafeEqual`).

**Proxy (ex-middleware)** (A7) : `src/proxy.ts`, code exécuté avant toute page. Ici : redirige les anonymes vers la connexion. Runtime Node.js en Next 16.

**Compte d'amorçage** (A7) : le premier compte, défini par variables d'environnement, qui permet d'entrer avant que les comptes existent en base.

**Union discriminée** (B1) : un type `A | B` où un champ commun (`DATA_SOURCE`) dit lequel des deux on a. En mode `db`, `DATABASE_URL` devient obligatoire ; en `mock`, non.

**Pool de connexions** (B1) : petit stock de connexions Postgres réutilisées (`max: 5`) au lieu d'en ouvrir une par requête.

**Route Handler** (B1) : fichier `route.ts` qui répond à une requête HTTP brute (`GET`, `POST`) sans page. `/api/health` en est un.

**instrumentation.ts** (B1) : fichier dont `register()` s'exécute une fois au démarrage du serveur, avant la première requête. Utilisé pour valider l'environnement tôt.

**Docker Compose** (B1) : `compose.yaml` décrit les services locaux (ici Postgres) ; `docker compose up -d` les lance, `down` les arrête, `down -v` efface les données.

**Fil d'Ariane (breadcrumb)** (coquille) : la ligne « Commandes › Détail » du bandeau qui situe la page dans la navigation. Calculé par `breadcrumbFor(pathname)` (pur, testé) et rendu par `site-breadcrumb.tsx` ; le dernier maillon porte `aria-current="page"`.

**Point de rupture (breakpoint)** (responsive) : largeur à partir de laquelle une classe préfixée s'applique (`sm:` 640 px, `md:` 768 px, `lg:` 1024 px, `xl:` 1280 px). Mobile d'abord : la classe sans préfixe vaut pour le petit écran, le préfixe ajoute le comportement grand écran.

**`md:contents`** (CSS) : `display: contents` fait disparaître une boîte de la mise en page, ses enfants se placent comme s'ils étaient directement dans le parent. Utilisé pour grouper « Du / Au » côte à côte sur mobile puis les rendre au flex du formulaire dès 768 px.

**`has-checked:` (variant CSS)** (Tailwind v4) : applique un style à un élément dont un descendant est coché (`:has(:checked)`). Permet de mettre en valeur l'emoji choisi dans le formulaire d'article sans état React : le bouton radio caché fait tout.

**Article programmé** (articles) : article visible dont la date de parution est postérieure à aujourd'hui ; l'application ne l'affichera qu'à cette date. Calculé par `publicationState()`.

**Limitation de débit (rate limiting)** (sécurité) : refuser une action répétée trop souvent depuis la même origine. Ici : cinq échecs de connexion rapprochés sur un e-mail verrouillent une minute, puis le verrou double à chaque échec jusqu'à une heure ; vingt par adresse IP. Règles pures dans `src/lib/rate-limit.ts`.

**Énumération de comptes** (sécurité) : deviner quels e-mails existent en observant la réponse. Le message est identique dans les deux cas, et le temps aussi : un e-mail inconnu vérifie un hachage factice (`dummyPasswordHash`).

**En-têtes de sécurité / CSP** (HTTP) : en-têtes envoyés avec chaque réponse pour brider le navigateur. La Content-Security-Policy dit d'où scripts, styles et images peuvent venir et interdit d'afficher le site dans un cadre (`frame-ancestors 'none'`, contre le détournement de clic). HSTS force le HTTPS. Posés dans `next.config.ts`.

**Journal de sécurité** (exploitation) : une ligne JSON par événement sensible (connexion réussie ou échouée, verrou, refus, changement de statut, suppression) sur la sortie standard, sans secret. Sert à détecter une attaque et à comprendre un incident.

**Matrice d'accès** (RBAC) : tableau rôle → sections lisibles (`SECTION_ACCESS`). L'authentification dit qui vous êtes, l'autorisation ce que vous pouvez voir et faire ; le proxy applique la lecture, les Server Actions l'écriture.

**Dependabot / CI** (outillage) : le robot GitHub qui ouvre des PR de mise à jour des dépendances, et le workflow qui rejoue `npm run check` et `npm audit` à chaque push.

**Motif d'annulation** (métier) : raison communiquée au client quand l'équipe annule une commande : stock insuffisant, livraison indisponible, ou autre avec une précision libre de 100 caractères au plus. Exigé côté serveur par zod, stocké sur la commande et dans l'historique.

**Événement de commande (OrderEvent)** (métier) : trace immuable d'un changement de statut, avec l'acteur et l'instant. Écrit en même temps que le statut (une seule transaction), jamais modifié, affiché en historique sur la fiche.

**Test de bout en bout navigateur (Playwright)** (tests) : un vrai navigateur (Chromium) ouvre le site construit, remplit les formulaires et vérifie l'écran. Complète Vitest, qui ne rend aucun composant. Fichiers `e2e/*.spec.ts`, lancés par `npm run test:e2e` après un build.

**vi.mock / vi.hoisted** (tests) : remplacer un module par une version simulée pour un fichier de test (`server-only`, `next/cache`, la session, l'env). `vi.hoisted` déclare une variable utilisable dans ce remplacement.
