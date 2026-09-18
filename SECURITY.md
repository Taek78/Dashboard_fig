# Signaler une faille

Ce dépôt porte le back-office d'administration de **FIG**, un service de livraison de fruits et légumes. Une faille ici touche les données de vraies personnes : clients, commandes, adresses. Merci de la signaler avant d'en parler publiquement.

## Comment signaler

Ouvrez un **avis de sécurité privé** depuis l'onglet Security du dépôt (« Report a vulnerability »). Le signalement reste invisible des autres visiteurs tant qu'il n'est pas traité.

N'ouvrez **pas** d'issue publique, et ne décrivez pas la faille dans une pull request : l'issue et la PR sont lisibles de tous, y compris de qui voudrait s'en servir.

Ce qui aide, dans l'ordre : ce qu'on obtient (lecture de données, écriture, contournement d'un rôle), la façon de le reproduire, la version ou le commit concerné. Une preuve de concept minimale suffit ; inutile d'aller chercher de vraies données.

## Ce que vous pouvez attendre

Une première réponse sous **cinq jours ouvrés**, puis un point à chaque étape. Le projet est tenu par une seule personne : les délais sont ceux d'un petit projet, pas d'une équipe d'astreinte. Si la faille est confirmée, elle est corrigée avant toute publication, et vous êtes cité dans la note de correction si vous le souhaitez.

## Périmètre

Ce qui nous intéresse : contournement d'authentification ou de rôle (`admin`, `gestionnaire`, `lecture`, `livreur`), accès aux données d'un client par l'API `/api/v1`, injection SQL, faille dans la gestion des jetons (invitation, récupération, session d'application), fuite de données personnelles dans une réponse, un journal ou un export.

Ce qui n'en est pas : les valeurs présentes dans `dashboard/test/`, `dashboard/e2e/` et `.env.example` sont des identifiants de démonstration, publics par construction, qui n'ouvrent qu'une base locale jetable ; les résultats bruts d'un scanner sans démonstration d'impact ; le déni de service par volume.

## Ce que le dépôt ne contient pas

Aucun secret de production : `.env.local` est ignoré par git, et la CI vérifie l'historique complet à chaque semaine (Gitleaks) en plus de l'analyse statique (CodeQL). Si vous pensez avoir trouvé un secret réel dans l'historique, c'est précisément un cas à signaler en privé.
