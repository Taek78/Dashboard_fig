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

**Machine d'états** : autrefois la liste blanche des passages autorisés entre statuts (`ORDER_TRANSITIONS`). Depuis le 2026-09-17, plus de règle d'étape (voir « Changement de statut libre ») : `canTransition(from, to)` n'exclut que le statut courant et `allowedTransitions(from)` renvoie les trois autres. La règle reste dans `domain/orders/status.ts` pour pouvoir être resserrée sans toucher aux écrans.

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

**Jeton d'authentification** (`auth_tokens`, `domain/auth/tokens.ts`) : un secret à usage unique lié à un compte, dont la base ne garde que le HMAC (`src/lib/secrets.ts`, clé `AUTH_SECRET`). Trois sortes : le **code de récupération** (six chiffres, 5 minutes, 5 essais, une nouvelle demande annule le précédent), le **lien d'invitation** (48 heures, pour choisir son mot de passe : création d'un compte par l'administrateur, ou « Envoyer un lien » depuis Comptes) et le **lien « Ce n'était pas moi »** (24 heures, dans chaque mail de récupération : verrouille le compte, ferme ses sessions, prévient les administrateurs). Purgés un jour après expiration, à chaque émission.

**Préchargement au survol** (`HoverPrefetchLink`, `components/ui/hover-prefetch-link.tsx`) : lien de liste dont Next ne précharge la destination qu'au survol de la souris, jamais parce qu'il entre dans la fenêtre (motif documenté par Next). Réservé aux liens des cartes de liste, nombreux et rarement suivis ; la sidebar garde le `Link` ordinaire, préchargé dès qu'il est visible. Au toucher, la navigation part au clic et le squelette de `loading.tsx` arrive avec la réponse.

**Hydratation carte par carte** (`OrdersCards`) : chaque carte de commande est enveloppée dans sa propre frontière `Suspense`, sans rien différer au rendu ; React hydrate alors les cartes une par une et le navigateur peint entre deux, ce qui avance le plus grand rendu (LCP) sur téléphone sans réduire le travail total.

**Route de santé** (`/api/health`, exploitation) : répond `{ ok: true }` (200) si la base répond à `select 1`, `{ ok: false }` (503) sinon, sans aucun détail, `Cache-Control: no-store`. Avec `HEALTH_TOKEN` dans l'environnement (facultatif en développement et dans les tests, obligatoire en production, à fournir au système de supervision), elle exige « Authorization: Bearer <jeton> » et répond 401 sans toucher à la base ; une seule sonde par fenêtre de cinq secondes, quel que soit le nombre d'appels. Exclue de l'authentification par le proxy : un moniteur n'a pas de session.

**Accessibilité automatisée** (`e2e/accessibilite.spec.ts`, axe-core) : analyse des pages publiques et des écrans principaux avec les règles WCAG 2.x A et AA et les bonnes pratiques d'axe ; seules les violations d'impact « serious » ou « critical » font échouer la suite, les autres sont jointes au rapport Playwright. Ne remplace ni la navigation au clavier ni la lecture des libellés par une personne.

**Garde d'hôte** (scripts, `src/lib/database-url.ts`) : règle pure qui refuse à un script destructeur (seed, purge RGPD, restauration, préparation de la base de test) toute base dont l'hôte n'est pas `localhost`, `127.0.0.1` ou `::1`, sauf variable explicite (`SEED_ALLOW_REMOTE=1`, `RGPD_ALLOW_REMOTE=1`). « localhost » peut être un tunnel vers la production : lire l'hôte affiché avant d'écrire.

**Récupération de compte** (pages publiques sous `/connexion`) : « Mot de passe oublié » (code par e-mail), « Adresse e-mail oubliée » (rappel par le **nom** seul, sans casse ni accent, index `users_last_name_normalized_idx` : chaque compte actif qui le porte reçoit le sien), invitation et verrouillage. Réponses identiques que le compte existe ou non ; quotas par sujet (e-mail ou nom) et par adresse IP dans `login_attempts` (`checkQuota`, `RECOVERY_*_POLICY`).

**Contrôle de vie de la session** (`isSessionAlive`, callback `jwt` de `src/auth.ts`) : à chaque lecture du jeton, le compte est relu ; désactivé, verrouillé ou mot de passe changé depuis l'ouverture de la session (`sat`, `password_changed_at`, `revokeSessions`) → session refusée et cookie effacé. Le proxy laisse passer la suppression du cookie (`stripSessionCookies`).

**Politique de mots de passe** (`domain/auth/password-policy.ts`) : 12 caractères au moins ; sous 16, trois types de caractères parmi minuscules, majuscules, chiffres, signes ; dès 16, une **phrase de passe** (quatre mots, espaces acceptés) sans autre contrainte ; jamais un mot courant (`common-passwords.ts`, racine sans chiffres ni signes de fin), ni le nom ou l'e-mail du compte, ni un motif répété, ni une suite de clavier ; pas d'expiration forcée. La **jauge** (`PasswordField`) l'applique à la frappe ; le serveur (`data/passwords.ts`) ajoute la vérification contre les fuites connues.

**Have I Been Pwned (k-anonymity)** (`data/pwned-passwords.ts`) : service public qui répertorie les mots de passe apparus dans des fuites ; seuls les cinq premiers caractères du SHA-1 du mot de passe candidat sont envoyés, la comparaison se fait sur le serveur. En panne, le mot de passe est accepté en le signalant ; `PASSWORD_BREACH_CHECK=0` coupe l'appel (suite navigateur).

**Brevo** (`data/mail.brevo.ts`) : fournisseur français d'envoi de mails transactionnels, appelé par son API HTTP avec `fetch` (clé `MAIL_API_KEY`, expéditeur `MAIL_FROM` validé chez Brevo). Le **transport « fichier »** (`data/mail.file.ts`, `MAIL_TRANSPORT=fichier`) écrit chaque mail en JSON dans `dashboard/.mail/` (développement) ou `test-results/mail` (Playwright, `e2e/mail.ts`). Contrat `MailSender`, façade `data/mail.ts` ; `trySendMail` journalise un échec (`mail_failed`) sans casser l'action.

**`after()`** (`next/server`) : exécute une fonction APRÈS l'envoi de la réponse ; les mails partent ainsi sans allonger la réponse, qui ne révèle donc pas si un compte existe.

## API de l'application

**API (`/api/v1`)** : les routes HTTP par lesquelles l'application FIG et son serveur parlent au dashboard, seul propriétaire du schéma (`docs/api.md`). Versionnée par le préfixe : un champ s'ajoute sans changer de version, un retrait ou un renommage donne un `/api/v2`.

**Route handler de l'API** : un `route.ts` sous `src/app/api/v1/` qui exporte `GET`, `POST`… enveloppés par `apiRoute` (cadre commun : adresse IP, horloge, limitation de débit, erreurs en JSON, CORS) et `OPTIONS = preflight(METHODS)`.

**Jeton de session (client)** : chaîne opaque de 32 octets remise une seule fois à l'application après un code de connexion, envoyée en `Authorization: Bearer` ; seul son HMAC est en base (`customer_sessions`), 180 jours, révocable.

**Code de connexion** : six chiffres envoyés par mail à l'adresse demandée, dix minutes, cinq essais, un seul actif par adresse ; prouve que la personne lit sa boîte, sans mot de passe à garder. Sert aussi à l'inscription (`signup_required`, puis le même code avec le profil).

**Clé de service** : secret partagé (`API_SERVICE_KEY`) que le serveur de l'application envoie en `Authorization: Bearer` pour lire la file des notifications et accuser leur envoi ; comparé à temps constant.

**Clé d'idempotence (`Idempotency-Key`)** : identifiant choisi par l'application pour une création ; la même clé avec le même corps rejoue la réponse mémorisée au lieu de créer une seconde fois (table `api_idempotency_keys`, prise atomique par `INSERT … ON CONFLICT DO NOTHING`, libérée après un échec).

**Curseur (pagination)** : au lieu d'un numéro de page, la page suivante se demande « après tel élément » (instant, identifiant) encodé en base64url ; une liste qui bouge entre deux pages ne décale rien et la base sert la page par un index composite (`keysetSlice`).

**ETag / 304** : empreinte d'une réponse publique (catalogue, articles, communautés) ; l'application la renvoie en `If-None-Match` et reçoit `304` sans corps quand rien n'a changé.

**CORS** : autorisation donnée à un navigateur d'appeler l'API depuis une autre origine ; liste blanche `API_CORS_ORIGINS`, inutile pour une application native.

**Devis** (`orders/quote.ts`) : le calcul par le dashboard des lignes (nom et prix instantanés), de la meilleure remise, des frais et du total d'un panier ; l'application le fait payer puis renvoie ce total, refusé s'il diffère (`total_mismatch`).

**Vue (API)** : fonction pure de `domain/api/views.ts` qui transforme un type métier en réponse de l'API, en laissant de côté ce que la personne ne doit pas voir (équipe affectée, notes, coordonnées des référents, marques internes des messages) ; chaque vue est vérifiée contre son schéma zod de `responses.ts`.

**OpenAPI** : description formelle de l'API (chemins, paramètres, corps, réponses, erreurs) ; construite depuis les schémas zod (`domain/api/openapi.ts`), écrite dans `docs/api/openapi.json` par `npm run api:openapi` et servie par `GET /api/v1/openapi.json`.

**Limitation de débit en mémoire** (`SlidingWindowLimiter`) : fenêtre glissante par sujet (adresse IP, session) tenue par chaque instance du serveur ; complète, sans la remplacer, la garde partagée en base des codes de connexion (`login_attempts`).

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

**Fil d'Ariane (breadcrumb)** (coquille) : la ligne « Commandes › Détail » qui situe la page dans la navigation. Retiré du bandeau le 2026-09-18 (aucun texte à côté du bouton du menu) ; la règle pure `breadcrumbFor(pathname)` reste, testée, si on veut le remettre ailleurs.

**Bouton du menu** (coquille) : en haut à gauche du bandeau, il déplie, replie ou ouvre le menu. Son icône montre le panneau du menu (large = ouvert, liseré = replié) et un chevron vers le sens du prochain clic, et s'anime à chaque clic.

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

**Personnel (staff)** (métier) : l'équipe du client, quatre métiers (livreur, préparateur de commandes, préparateur-livreur, gestionnaire), avec coordonnées, créneau de travail (matin, après-midi, soir, journée ou « 24 h/24 », sans horaire fixe), disponibilité (disponible, indisponible, en congé, arrêt maladie), jours travaillés. La liste est coupée en deux sections : « Dans l'entreprise », puis « Partis de l'entreprise » (`splitByPresence`). Les gestionnaires listés sont des personnes ; leur accès au back-office se gère dans Comptes. Son historique de traitement se calcule à partir des commandes affectées (`summarizeStaffWork`).

**Communauté** (métier) : groupe de clients qui commandent ensemble et récupèrent leurs produits à un même point de retrait, à l'horaire que chacun choisit en commandant dans l'application. Trois types (`COMMUNITY_KINDS`) : voisinage, entreprise, point relais ; publique ou privée (`visibility`), posée par l'application ; ni l'un ni l'autre n'est jamais vide. Créée par l'application FIG ; livraison offerte à toutes ; sa remise dépend de son nombre de membres (`communityDiscountPercent` : rien jusqu'à 3, −5 % de 4 à 9, −10 % dès 10) et l'application l'applique sur chaque commande des membres ; le dashboard la lit (recherche commune de la section Clients, fiche) et affiche la remise sur les commandes.

**Remise (OrderDiscount)** (métier) : réduction portée par une commande, appliquée par l'application : « communauté » (taux de la communauté) ou « fidélité » (15 %). Les deux ne se cumulent pas : la plus forte l'emporte (`bestDiscount`), donc la fidélité prête remplace la remise de la communauté sur cette commande-là. Le montant est conservé en centimes ; le total dû est le sous-total des lignes moins ce montant, plus les frais de livraison (`computeOrderTotalCents`). Source de vérité : le paiement dans l'application ; le dashboard ne la calcule jamais.

**Compteur de fidélité** (métier) : nombre de commandes cumulées d'un client, membre de communauté compris, depuis la dernière remise fidélité (`loyaltyCount`, `loyaltyStatus`). Une annulée ne compte pas et ne remet pas à zéro ; la commande qui porte la remise repart de zéro ; à huit, la prochaine commande est à −15 %. Affiché en jauge sur la fiche client et en badge sur la carte. Remplace l'ancienne « série » de commandes d'affilée (décision du client, 2026-09-16).

**Catégorie de client (basique, fidèle)** (métier) : « fidèle » pendant deux mois civils après avoir atteint huit commandes cumulées, « basique » sinon (`customerTier`, `tierFromReachedAt`). Rien n'est stocké : la catégorie et l'historique daté de ses atteintes (`loyalTierEvents`, une par cycle de huit) se déduisent des commandes, par une règle pure et par la même requête SQL. Affichée en étoiles et en couleur (token `--loyal`, or) par `TierBadge` ; l'historique est sur la fiche.

**Frais de livraison** (métier) : montant facturé par l'application à un particulier selon son panier avant remise (`deliveryFeeCents` : 4,90 € sous 5 €, 3,90 € dès 5 €, 2,90 € dès 10 €, 1,90 € dès 20 €) ; offerts à toute communauté, ce que la base impose (`orders_community_delivery_free`). Conservés sur chaque commande (`deliveryFeeCents`, instantané) et ajoutés après la remise.

**Créneau d'une heure** (métier) : une commande est livrée sur un créneau d'une heure pile entre 10:00 et 20:00, de « 10:00 → 11:00 » à « 19:00 → 20:00 » (`slotEndFor`, `DELIVERY_SLOT_STARTS`, `isDeliverySlot`), ce que les contraintes `orders_slot_one_hour` et `orders_slot_hours` de la base imposent à toute écriture, application comprise.

**Bandeau de communauté** (clients) : la bande en tête de la carte et de la fiche d'une communauté (`CommunityBanner`) : son type à gauche (voisinage, entreprise, point relais, chacun avec son icône), sa visibilité à droite (« Privé » en pastille pleine avec un cadenas, « Public » en contour avec un globe).

**Visibilité d'une communauté** (métier) : comment les clients y entrent, choisi dans l'application FIG : « public », on l'intègre directement ; « privé », sur invitation uniquement. Toujours l'une ou l'autre (la base refuse une valeur absente ou vide) ; le dashboard l'affiche et la retrouve par la recherche, sans la modifier.

**Autorisations (consentements)** (métier, RGPD) : les trois choix que la personne fait dans l'application (`CustomerConsents`) : notifications d'offres, promos et liquidations ; notification à chaque état de sa commande ; communications marketing. Datés par l'application (`updatedAt`), lus et affichés par le dashboard (`ConsentPills`), jamais modifiés par lui.

**File de notifications** (métier) : table `customer_notifications` où le dashboard **dépose** une notification d'état (`orderStatusNotification`) à chaque changement de statut fait par l'équipe, dans la transaction du statut, seulement si le client a autorisé les notifications d'état. Le dashboard n'envoie rien : l'application FIG lit les lignes sans `sentAt`, envoie par son canal et pose la date d'envoi (question 23).

**Parrainage** (métier) : chaque client a un code « Nom#0000 » (`referralCode`, attribué par l'application, format vérifié par la base) ; un nouveau client qui le saisit à l'inscription devient son **filleul** (`referredBy`). Le code, le parrain, la liste des filleuls et leur total ne sont visibles que dans la fiche du client, jamais sur une carte ; l'export RGPD ne nomme ni le parrain ni les filleuls.

**Commutateur de type** (clients) : le groupe de trois boutons radio de la section Clients (particuliers : toutes les personnes, membres de communauté compris ; communautés : les cartes des groupes seulement, jamais leurs membres ; tous), chacun dans sa couleur (`--individual`, `--community`, marque), qui remplace la liste déroulante ; coché, il lance la recherche aussitôt.

**Tri dans les deux sens** (clients) : le critère se choisit dans la liste déroulante (`sortOptions` : nom, commandes, montant, récence, ancienneté, membres), le sens par le **bouton de sens** à côté ; changer de critère revient à son sens naturel ; l'URL n'écrit le sens que s'il diffère du naturel (`?tri=commandes&sens=croissant`, `parseOrderParam` ; l'ancienne forme `?tri=commandes-croissant` reste lue par `parseSortParam`). Le tri par nombre de membres n'apparaît qu'en position « communautés », qui ne montre que les groupes.

**Date de sortie** (personnel, 2026-09-18) : le jour où une personne a quitté l'entreprise (`leftAt`, colonne `left_at`). Elle n'existe que si la case « Parti de l'entreprise » est cochée ; cocher la case demande une confirmation « Oui / Non », décocher la cache sans question. Jamais avant la date d'entrée (règle du schéma zod et contrainte de la base).

**Arrêt maladie** (personnel) : une disponibilité, comme « En congé » : la personne reste dans l'entreprise mais n'est pas présente pour les affectations (gommette rouge, alerte du tableau de bord si personne d'autre). Le dashboard n'en garde ni motif ni justificatif : ce serait une donnée de santé (RGPD, article 9).

**Journal de sécurité** (écran, 2026-09-18) : la section `/journal`, réservée à l'administrateur (`canReadSecurityLog`), qui rend lisible la table `security_events` écrite depuis la première version par `logSecurity`. En LECTURE SEULE, sans aucun bouton : un journal qu'on peut corriger ne prouve plus rien ; seule la purge RGPD (douze mois) y touche. Chaque type a son libellé français, sa **famille** (le filtre : connexion, comptes, commandes, catalogue, personnel, clients et RGPD, messages, API de l'application, envois de mails) et son **ton** (alerte en rouge, sensible en ambre, création en VERT, courant en neutre), qui donne la bande de couleur à gauche de la ligne. Le vert est réservé à la naissance d'un accès — « Compte créé » — parce que c'est l'événement qu'un administrateur relit en premier quand il vérifie qui a obtenu quoi (demande du 2026-09-18). La recherche libre porte sur le type brut et les VALEURS des détails (adresse e-mail, IP, identifiant), jamais sur les clés ni les libellés : c'est ce que la base sait reproduire à l'identique, donc ce sur quoi la parité est testée. Un type inconnu, écrit par une autre version, reste affichable mais n'appartient à aucune famille et ne remonte dans aucune famille cochée.

**Ancienneté** (clients) : critère de tri de la section Clients (`?tri=anciennete`) qui classe sur la date d'INSCRIPTION d'une personne (`Customer.createdAt`) ou de CRÉATION d'une communauté (`Community.createdAt`), à ne pas confondre avec « Date de commande », qui classe sur la dernière livraison. Sens naturel : du plus récent au plus ancien (les nouveaux arrivants en tête) ; le bouton de sens donne l'ordre inverse (`?tri=anciennete&sens=croissant`). La date est lisible sur chaque carte : « Client depuis le … », « Créée le … ».

**Envoi d'invitation constaté** (comptes, 2026-09-18) : l'envoi du lien d'invitation est ATTENDU par l'action (`sendMailChecked`), au lieu de partir après la réponse : l'écran ne dit plus « un lien lui a été envoyé » sans le savoir. Réussite, la carte porte « Invitation envoyée le … » en vert ; échec, un bloc rouge donne la **cause** (`domain/mail/failure.ts` : adresse refusée, expédition refusée, configuration, quota dépassé, service indisponible, injoignable, autre) et le **geste** qui répare, le message du formulaire passe en **avertissement** ambre (`ActionResult` `status: "warning"` : l'essentiel a réussi, la suite non), et « Renvoyer l'invitation » reste à côté. L'issue est écrite sur le compte (`users.invitation_mail_sent_at` ou `invitation_mail_failed_at` + `invitation_mail_error`, migration 0017) pour survivre au rechargement, et remise à zéro dès qu'un envoi réussit ; l'échec est journalisé (`invitation_mail_failed`, avec la cause, jamais l'adresse ni le lien).

**Bouton de sens (tri)** (clients) : bouton icône à côté de la liste des critères (`SortOrderToggle`, icône `SortOrderIcon` dessinée pour le projet) : « A / Z » pour le nom, « 1 / 9 » pour les nombres, montants et dates (`DIRECTORY_SORT_SCALES`) ; flèche vers le bas = croissant (A → Z, 1 → 9), vers le haut = décroissant ; au clic, seule la flèche pivote en 200 ms (pas d'animation si l'appareil demande moins de mouvement) et la recherche se relance.

**Fond nuancé des cartes** (clients) : les cartes clients sont légèrement teintées de la couleur « particulier » (`--individual`), les cartes communautés de la couleur « communauté » (`--community`), en dégradé du haut vers le bas ; chaque thème a ses propres teintes.

**Duplication (produit)** (catalogue) : créer une copie complète d'une fiche, nommée « (copie) » (`duplicateName`), masquée dans l'application jusqu'à relecture. Depuis la carte de la grille ou la fiche.

**`alias()` (Drizzle)** (base) : joindre deux fois la même table sous deux noms (`preparer`, `driver`) dans une requête, pour lire les deux personnes affectées à une commande en un seul `SELECT`.

**Rafraîchissement de session (glissant)** (sécurité) : Auth.js re-signe le jeton et re-pose le cookie à chaque lecture de session, pour prolonger une session active. Effet de bord : une réponse de préchargement encore en vol après la déconnexion re-posait un cookie valide. Le proxy retire ce cookie des réponses de préchargement et tant que le jeton a moins de la moitié de sa vie (`src/lib/session-refresh.ts`).

**Recherche et filtres d'URL** (commandes) : la barre `OrdersFilters` est un formulaire GET automatique (`AutoSubmitForm`), chaque champ devient un paramètre (`?q=benali&du=2026-09-01&au=2026-09-07&livreur=aucun`). L'URL est la source de vérité : partageable, retour arrière gratuit, relue par `parseOrderFilters` (tolérant) et réécrite par `orderFiltersQuery` pour la pagination et les raccourcis. `aucun` demande les commandes sans personne affectée.

**Période « du / au »** (toutes les recherches par dates) : les deux champs de dates forment UN filtre, groupés dans un même cadre (`DateRangeFields`). Règle commune (`readDateRange`, `parsePeriodInput`) : une seule date = ce jour-là ; deux dates ordonnées (le même jour compris) = la période ; deux dates inversées = erreur en rouge et aucune période appliquée, la saisie n'est jamais corrigée en silence. Décision du client, 2026-09-16.

**Calendrier des dates** (toutes les recherches par dates) : sur tablette et PC, le bouton à droite de chaque champ « du / au » ouvre le calendrier maison (`DatePickerButton`, règles pures de `src/lib/calendar.ts`) à la place du sélecteur du navigateur : six semaines du lundi au dimanche, jours des mois voisins grisés, aujourd'hui cerclé, date choisie pleine ; à chaque ouverture il affiche le mois de la date saisie, sinon celui de l'autre borne, sinon le mois actuel ; clavier complet (flèches, Début / Fin, Page préc. / suiv., Échap ; Alt + flèche bas depuis le champ). Sur téléphone, le sélecteur natif du système reste. Décision du client, 2026-09-16.

**Bandeau de période vide** (toutes les recherches par dates) : le message bleu (`PeriodEmptyNotice`, token `--info`, `role="status"`) qui dit qu'une période valide n'a rien trouvé (« Aucune commande livrée du … au … »), avec un lien vers toutes les dates qui garde les autres filtres. Ni une erreur ni une liste vide : une absence d'activité, visible d'un coup d'œil.

**Raccourcis des 7 derniers jours** (commandes) : une rangée de liens, un par jour jusqu'à aujourd'hui, chacun avec son nombre de livraisons compté par la base (`getDeliveryDayCounts`, `recentDeliveryDaysFromCounts`), plus « Les 7 jours ». Hérités de l'ancienne section Livraisons, fondue dans Commandes le 2026-09-16 (`/livraisons` redirige) ; chaque lien garde la recherche en cours.

**Barre d'avancement segmentée** (tableau de bord) : barre découpée en segments proportionnels, un par statut (livrées, annulées, expédiées, en préparation), accompagnée d'une légende chiffrée, à partir des totaux agrégés (`tourProgressFromCounts`). « Traitée » veut dire livrée ou annulée : il ne reste rien à faire.

**Gommette de présence** (affectation) : le caractère 🟢 ou 🔴 devant chaque nom dans les listes déroulantes de préparateur et de livreur (`staffOptionLabel`) : vert si la personne est « disponible », rouge sinon, quelle que soit la raison (congé, indisponible), la raison suivant en texte. Un `<select>` natif n'accepte ni icône ni couleur CSS dans ses options, surtout sur téléphone : un caractère passe partout. Elle ne sert qu'à affecter le jour même : sur une commande terminée (livrée ou annulée), la gommette du préparateur et du livreur est grise.

**Statut de vente (produit)** (catalogue) : déduit, jamais stocké (`productSaleStatus`) : « Masqué » (absent de l'application), « Indisponible » (retiré de la vente à la main), « Rupture de stock » (stock à 0, sauf paramètre du catalogue), « En vente ». Affiché en pastille sur l'image de la carte produit (`ProductStatusBadge`) ; le pied de carte ne montre que le stock et l'alerte « Stock bas ».

**Paramètre du catalogue (vente à stock 0)** (catalogue) : case entre la recherche et la grille du catalogue, « Laisser en vente les produits dont le stock est à 0 » : cochée, un produit épuisé garde le statut « En vente » ; décochée (par défaut), il passe en « Rupture de stock ». Une seule valeur pour tout le catalogue (table `catalog_settings`), écrite par `saveCatalogSettings` (rôles qui modifient le catalogue), lue par l'application FIG.

**Dates avec l'année** (tous les écrans) : toute date affichée porte son année (« jeu. 12 mars 2026 ») ; une période dans une même année ne l'écrit qu'une fois (« du sam. 5 sept. au mer. 9 sept. 2026 »). Seuls les repères sous l'axe du graphe d'évolution l'omettent, l'infobulle et l'en-tête la donnant. Décision du client, 2026-09-16.

**Alerte de personnel** (tableau de bord) : le bandeau rouge (`StaffShortageAlert`, `role="alert"`) placé avant tout le reste quand aucun préparateur, ou aucun livreur, n'est présent (`unavailableRoles` : dans l'équipe et « disponible »). Rien ne peut alors être préparé ou livré ; un lien mène au métier concerné dans le personnel.

**Réclamations (métrique)** (métriques) : le nombre de messages « Nous contacter » reçus sur la période dont l'objet est une réclamation (`CLAIM_SUBJECTS` : produit manquant ou abîmé, problème de livraison, erreur sur la commande, remboursement ou avoir), quel que soit leur statut (`countComplaints`, règle pure et requête SQL). Remplace le chiffre venu des stores (colonne supprimée en 0010).

**Parrainages (métrique)** (métriques) : parmi les clients inscrits sur la période (jour d'inscription), ceux qui ont saisi le code d'un parrain (`signupStats`, `getSignupStats`) ; affichés avec le nombre de nouveaux clients et la part parrainée en camembert.

**Source de vérité** (branchement) : le système dont la valeur fait foi quand deux copies divergent. Pour FIG, l'application : le montant d'une remise est celui du paiement, l'horaire de retrait est celui choisi à la commande. Le dashboard affiche ces valeurs, il ne les recalcule pas.

**Type de client (particulier, communauté)** (métier) : une personne est TOUJOURS un particulier, membre d'une communauté ou non ; une communauté est un groupe de particuliers, jamais une personne (décision du client, 2026-09-16). Une personne ou sa commande affiche « Particulier », suivi du badge « Communauté » et du nom du groupe si elle en est membre (`CustomerTypeLabels`, `CommunityMemberBadge`) ; seules la carte et la fiche d'une communauté portent le type « Communauté » (`ClientTypeLabel`). Icône et code couleur (tokens `--individual`, `--community`) : une personne, sa carte, son avatar et ses commandes sont en bleu « particulier », membre ou non ; seul son badge d'appartenance est en couleur communauté ; le nom de la communauté passe à la ligne au lieu de déborder.

**Badge « Communauté » (membre)** (clients) : le badge posé à côté de « Particulier » quand la personne fait partie d'une communauté, avec le nom du groupe ; il dit l'appartenance, pas le type.

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

**Expédiée** (commandes) : libellé du statut `delivering` : la commande a quitté l'atelier et est en cours de livraison. Parcours nominal : en préparation → expédiée → livrée ; depuis le 2026-09-17, tout changement de statut est permis (voir « Changement de statut libre »).

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

**Métadonnées de pièce jointe** (messages) : nom, format et taille d'un fichier joint, recopiés dans `message_attachments` pour que la liste et la fiche d'un message s'affichent sans lire les octets. Le fichier lui-même est dans `message_uploads` depuis le 2026-09-18.

**Téléversement** (messages, API) : l'envoi d'un fichier par l'application au dashboard (`POST /api/v1/fichiers`), AVANT le message qui le cite. Un fichier téléversé est « en attente » tant qu'aucun message ne l'a joint ; il ne peut être joint qu'une fois, et seulement par la personne qui l'a envoyé ; jamais joint, il est effacé après 24 heures.

**Signature d'un fichier** (sécurité) : ses premiers octets, qui disent son vrai format quel que soit son nom ou le type annoncé (`%PDF-` pour un PDF, `89 50 4E 47` pour un PNG). Le dashboard compare le type annoncé à la signature (`detectAttachmentType`) : un script renommé en `.png` est refusé, parce qu'il serait ensuite servi par notre propre domaine.

**`nosniff`** (sécurité, HTTP) : l'en-tête `X-Content-Type-Options: nosniff` interdit au navigateur de deviner un autre type que celui annoncé par le serveur. Posé sur chaque fichier servi, avec le type vérifié au téléversement.

**Archive ZIP « stockée »** (messages) : un fichier ZIP qui range les pièces jointes d'un message SANS les recompresser (méthode 0) : photos et PDF sont déjà compressés. Écrite par `src/lib/zip.ts` (en-tête local, octets, répertoire central), relue par les tests et vérifiée avec le module `zipfile` de Python.

**Bouton marche / arrêt** (coquille) : le rond au symbole universel (le 1 dans le 0), en haut à droite du bandeau, qui sert à se déconnecter ; il demande toujours confirmation (« Voulez-vous vraiment vous déconnecter ? »).

**Fenêtre de confirmation** (écrans) : la boîte qui interrompt une action définitive par une question et deux réponses (« Confirmer / Annuler » pour supprimer un produit, une personne ou un article ; « Oui / Non » pour se déconnecter). Le focus va d'abord sur la réponse sans risque ; un clic à côté ne la ferme pas.

**Bouton œil** (connexion) : le petit bouton dans le champ du mot de passe qui l'affiche en clair (œil ouvert) ou le masque de nouveau (œil barré), pour vérifier ce qu'on a tapé.

**Néon** (design) : un halo lumineux léger de la couleur d'un élément, obtenu par une ombre floue (`box-shadow`, `drop-shadow`) ; au survol des icônes Facebook et Instagram du pied du menu.

**Accusé d'envoi** (notifications, 2026-09-18) : la confirmation, par le serveur de l'application, qu'une notification est bien partie vers le téléphone du client (`POST /service/notifications/{id}/envoi`, `sent_at`). Tant qu'il n'est pas arrivé, un spinner tourne à côté de « Client notifié » ; s'il ne vient pas en 90 s, ou si l'application déclare un **échec d'envoi** (`…/echec`, `failed_at`), le badge devient rouge avec un bouton « Réessayer » qui remet la notification dans la file.

**Section illuminée** (menu, 2026-09-18) : l'entrée Commandes ou Messages du menu entourée d'un halo lumineux qui respire, avec le nombre de nouveautés, dès qu'une commande ou un message arrive, jusqu'à ce qu'on l'ouvre (`nav-lit`). Sur téléphone, un point lumineux sur le bouton du menu.

**Notification système** (navigateur) : la bulle du système d'exploitation (centre de notifications de Windows), envoyée par la page avec la permission de la personne (Notification API). Le back-office s'en sert, sur ordinateur, quand il n'est pas au premier plan, avec le compte dans le titre de l'onglet et le **badge de l'application** (pastille chiffrée sur l'icône d'une application installée, Badging API).

**Préparateur-livreur** (personnel, 2026-09-18) : le métier d'une personne qui prépare ET livre ; elle est proposée dans les deux listes d'affectation d'une commande et peut tenir les deux rôles de la même commande (`KINDS_FOR_ROLE`). Présente, elle lève à elle seule l'alerte « aucun préparateur » et « aucun livreur ».

**Notification groupée** (alertes en direct) : une seule notification s'affiche à la fois ; ce qui arrive pendant qu'elle est visible s'y ajoute et relance ses 4 s (« 3 nouvelles commandes », « 2 commandes · 1 message »), au lieu d'empiler des cartes (`summarizeNotices`).

**Alerte en direct** (écrans, 2026-09-18) : la notification qui descend de sous le bandeau pendant 4 s quand une commande arrive, qu'un client écrit, ou qu'un produit passe en stock critique ou à 0. Le navigateur **relève** (*polling*) le flux `GET /alertes` toutes les 5 s et le compare au relevé précédent : seul ce qui est nouveau depuis l'ouverture de la page est annoncé. Une nouvelle commande sonne.

**Polling (relevé périodique)** : le navigateur redemande régulièrement au serveur s'il y a du nouveau, au lieu que le serveur le prévienne (WebSocket, Server-Sent Events). Plus simple, suffisant pour une petite équipe ; le prix est une requête courte toutes les 5 s par onglet visible.

**Web Audio API** : l'interface du navigateur qui synthétise un son (oscillateur, volume) sans fichier audio ; le carillon d'une nouvelle commande en est fait (`src/lib/chime.ts`). Les navigateurs le gardent muet jusqu'au premier clic ou à la première touche sur la page (*autoplay policy*).

**Horloge du tableau de bord** (tableau de bord, métriques) : en haut à droite, le jour en toutes lettres et l'heure de Paris dessous ; seuls les chiffres qui changent défilent à chaque minute (`DashboardClock`).

**inline / attachment** (HTTP) : les deux valeurs de `Content-Disposition`. `inline` affiche le fichier dans l'onglet (les images), `attachment` le télécharge (PDF, HEIC, HEIF) : rien de ce qu'un client a envoyé ne s'ouvre comme une page de notre domaine.

**Garde tenue par la base** (base) : une règle écrite comme contrainte SQL plutôt que dans un écran, parce que l'écran n'est pas le seul à écrire. Les dix pièces jointes au plus (`position` bornée à 0..9 et unique par message) et la liste blanche de formats (enum `attachment_content_type`) tiennent même si l'application FIG écrit en SQL direct.

**Motif LIKE échappé** (base) : dans `LIKE`, `%` et `_` sont des jokers. `containsPattern` les échappe (`\%`, `\_`) pour qu'une saisie « 100% » cherche vraiment « 100% ».

**Panneau de filtres** (toutes les recherches) : sous la barre de recherche, la surface teintée (`FilterTray`, utilitaire `surface-tray`) qui porte les filtres : en tête l'intitulé « Filtres » et, à droite, le lien « Réinitialiser » ; puis les champs, et en dernière ligne la zone de dates s'il y en a une. Les champs posés dessus reprennent la couleur de la carte. Décision du client, 2026-09-17.

**Zone de dates** (commandes, messages, historiques des fiches, tableau de bord, métriques) : l'espace dédié aux deux champs « du / au » (`DateRangeFields`) : un en-tête (icône, intitulé, et à droite des raccourcis ou un lien), les deux champs à la hauteur des autres, chacun avec son préfixe visible « Du » / « Au », puis l'erreur ou la période affichée. Dernière ligne d'un panneau de filtres (variante « row ») ou seule sur sa propre surface (variante « zone », période personnalisée du tableau de bord et des métriques, historique d'un client).

**Avancement des commandes listées** (commandes) : sous le compteur de `/commandes`, la barre segmentée par statut (`TourProgress`) de TOUTES les commandes qui passent la recherche et les filtres, pas seulement de la page affichée : le nombre par statut est compté par la base (`getOrderStatusCounts`, même WHERE que la liste). Sans filtre, elle dit ce qui reste à traiter sur tout l'historique ; avec un jour choisi, c'est la tournée. Sur le tableau de bord, sans commande, un état vide « Aucune commande » bien visible la remplace.

**Scène de connexion** (connexion) : le décor animé de la page de connexion (`LoginScene`, CSS « Connexion » de `globals.css`) : balayage de dégradé, motif verger qui respire, orbes de lumière aux couleurs du thème, mot FIG en filigrane, particules, parallaxe au pointeur ; la carte de connexion en verre au centre. Aucun faux contenu, tout en tokens, immobile pour qui refuse le mouvement.

**Type de commande** (commandes) : une commande est de type **particulier** (livrée chez la personne) ou **communauté** (commande GROUPÉE portée par une communauté). Déduit, jamais stocké (`orderKindOf` : une communauté portée = communauté). Pour une commande de communauté, le client affiché est la communauté, et dessous l'**interlocuteur** : la personne qui a commandé, garante, à qui tout est livré. Code couleur des tokens `--individual` et `--community` sur la bande de la carte, le badge et la pastille des tableaux. Filtre `?type=particulier|communaute` dans les commandes (commutateur coloré, `TypeSwitch`, partagé avec les Clients). Décision du client, 2026-09-17.

**Période personnalisée** (tableau de bord, métriques) : le dernier choix de la liste « Période » (`CUSTOM_PERIOD`, `?periode=personnalisee`). Lui seul fait apparaître la zone de dates « du / au » : `PeriodChooser` (composant client) la monte dès le choix et la démonte pour toute période prédéfinie, si bien que des dates tapées puis abandonnées ne partent pas dans l'URL. Sans plage effective (rien saisi, ou dates inversées), la période prédéfinie de l'URL ou le défaut reste affichée, et la légende « Période affichée » le dit. Seul ce choix demande de cliquer sur « Afficher » (une période prédéfinie s'applique dès qu'on la choisit, 2026-09-18). Des dates dans l'URL ouvrent aussi la zone (anciens liens) ; `periodParams` rejoue le choix dans les liens HT / TTC. Décision du client, 2026-09-17.

**Changement de statut libre** (commandes) : depuis le 2026-09-17, plus de règle d'étape entre les statuts. La liste déroulante du statut (`OrderStatusSelect`, sur les cartes et la fiche) propose toujours les quatre statuts et écrit dès le choix : livrée directement, retour en préparation, reprise d'une annulée. `canTransition` n'exclut que le statut courant, `allowedTransitions` renvoie les trois autres ; l'annulation exige toujours son motif, demandé avant « Confirmer l'annulation ». À côté de la liste, l'icône du statut choisi dans sa couleur (ambre en préparation, bleu expédiée, vert livrée, rouge annulée), la liste prenant la même couleur ; le libellé reste écrit. Chaque changement dépose la notification d'état pour le client qui l'a autorisée, retour en préparation compris, sauf si la case « Notifier le client » (cochée par défaut) a été décochée : rien n'est déposé, même avec l'autorisation. Sous la confirmation du changement, une seconde ligne dit « Client notifié » (badge de validation vert) ou « Client non notifié » (gris). La case se décoche d'elle-même dès que la commande est passée une fois par « livrée » (`wasDelivered`, relu dans l'historique avec la commande), et elle est désactivée avec le libellé « Notifications non autorisées par le client » quand le client n'a pas donné l'autorisation (`customer.notifyOrderStatus`, porté par la commande).

**Prénom et nom d'un compte** (comptes) : depuis le 2026-09-17, un compte du back-office porte un prénom et un nom séparés (`first_name`, `last_name`, migration 0014 qui découpe les anciens noms : premier mot = prénom, le reste = nom). Le couple est unique sans casse ni accent ; l'affichage « Prénom Nom » (`fullName`) est dérivé, jamais stocké. « Adresse e-mail oubliée » ne demande que le nom : chaque compte actif qui le porte reçoit son propre rappel (deux homonymes en reçoivent chacun un, à leur adresse). L'e-mail d'un compte se lit sur sa carte mais ne se modifie pas.

**Suppression d'un compte** (comptes) : définitive, confirmée par le mot `SUPPRIMER` tapé par l'administrateur (`deleteAccount`) ; ses jetons partent en cascade, ses sessions tombent à la requête suivante, l'historique des commandes garde le nom écrit. Jamais son propre compte, jamais le **dernier administrateur actif** (`isLastActiveAdmin`) : celui-là n'est ni supprimable, ni désactivable, ni rétrogradable, et l'écran le dit ; d'autres administrateurs peuvent être créés puis supprimés tant qu'il en reste un. Pour un départ, préférer « Désactiver » (le compte reste consultable). Dans les deux cas, la personne reçoit un mail (`accountDeactivatedMail`, `accountDeletedMail`) : la date, ce que cela change, l'administrateur à contacter pour plus d'informations ; l'avis de suppression, envoyé à l'ancienne adresse, dit qu'un nouveau compte peut y être créé sur invitation, seul un administrateur étant habilité à créer un compte. Un compte **en attente d'activation** ne passe pas par là : on annule son invitation (entrée suivante).

**Invitation en attente / expirée** (comptes, 2026-09-17) : un compte créé sans mot de passe reste **en attente d'activation** tant que la personne n'a pas choisi le sien par le lien reçu (48 h) : carte translucide bordée de pointillés ambre, validité du lien affichée, gestes « Renvoyer l'invitation » et « Annuler l'invitation » (le compte, jamais activé, est supprimé ; `cancelInvitation`, journal `invitation_cancelled` ; depuis le 2026-09-18 un avis part à la personne, `invitationCancelledMail`, mais seulement si son invitation était bien partie : à quoi bon écrire à une adresse qui a déjà refusé le premier envoi) ; ni « Désactiver » ni « Supprimer » entre-temps. Passé le délai, l'invitation est **expirée** (carte rouge) et le **balayage** (`notifyExpiredInvitations`, `data/invitation-expiry.ts`, lancé une minute après le démarrage du serveur puis toutes les quinze minutes, et après la réponse de la page Comptes) prévient par mail, une seule fois par lien, la personne (`invitationExpiredMail` : rien d'activé, nouveau lien à demander à l'administrateur, seul habilité) et chaque administrateur actif (`adminInvitationExpiredMail` : renvoyer ou annuler) ; la colonne `users.invitation_expired_at` (migration 0015) garde l'expiration du lien notifié, un lien renvoyé depuis redevenant notifiable. À l'**activation** (lien accepté, ou premier mot de passe posé par le dépannage), un avis part à la personne (`accountActivatedMail` : adresse de connexion, identifiant, rôle, administrateur à contacter, jamais le mot de passe) et aux administrateurs (`adminAccountActivatedMail`). Tous les avis à une personne donnent l'ADRESSE de l'administrateur, jamais son nom (`adminContact`, demande du 2026-09-18) : « contactez votre administrateur (admin@fig.fr) » ; sans adresse connue, « votre administrateur » seul. L'invitation dit « L'administrateur vous a créé un compte », et l'avis d'activation « celui que l'administrateur vous a attribué ». Seuls les avis ENTRE administrateurs nomment celui qui a agi. Un administrateur invité qui n'a pas activé son compte n'est pas un **administrateur actif** (`activeAdmins`).
