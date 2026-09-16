# Glossaire du projet

Termes d'architecture employés dans le code et les documents, avec le fichier où on les rencontre. Tout terme nouveau est ajouté ici au premier emploi.

## Organisation du code

**Domaine (`src/domain/`)** : le métier du client, exprimé en TypeScript pur, sans dépendance à Next, à la base ni au navigateur. Types (`Order`), vocabulaire (`ORDER_STATUSES`), règles (`computeOrderTotalCents`), fixtures, contrats. C'est la partie du code qui resterait vraie si on changeait de framework.

**Couche de données (`src/data/`)** : tout ce qui va chercher ou modifie des données. Aujourd'hui des fixtures, demain la base du client. Le domaine dit _quoi_, la couche de données dit _comment_.

**Contrat (`OrdersSource`)** : un type TypeScript qui décrit ce qu'une source de données doit savoir faire (`getOrders`, `getOrder`), sans dire comment. Toute implémentation doit le respecter, et `tsc` refuse celle qui oublie une méthode. Dans le projet : `src/domain/orders/source.ts`.

**Implémentation** : une version concrète d'un contrat. `ordersDb` (Drizzle, PostgreSQL) implémente `OrdersSource` ; `tsc` refuse une implémentation qui oublie une fonction.

**Façade (`src/data/orders.ts`)** : le seul module que le reste de l'app importe pour accéder aux données. Elle réexporte l'implémentation PostgreSQL typée par le contrat, avec `server-only` : les pages ne connaissent jamais Drizzle.

**Mock** (tests) : un remplaçant factice d'un module le temps d'un test (`vi.mock`) : la session, `next/cache`, ou le client de base remplacé par la transaction du test. L'application n'a plus d'implémentation factice des données (2026-09-15).

**Fixtures** : données de test écrites à la main, fixes, sans personne réelle. `ordersFixtures` : 14 commandes inventées, toujours identiques.

**Stub** : une fonction qui a la vraie signature mais un corps factice qui renvoie une valeur fixe. `getCurrentUser()` renvoie toujours l'utilisateur démo jusqu'à l'arrivée de l'auth réelle . Il existe pour que les appelants puissent être écrits maintenant.

**Mapper** (piste B3) : une fonction qui convertit une ligne de la base du client (ses noms de colonnes, ses unités) en type métier `Order`. C'est l'unique endroit où les deux vocabulaires se rencontrent.

**Machine d'états** : la liste des passages autorisés entre statuts (`preparing → delivering`, jamais `delivered → preparing`). Écrite en liste blanche dans `ORDER_TRANSITIONS` : tout passage non listé est refusé. `canTransition(from, to)` la consulte, `allowedTransitions(from)` en tire les options du `<select>`.

**Idempotent** : une action qu'on peut rejouer sans effet supplémentaire. Renvoyer « déjà à ce statut » au lieu d'une erreur rend le double clic inoffensif.

**`Map`** : structure clé → valeur du langage (`set`, `get`, `values()`), par exemple `Map<string, StaffWorkSummary>` : les compteurs du personnel agrégés par la base, une entrée par personne.

**Logique pure / fonction pure** : une fonction dont le résultat dépend uniquement de ses arguments et qui ne modifie rien autour d'elle. Testable en isolation, réutilisable partout. `computeOrderTotalCents`, `pageWindow`, `statsFromTotals`.

## Sécurité et accès

**Auth (authentification)** : prouver qui est l'utilisateur, par exemple email + mot de passe. Prévue en A7 avec Auth.js.

**Autorisation** : une fois identifié, a-t-il le droit de faire cette action ? `canChangeOrderStatus(role)`. Distinct de l'auth : être connecté ne donne pas tous les droits.

**Session** : ce que le serveur sait de l'utilisateur connecté entre deux requêtes, généralement via un cookie signé. `getCurrentUser()` la lit ; en attendant A7, c'est un stub.

**Rôle / RBAC** (Role-Based Access Control) : les droits sont attachés à un rôle (`admin`, `gestionnaire`, `lecture`), pas à chaque personne. On vérifie le rôle, pas le nom.

**Garde (guard)** : un `if` en début de fonction qui refuse tôt un cas interdit, avant tout travail : un rôle sans droit dans une Server Action, un hôte distant dans le seed (`assertLocalDatabase`). Une garde « à l'envers » laisse passer ce qu'elle devait bloquer : d'où les tests des deux côtés.

**Liste blanche** : n'autoriser que ce qui est explicitement listé, tout le reste est refusé. Plus sûr qu'une liste noire, où tout ce qu'on a oublié de lister passe.

**Frontière de confiance** : la limite au-delà de laquelle une donnée n'est plus digne de confiance. Tout ce qui vient du navigateur (`FormData`, paramètres d'URL, cookies) est hostile jusqu'à validation zod côté serveur. Les Server Actions sont cette frontière.

**`server-only`** : un import spécial que Next reconnaît. Si un composant `"use client"` importe un module qui le contient, le build échoue. Il empêche du code serveur (secrets, accès base) de partir dans le navigateur. Rien à installer.

**Fail fast / échouer tôt** : préférer une panne visible immédiate (le serveur ne démarre pas, l'action lève) à un comportement silencieusement faux. Le stub de session qui plante en prod en est un exemple.

## Next.js et interface

**Server Component** : composant React rendu uniquement sur le serveur ; le navigateur reçoit le HTML, jamais son code. C'est le défaut dans `src/app/`. Peut être `async` et appeler la façade directement.

**Client Component (`"use client"`)** : composant envoyé au navigateur, nécessaire dès qu'il y a un hook (`useState`, `usePathname`) ou un événement. Tout ce qu'il importe part avec lui.

**Server Action (`"use server"`)** : fonction qui s'exécute sur le serveur mais qu'un formulaire ou un composant client peut appeler. Reçoit un `FormData`, valide, écrit, renvoie un résultat. C'est un POST public : on y revérifie session et rôle à chaque fois.

**`useActionState`** : hook React qui relie un formulaire à une Server Action et expose son dernier résultat (`{ status, message }`) pour l'afficher.

**Groupe de routes `(dashboard)`** : dossier entre parenthèses qui n'apparaît pas dans l'URL. Sert à partager un layout (la sidebar) entre plusieurs pages sans changer leurs adresses.

**`loading.tsx`** : affiché automatiquement pendant que la page voisine attend ses données (frontière `Suspense`). **`error.tsx`** : affiché si la page voisine lève une erreur (error boundary React, donc forcément `"use client"`), avec un bouton `retry`.

**`searchParams`** : les paramètres d'URL (`?simuler=vide`). En Next 16, c'est une `Promise` : toujours `await`.

**Route dynamique `[id]`** : dossier entre crochets dont le nom devient un paramètre d'URL : `/commandes/cmd-0001` rend `commandes/[id]/page.tsx` avec `params` = `{ id: "cmd-0001" }`. En Next 16, `params` est une `Promise` : `await`. Le type `PageProps<"/commandes/[id]">` est généré par `next dev`, `next build` ou `npx next typegen` dans `.next/` (ignoré par git) : sur un clone neuf, comme en CI, il n'existe pas encore, d'où `next typegen` en tête du script `typecheck`.

**`notFound()` / `not-found.tsx`** : appeler `notFound()` interrompt le rendu et affiche le `not-found.tsx` le plus proche avec un code 404. Elle lève une exception spéciale : pas de `return` devant, et jamais dans un `try/catch`.

**`revalidatePath(chemin, "layout")`** : après une écriture, dit à Next que les pages sous ce chemin sont périmées et doivent être rerendues à la prochaine requête. Avec `"layout"`, `/commandes` et toutes les pages dessous (`/commandes/[id]`) sont couvertes en un appel.

**`next/form`** : le composant `Form` de Next. En GET, les champs deviennent les paramètres d'URL comme un `<form method="get">` classique, mais la navigation est faite côté client et `loading.tsx` s'affiche pendant le chargement. Composant serveur, aucun hook. Les recherches utilisent désormais `AutoSubmitForm`, qui se lance sans bouton.

**Hydratation** : après réception du HTML, React « réveille » la page dans le navigateur. Si le HTML serveur et le rendu client diffèrent (dates formatées dans deux fuseaux, par exemple), avertissement `Hydration failed`.

**Skeleton** : silhouette grise de la future interface, affichée pendant le chargement pour éviter un saut de mise en page.

**Tokens (design)** : variables CSS de couleur et d'espacement (`--primary`, `--muted`) définies une fois dans `globals.css`. On les utilise à la place de couleurs en dur pour que le mode sombre et un futur rebranding marchent sans retoucher les composants.

## Base de données

**ORM** (Drizzle) : bibliothèque qui traduit des appels TypeScript en SQL et les résultats en objets typés.

**Introspection (`drizzle-kit pull`)** : lire la structure d'une base existante pour en générer le schéma TypeScript, sans rien modifier. C'est ainsi qu'on découvrira le schéma du client.

**Migration** : script versionné qui modifie la structure d'une base. Interdit sur la base du client sans accord écrit.

**Compte lecture seule** : rôle SQL qui ne peut que `SELECT`. C'est ce qu'on demande au client pour l'introspection : impossible de casser quoi que ce soit.

**Dump anonymisé** : export de la base où les données personnelles ont été remplacées par des valeurs factices avant de sortir de chez le client.

**Mise à jour conditionnelle / compare-and-set** : `UPDATE … WHERE id = $1 AND status = $2`. Si le statut a changé entre-temps, zéro ligne modifiée et on le sait. Évite d'écraser le travail d'un collègue.

## Méthode

**Jalon** : un lot de travail qui finit démontrable. **WIP = 1** : un seul jalon ouvert à la fois.

**Parking** : la liste des bonnes idées hors périmètre, notées pour ne pas les perdre et ne pas les faire maintenant.

**Sous-traitant (RGPD)** : celui qui traite des données personnelles pour le compte d'un autre (le client, responsable du traitement). Il n'a le droit de faire que ce que le client a autorisé par écrit.

**Responsable du traitement (RGPD)** : celui qui décide pourquoi et comment des données personnelles sont traitées. Ici le client FIG : il fixe les durées, informe les personnes et reçoit leurs demandes. Voir `docs/rgpd.md`.

**Donnée personnelle (RGPD)** : toute information qui permet d'identifier une personne, directement (nom, e-mail, téléphone) ou en la recoupant (adresse IP, identifiant rattaché à un nom). Une note interne sur un client en est une.

**Anonymisation (RGPD)** : rendre des données définitivement impossibles à rattacher à une personne, par quiconque. Des données vraiment anonymes ne sont plus des données personnelles. Dans le dashboard, « anonymiser un client » (`anonymizeCustomerRows`) remplace nom, e-mail, téléphone, ville et code postal, supprime les notes et efface les précisions libres. Refusé tant qu'une commande est en préparation ou expédiée.

**Pseudonymisation (RGPD)** : remplacer l'identité par un identifiant qui permet encore, avec une information gardée ailleurs, de retrouver la personne. Ce sont toujours des données personnelles. Les commandes d'un client anonymisé en sont : elles gardent un identifiant qui existe aussi dans l'application FIG et dans les sauvegardes. D'où leur base légale et leur durée au registre.

**Durée de conservation (RGPD)** : le temps pendant lequel une donnée peut être gardée pour sa finalité ; au-delà, on la supprime ou on l'anonymise. Hypothèses du projet dans `src/domain/privacy/retention.ts`, appliquées par `npm run rgpd:purge`.

**Droit d'accès / portabilité (RGPD, articles 15 et 20)** : une personne peut obtenir toutes les données gardées sur elle, dans un format lisible et réutilisable. Bouton « Exporter les données » de la fiche client (JSON), administrateur seul. Réponse sous un mois.

**Droit à l'effacement (RGPD, article 17)** : une personne peut demander la suppression de ses données, sauf ce qu'une obligation légale impose de garder (factures et pièces comptables : 10 ans). D'où l'anonymisation plutôt que la suppression d'un client qui a des commandes.

**Minimisation (RGPD)** : ne collecter et n'écrire que ce qui sert. La consigne sous les champs de notes libres en est l'application : jamais de santé, d'opinions ou de jugement.

**Registre des traitements (RGPD, article 30)** : la liste écrite des traitements (finalité, personnes, données, destinataires, durée). Le client tient le sien ; le sous-traitant tient celui des traitements faits pour le client. Brouillon dans `docs/rgpd.md`.

**Violation de données (RGPD, article 33)** : accès, perte ou divulgation non autorisés de données personnelles. Le sous-traitant prévient le client sans délai ; le client notifie la CNIL dans les 72 heures si un risque existe.

**Aperçu à blanc (dry run)** : exécuter une opération en ne faisant que compter ce qu'elle changerait. `npm run rgpd:purge` s'arrête là tant qu'on ne passe pas `--apply`.

## Autres notions

**Upsert** : écrire « en remplaçant si ça existe déjà ». `assignOrder` remplace l'attribution d'une commande au lieu d'en ajouter une seconde.

**DAL (Data Access Layer) de session** : `src/lib/dal.ts`, l'unique endroit qui lit la session Auth.js et la traduit en `CurrentUser`. Sans session valide, `verifySession()` redirige vers `/connexion`.

**JWT** : jeton signé (pas chiffré) qui porte l'identité et le rôle de l'utilisateur, stocké dans un cookie HttpOnly. Le serveur vérifie la signature avec `AUTH_SECRET` : impossible de forger un rôle sans le secret.

**Credentials (fournisseur)** : la méthode « e-mail + mot de passe » d'Auth.js. `authorize()` reçoit le formulaire, vérifie, et renvoie l'utilisateur ou `null`, sans jamais dire lequel des deux champs est faux.

**scrypt / hachage salé** : on ne stocke jamais un mot de passe, seulement son hachage avec un sel aléatoire. Vérifier = rehacher la saisie et comparer en temps constant (`timingSafeEqual`).

**Proxy (ex-middleware)** : `src/proxy.ts`, code exécuté avant toute page. Ici : redirige les anonymes vers la connexion. Runtime Node.js en Next 16.

**Compte d'amorçage** : le premier compte, défini par variables d'environnement, qui permet d'entrer avant que les comptes existent en base.

**Union discriminée** : un type `A | B` où un champ commun dit lequel des deux on a. `DirectoryEntry` : `kind: "customer"` ou `kind: "community"`, et TypeScript sait alors quels champs existent.

**Pool de connexions** : petit stock de connexions Postgres réutilisées (`max: 10`) au lieu d'en ouvrir une par requête.

**Route Handler** : fichier `route.ts` qui répond à une requête HTTP brute (`GET`, `POST`) sans page. `/api/health` en est un.

**instrumentation.ts** : fichier dont `register()` s'exécute une fois au démarrage du serveur, avant la première requête. Utilisé pour valider l'environnement tôt.

**Migration** (base) : fichier SQL numéroté, généré depuis `src/db/schema.ts` par `npm run db:generate`, qui fait passer une base d'un état de schéma au suivant. Appliquée par `npm run db:migrate`, jamais modifiée après coup : on en écrit une nouvelle.

**Seed** (base) : script qui remplit une base avec des données de départ (ici les fixtures du projet et les comptes de `.env.local`). Réservé à la base locale.

**Transaction** (base) : groupe d'écritures qui réussissent ou échouent ensemble. `updateOrderStatus` change le statut ET insère l'événement dans la même transaction : jamais l'un sans l'autre.

**Clé étrangère / ON DELETE** (base) : lien d'une table vers une autre. `CASCADE` : supprimer le parent supprime les enfants (notes d'un client) ; `RESTRICT` : interdit de supprimer un parent référencé (client avec des commandes). Les lignes de commande n'en ont pas vers les produits : instantané.

**Enum Postgres** (base) : liste de valeurs fixée en base (`order_status`…). Doit rester identique à la constante `as const` du domaine ; un test le vérifie.

**Docker Compose** : `compose.yaml` décrit les services locaux : `db` (PostgreSQL de développement, port 5433) et `test-db` (base de test en mémoire, port 5434). `docker compose up -d --wait test-db` lance la seconde et attend qu'elle réponde (`npm run db:test`) ; `down` arrête, `down -v` efface les données.

**Fil d'Ariane (breadcrumb)** (coquille) : la ligne « Commandes › Détail » du bandeau qui situe la page dans la navigation. Calculé par `breadcrumbFor(pathname)` (pur, testé) et rendu par `site-breadcrumb.tsx` ; le dernier maillon porte `aria-current="page"`.

**Point de rupture (breakpoint)** (responsive) : largeur à partir de laquelle une classe préfixée s'applique (`sm:` 640 px, `md:` 768 px, `lg:` 1024 px, `xl:` 1280 px). Mobile d'abord : la classe sans préfixe vaut pour le petit écran, le préfixe ajoute le comportement grand écran.

**`md:contents`** (CSS) : `display: contents` fait disparaître une boîte de la mise en page, ses enfants se placent comme s'ils étaient directement dans le parent. Utilisé pour grouper « Du / Au » côte à côte sur mobile puis les rendre au flex du formulaire dès 768 px.

**`has-checked:` (variant CSS)** (Tailwind v4) : applique un style à un élément dont un descendant est coché (`:has(:checked)`). Permet de mettre en valeur l'emoji choisi dans le formulaire d'article sans état React : le bouton radio caché fait tout.

**Article programmé** (articles) : article visible dont la date de parution est postérieure à aujourd'hui ; l'application ne l'affichera qu'à cette date. Calculé par `publicationState()`.

**Limitation de débit (rate limiting)** (sécurité) : refuser une action répétée trop souvent depuis la même origine. Ici : cinq échecs de connexion rapprochés sur un e-mail verrouillent une minute, puis le verrou double à chaque échec jusqu'à une heure ; vingt par adresse IP. Règles pures dans `src/lib/rate-limit.ts` ; état dans la table `login_attempts` (partagé entre plusieurs instances du dashboard, conservé au redémarrage).

**Verrou de ligne (`SELECT … FOR UPDATE`)** (base) : dans une transaction, réserve les lignes lues jusqu'à la fin de la transaction ; une autre transaction qui veut les mêmes lignes attend. Sert à compter les échecs de connexion simultanés sans en perdre : sans verrou, deux requêtes liraient « 3 échecs » en même temps et écriraient toutes deux « 4 ». `SKIP LOCKED` fait l'inverse : ignorer les lignes déjà réservées au lieu d'attendre (purge).

**Précondition d'écriture (verrouillage optimiste)** (concurrence) : l'écriture ne passe que si la donnée est encore celle que l'écran affichait (`WHERE status = $2`, `WHERE driver_id IS NOT DISTINCT FROM $2`). Sinon rien n'est écrit et l'utilisateur voit « modifié entre-temps ». Pas de verrou tenu pendant qu'on réfléchit : on vérifie au moment d'écrire. `expectedStaffId` est la précondition de l'affectation.


**Énumération de comptes** (sécurité) : deviner quels e-mails existent en observant la réponse. Le message est identique dans les deux cas, et le temps aussi : un e-mail inconnu vérifie un hachage factice (`dummyPasswordHash`).

**En-têtes de sécurité / CSP** (HTTP) : en-têtes envoyés avec chaque réponse pour brider le navigateur. La Content-Security-Policy dit d'où scripts, styles et images peuvent venir et interdit d'afficher le site dans un cadre (`frame-ancestors 'none'`, contre le détournement de clic). HSTS force le HTTPS. Posés dans `next.config.ts`.

**`'strict-dynamic'`** (CSP) : dans `script-src`, ne fait confiance qu'aux scripts portant le nonce de la requête et à ceux qu'ils créent eux-mêmes. Les listes d'hôtes, `'self'` compris, sont alors ignorées. Conséquence : une balise `<script src>` écrite dans le HTML sans nonce est bloquée, même servie par notre propre site. D'où la règle « un `loading.tsx` n'importe aucun module contenant un composant client » (`e2e/csp.spec.ts`).

**Journal de sécurité** (exploitation) : une ligne JSON par événement sensible (connexion réussie ou échouée, verrou, refus, changement de statut, suppression) sur la sortie standard, sans secret. Sert à détecter une attaque et à comprendre un incident.

**Matrice d'accès** (RBAC) : tableau rôle → sections lisibles (`SECTION_ACCESS`). L'authentification dit qui vous êtes, l'autorisation ce que vous pouvez voir et faire ; le proxy applique la lecture, les Server Actions l'écriture.

**Nonce CSP** (sécurité) : valeur aléatoire tirée à chaque requête par le proxy, mise dans la Content-Security-Policy et sur les scripts légitimes de la page. Un script injecté ne la connaît pas : le navigateur refuse de l'exécuter, sans avoir besoin d'autoriser tout l'inline.

**Sauvegarde custom (pg_dump -Fc)** (base) : export compressé d'une base, restaurable table par table avec `pg_restore`. Le format « custom » est plus souple qu'un `.sql` brut et se restaure sans rejouer de texte.

**Dependabot / CI** (outillage) : le robot GitHub qui ouvre des PR de mise à jour des dépendances, et le workflow qui rejoue `npm run check` et `npm audit` à chaque push.

**Motif d'annulation** (métier) : raison communiquée au client quand l'équipe annule une commande : stock insuffisant, livraison indisponible, ou autre avec une précision libre de 100 caractères au plus. Exigé côté serveur par zod, stocké sur la commande et dans l'historique.

**Événement de commande (OrderEvent)** (métier) : trace immuable d'un changement de statut, avec l'acteur et l'instant. Écrit en même temps que le statut (une seule transaction), jamais modifié, affiché en historique sur la fiche.

**Test de bout en bout navigateur (Playwright)** (tests) : un vrai navigateur (Chromium) ouvre le site construit, remplit les formulaires et vérifie l'écran. Complète Vitest, qui ne rend aucun composant. Fichiers `e2e/*.spec.ts`, lancés par `npm run test:e2e` après un build.

**vi.mock / vi.hoisted** (tests) : remplacer un module par une version simulée pour un fichier de test (`server-only`, `next/cache`, la session, l'env). `vi.hoisted` déclare une variable utilisable dans ce remplacement.

**Affectation (préparateur, livreur)** (métier) : rattacher une personne de l'équipe à une commande, dans l'un des deux rôles (`AssignmentRole`). Une liste déroulante par rôle sur les cartes et la fiche, qui écrit dès le choix (`staff-assign-field.tsx`) ; l'action `assignOrderStaff` relit la personne et vérifie son métier (`KIND_FOR_ROLE`).

**Personnel (staff)** (métier) : l'équipe du client, trois métiers (livreur, préparateur de commandes, gestionnaire), avec coordonnées, créneau de travail, disponibilité, jours travaillés. Les gestionnaires listés sont des personnes ; leur accès au back-office se gère dans Comptes. Son historique de traitement se calcule à partir des commandes affectées (`summarizeStaffWork`).

**Communauté** (métier) : groupe de clients qui commandent ensemble et récupèrent leurs produits à un même point de retrait, à l'horaire que chacun choisit en commandant dans l'application (crèche, école, entreprise). Créée par l'application FIG ; livraison offerte à toutes ; sa remise dépend de son nombre de membres (`communityDiscountPercent` : rien jusqu'à 3, −5 % de 4 à 9, −10 % dès 10) et l'application l'applique sur chaque commande des membres ; le dashboard la lit (recherche commune de la section Clients, fiche) et affiche la remise sur les commandes.

**Remise (OrderDiscount)** (métier) : réduction portée par une commande, appliquée par l'application : « communauté » (taux de la communauté) ou « fidélité » (15 %). Les deux ne se cumulent pas : la plus forte l'emporte (`bestDiscount`), donc la fidélité prête remplace la remise de la communauté sur cette commande-là. Le montant est conservé en centimes ; le total dû est le sous-total des lignes moins ce montant, plus les frais de livraison (`computeOrderTotalCents`). Source de vérité : le paiement dans l'application ; le dashboard ne la calcule jamais.

**Compteur de fidélité** (métier) : nombre de commandes cumulées d'un client, membre de communauté compris, depuis la dernière remise fidélité (`loyaltyCount`, `loyaltyStatus`). Une annulée ne compte pas et ne remet pas à zéro ; la commande qui porte la remise repart de zéro ; à huit, la prochaine commande est à −15 %. Affiché en jauge sur la fiche client et en badge sur la carte. Remplace l'ancienne « série » de commandes d'affilée (décision du client, 2026-09-16).

**Catégorie de client (basique, fidèle)** (métier) : « fidèle » pendant deux mois civils après avoir atteint huit commandes cumulées, « basique » sinon (`customerTier`, `tierFromReachedAt`). Rien n'est stocké : la catégorie et l'historique daté de ses atteintes (`loyalTierEvents`, une par cycle de huit) se déduisent des commandes, par une règle pure et par la même requête SQL. Affichée en étoiles et en couleur (token `--loyal`, or) par `TierBadge` ; l'historique est sur la fiche.

**Frais de livraison** (métier) : montant facturé par l'application à un particulier selon son panier avant remise (`deliveryFeeCents` : 4,90 € sous 5 €, 3,90 € dès 5 €, 2,90 € dès 10 €, 1,90 € dès 20 €) ; offerts à toute communauté, ce que la base impose (`orders_community_delivery_free`). Conservés sur chaque commande (`deliveryFeeCents`, instantané) et ajoutés après la remise.

**Créneau d'une heure** (métier) : une commande est livrée sur un créneau d'une heure pile (« 14:00 → 15:00 », `slotEndFor`, `isOneHourSlot`), ce que la contrainte `orders_slot_one_hour` de la base impose à toute écriture, application comprise.

**Autorisations (consentements)** (métier, RGPD) : les trois choix que la personne fait dans l'application (`CustomerConsents`) : notifications d'offres, promos et liquidations ; notification à chaque état de sa commande ; communications marketing. Datés par l'application (`updatedAt`), lus et affichés par le dashboard (`ConsentPills`), jamais modifiés par lui.

**File de notifications** (métier) : table `customer_notifications` où le dashboard **dépose** une notification d'état (`orderStatusNotification`) à chaque changement de statut fait par l'équipe, dans la transaction du statut, seulement si le client a autorisé les notifications d'état. Le dashboard n'envoie rien : l'application FIG lit les lignes sans `sentAt`, envoie par son canal et pose la date d'envoi (question 23).

**Parrainage** (métier) : chaque client a un code « Nom#0000 » (`referralCode`, attribué par l'application, format vérifié par la base) ; un nouveau client qui le saisit à l'inscription devient son **filleul** (`referredBy`). Le code, le parrain, la liste des filleuls et leur total ne sont visibles que dans la fiche du client, jamais sur une carte ; l'export RGPD ne nomme ni le parrain ni les filleuls.

**Commutateur de type** (clients) : le groupe de trois boutons radio de la section Clients (particuliers, communautés, tous), chacun dans sa couleur (`--individual`, `--community`, marque), qui remplace la liste déroulante ; coché, il lance la recherche aussitôt.

**Tri dans les deux sens** (clients) : chaque critère de tri existe en croissant et en décroissant, dans une seule liste déroulante (`sortOptions`), le sens naturel du critère en premier ; l'URL n'écrit le sens que s'il diffère du naturel (`?tri=commandes-croissant`, `parseSortParam`). Le tri par nombre de membres n'apparaît qu'en position « communautés » et range les groupes avant leurs membres.

**Duplication (produit)** (catalogue) : créer une copie complète d'une fiche, nommée « (copie) » (`duplicateName`), masquée dans l'application jusqu'à relecture. Depuis la carte de la grille ou la fiche.

**`alias()` (Drizzle)** (base) : joindre deux fois la même table sous deux noms (`preparer`, `driver`) dans une requête, pour lire les deux personnes affectées à une commande en un seul `SELECT`.

**Rafraîchissement de session (glissant)** (sécurité) : Auth.js re-signe le jeton et re-pose le cookie à chaque lecture de session, pour prolonger une session active. Effet de bord : une réponse de préchargement encore en vol après la déconnexion re-posait un cookie valide. Le proxy retire ce cookie des réponses de préchargement et tant que le jeton a moins de la moitié de sa vie (`src/lib/session-refresh.ts`).

**Recherche et filtres d'URL** (commandes) : la barre `OrdersFilters` est un formulaire GET automatique (`AutoSubmitForm`), chaque champ devient un paramètre (`?q=benali&du=2026-09-01&au=2026-09-07&livreur=aucun`). L'URL est la source de vérité : partageable, retour arrière gratuit, relue par `parseOrderFilters` (tolérant) et réécrite par `orderFiltersQuery` pour la pagination et les raccourcis. `aucun` demande les commandes sans personne affectée.

**Période « du / au »** (toutes les recherches par dates) : les deux champs de dates forment UN filtre, groupés dans un même cadre (`DateRangeFields`). Règle commune (`readDateRange`, `parsePeriodInput`) : une seule date = ce jour-là ; deux dates ordonnées (le même jour compris) = la période ; deux dates inversées = erreur en rouge et aucune période appliquée, la saisie n'est jamais corrigée en silence. Décision du client, 2026-09-16.

**Bandeau de période vide** (toutes les recherches par dates) : le message bleu (`PeriodEmptyNotice`, token `--info`, `role="status"`) qui dit qu'une période valide n'a rien trouvé (« Aucune commande livrée du … au … »), avec un lien vers toutes les dates qui garde les autres filtres. Ni une erreur ni une liste vide : une absence d'activité, visible d'un coup d'œil.

**Raccourcis des 7 derniers jours** (commandes) : une rangée de liens, un par jour jusqu'à aujourd'hui, chacun avec son nombre de livraisons compté par la base (`getDeliveryDayCounts`, `recentDeliveryDaysFromCounts`), plus « Les 7 jours ». Hérités de l'ancienne section Livraisons, fondue dans Commandes le 2026-09-16 (`/livraisons` redirige) ; chaque lien garde la recherche en cours.

**Barre d'avancement segmentée** (tableau de bord) : barre découpée en segments proportionnels, un par statut (livrées, annulées, expédiées, en préparation), accompagnée d'une légende chiffrée, à partir des totaux agrégés (`tourProgressFromCounts`). « Traitée » veut dire livrée ou annulée : il ne reste rien à faire.

**Gommette de présence** (affectation) : le caractère 🟢 ou 🔴 devant chaque nom dans les listes déroulantes de préparateur et de livreur (`staffOptionLabel`) : vert si la personne est « disponible », rouge sinon, quelle que soit la raison (congé, indisponible), la raison suivant en texte. Un `<select>` natif n'accepte ni icône ni couleur CSS dans ses options, surtout sur téléphone : un caractère passe partout.

**Alerte de personnel** (tableau de bord) : le bandeau rouge (`StaffShortageAlert`, `role="alert"`) placé avant tout le reste quand aucun préparateur, ou aucun livreur, n'est présent (`unavailableRoles` : dans l'équipe et « disponible »). Rien ne peut alors être préparé ou livré ; un lien mène au métier concerné dans le personnel.

**Réclamations (métrique)** (métriques) : le nombre de messages « Nous contacter » reçus sur la période dont l'objet est une réclamation (`CLAIM_SUBJECTS` : produit manquant ou abîmé, problème de livraison, erreur sur la commande, remboursement ou avoir), quel que soit leur statut (`countComplaints`, règle pure et requête SQL). Remplace le chiffre venu des stores (colonne supprimée en 0010).

**Parrainages (métrique)** (métriques) : parmi les clients inscrits sur la période (jour d'inscription), ceux qui ont saisi le code d'un parrain (`signupStats`, `getSignupStats`) ; affichés avec le nombre de nouveaux clients et la part parrainée en camembert.

**Source de vérité** (branchement) : le système dont la valeur fait foi quand deux copies divergent. Pour FIG, l'application : le montant d'une remise est celui du paiement, l'horaire de retrait est celui choisi à la commande. Le dashboard affiche ces valeurs, il ne les recalcule pas.

**Type de client (particulier, communauté)** (métier) : une commande ou un client est « particulier » sans communauté, « communauté » sinon (`clientTypeOf`). Affiché partout par `ClientTypeLabel`, avec une icône et un code couleur (tokens `--individual`, `--community`) ; le nom de la communauté passe à la ligne au lieu de déborder.

**Annuaire (clients)** (clients) : la liste commune des particuliers et des communautés de la section Clients (`buildDirectory`), cherchée (`matchesDirectoryQuery`, code de parrainage compris), filtrée par type et triée (nom, commandes, montant, récence, membres, dans les deux sens) par des règles pures ; chaque entrée porte la catégorie du client à l'instant de la lecture et la remise attendue sur sa prochaine commande.

**Camembert plein** (métriques) : un disque découpé en parts proportionnelles, chacune de sa couleur, sans pourcentage écrit ; au survol, une étiquette nomme la part et son nombre (`RatioPie`). La géométrie des parts est une fonction pure (`pieSlicePaths`).

**Duplication (personnel)** (personnel) : créer une nouvelle fiche préremplie depuis une personne (`/personnel/nouveau?depuis=`) : métier, créneau, disponibilité et jours sont repris (`staffTemplate`), l'identité, les coordonnées et les notes restent à saisir.

**Masque CSS (image de fond)** (style) : `mask-image` découpe un élément selon la forme d'une image. Le motif du fond (`public/fond/verger.svg`, feuilles, figue, agrume, vagues) sert de masque à un dégradé de tokens : le même fichier prend la couleur de chaque thème, sans couleur en dur dans le CSS. Il couvre toute la fenêtre (`mask-size: cover`) sur une couche fixe de `body`, qui ne bouge pas au défilement.

**Container query** (responsive) : une règle CSS qui dépend de la largeur d'un élément parent et non de la fenêtre. Le conteneur de page du layout est `@container/main` ; `@2xl/main:grid-cols-2` veut dire « deux colonnes quand la zone de contenu fait au moins 42rem ». Indispensable avec une sidebar : à 768 px, la fenêtre est « tablette » mais le contenu fait 440 px menu ouvert, 630 px menu replié.

**Anti-rebond (debounce)** (recherche) : attendre que la saisie s'arrête (350 ms) avant de lancer la recherche, au lieu d'une requête par touche. Chaque frappe relance le minuteur (`AutoSubmitForm`).

**Course (race condition)** (recherche) : deux recherches parties l'une après l'autre dont les réponses arrivent dans le désordre ; l'ancienne pourrait écraser la plus récente ou la saisie en cours. Parade : le routeur de Next abandonne la navigation doublée, et `settleRequests` reconnaît une réponse à nous (les champs ne sont pas touchés) d'une navigation extérieure comme « Réinitialiser » (les champs reprennent l'URL).

**Transition (`useTransition`)** (React) : marque une mise à jour comme non urgente ; pendant qu'elle charge, l'écran actuel reste affiché (pas de squelette) et `isPending` permet un indicateur discret, ici l'icône de recherche qui tourne.

**Thème FIG (crépuscule)** (style) : le troisième mode d'affichage, inspiré des affiches de GTA VI : nuit violette, rose coucher de soleil, orange pêche, bleu lagon, en teintes adoucies.

**Groupes de navigation** (coquille) : les dix sections du menu rangées sous quatre intitulés (Activité, Offre, Clients et équipe, Pilotage) par `groupNavItems` ; un groupe sans section permise au rôle disparaît.

**Base de test jetable** (tests) : une base PostgreSQL à part (`test-db` de `compose.yaml`, en mémoire, vide à chaque démarrage), migrée et seedée par les tests eux-mêmes. Les tests n'écrivent jamais dans la base de travail.

**Transaction annulée par test (rollback)** (tests) : avant chaque test, `isolateEachTest()` ouvre une transaction et fait de `getDb()` cette transaction ; à la fin du test, elle est annulée. Le code testé écrit normalement (ses propres transactions deviennent des savepoints) et le test suivant repart des données seedées, sans re-seeder.

**Agrégat SQL** (base) : faire calculer les totaux par la base (`count`, `sum`, `max`, `group by`) au lieu de charger toutes les lignes pour compter en JavaScript. `count(*) filter (where status = 'cancelled')` compte une partie des lignes dans la même requête. Les arrondis restent ceux des règles pures (`statsFromTotals`).

**Pagination SQL (`LIMIT` / `OFFSET`)** (base) : la base compte les lignes qui correspondent (`COUNT`), puis ne renvoie que celles de la page demandée. `pageWindow` calcule les bornes, les mêmes que `paginate` en mémoire.

**Test de parité SQL** (tests) : exécuter une requête filtrée ou agrégée sur la base de test seedée et exiger exactement le résultat de la règle pure appliquée à toutes les commandes (`test/data/orders.db.test.ts`). Détecte qu'un filtre, un arrondi ou un seau de semaine ne dit plus la même chose que le domaine.

**Expédiée** (commandes) : libellé du statut `delivering` : la commande a quitté l'atelier et est en cours de livraison. Parcours : en préparation → expédiée → livrée ; l'annulation n'est possible qu'en préparation.

**Colonne générée (calculée)** (base) : une colonne que PostgreSQL calcule lui-même à chaque écriture de la ligne (`GENERATED ALWAYS AS (…) STORED`) ; personne ne l'écrit. `orders.search_text` contient la référence, la ville et le code postal déjà normalisés : la recherche n'a plus à les recalculer ligne par ligne.

**Index trigramme (`pg_trgm`)** (base) : index qui découpe un texte en groupes de trois caractères. Il sert les recherches « contient » (`LIKE '%benali%'`) qu'un index ordinaire ne sait pas servir. Stocké dans un index GIN (index « inversé » : pour chaque trigramme, les lignes qui le contiennent).

**Fonction IMMUTABLE** (base) : fonction SQL qui renvoie toujours le même résultat pour les mêmes arguments. Seules ces fonctions peuvent calculer une colonne générée ou un index (`fig_normalize`).

**`json_agg`** (base) : agrégat qui rassemble des lignes en un tableau JSON. Les lignes d'une commande arrivent ainsi avec la commande, dans la même requête, au lieu d'une seconde requête.

**`cache()` de React** (serveur) : mémorise le résultat d'une fonction le temps d'UNE requête. `verifySession` appelée par le layout et par la page ne déchiffre le jeton de session qu'une fois ; rien n'est partagé entre deux requêtes ni deux personnes.

**Chargement à la demande (`next/dynamic`)** (Next.js) : un composant client sorti du JavaScript initial, téléchargé seulement quand il s'affiche. Le panneau mobile de la sidebar n'est chargé que sur petit écran.

**`content-visibility: auto`** (CSS) : le navigateur saute la mise en page et le dessin d'un élément tant qu'il est hors de l'écran, en gardant sa taille réservée. Utilitaire `cv-auto` sur les cartes des longues listes.

**Boîte de réception (messages)** (métier) : la section `/messages`, où arrivent les demandes écrites par les clients dans « Nous contacter » de l'application FIG (six objets possibles, commande citée facultative, dix pièces jointes au plus). Le dashboard ne crée ni ne modifie jamais un message : il ne pose que trois marques de l'équipe.

**Épingler / « important »** (messages) : deux marques distinctes, volontairement. **Épingler** (`pinned_at`) remonte un message en tête de liste — un geste d'organisation, qui ne se filtre pas. **Important** est une étiquette rouge qui, elle, se filtre (`?important=oui`). Un message peut être l'un, l'autre, les deux ou aucun.

**Aperçu d'un message** (messages) : les deux premières lignes NON VIDES du corps, calculées par la règle pure `messagePreview` (le CSS ne fait que borner la hauteur). Sauter une ligne après « Bonjour, » ne gaspille donc pas l'aperçu.

**Métadonnées de pièce jointe** (messages) : le dashboard ne stocke pas les fichiers, seulement leur nom, format, taille et URL ; le fichier vit chez l'application FIG. Conséquence : effacer un message ici n'efface pas le fichier là-bas (question 22).

**Garde tenue par la base** (base) : une règle écrite comme contrainte SQL plutôt que dans un écran, parce que l'écran n'est pas le seul à écrire. Les dix pièces jointes au plus (`position` bornée à 0..9 et unique par message) et la liste blanche de formats (enum `attachment_content_type`) tiennent même si l'application FIG écrit en SQL direct.

**Motif LIKE échappé** (base) : dans `LIKE`, `%` et `_` sont des jokers. `containsPattern` les échappe (`\%`, `\_`) pour qu'une saisie « 100% » cherche vraiment « 100% ».
