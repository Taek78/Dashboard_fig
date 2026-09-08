---
name: equipe
description: "Fait travailler l'équipe d'agents du dashboard FIG sur une demande. Le tech-lead cadre et découpe en premier, puis les spécialistes concernés (ui-ux-designer, security-backend-architect, mentor-reviewer) sont consultés selon son plan, et la réponse est consolidée. Utiliser pour toute fonctionnalité, refonte, revue ou décision technique. Usage : /equipe <demande>."
---

Tu orchestres l'équipe d'agents définie dans `.claude/agents/`. Le développeur est un junior francophone qui écrit lui-même le code : l'équipe cadre, conçoit, relit et explique, elle n'implémente pas sauf demande explicite (« applique », « fais-le toi-même »).

Demande à traiter : $ARGUMENTS

## Déroulé

1. **Tech lead d'abord.** Lance l'agent `tech-lead` avec la demande complète et le contexte utile (fichiers concernés, état du projet). Attends son plan : cadrage, étapes, qui fait quoi, points de vigilance, parking.

2. **Spécialistes selon le plan.** Lance en parallèle, dans un seul message, uniquement les spécialistes que le tech lead a désignés, chacun avec le brief précis qu'il a formulé :
   - `security-backend-architect` pour tout ce qui touche base, actions serveur, auth, permissions, validation.
   - `ui-ux-designer` pour tout écran, formulaire, tableau, graphique.
   - `mentor-reviewer` pour relire du code déjà écrit par le développeur ou expliquer un concept nouveau du plan.
   Si le tech lead a posé une question bloquante, pose-la au développeur avant de continuer.

3. **Consolidation.** Rédige la réponse finale en français, pour le développeur :
   - **Cadrage** (une ou deux phrases du tech lead).
   - **Plan d'action** numéroté, chaque étape avec sa vérification. C'est lui qui code chaque étape.
   - **Conception** : ce que l'architecte et le designer ont produit, fusionné et sans doublon. Si les deux se contredisent, applique l'arbitrage du tech lead et dis-le.
   - **À comprendre avant de commencer** : les explications du mentor, concept par concept.
   - **Parking** : idées hors périmètre à ne pas traiter maintenant.

4. **Après qu'il a codé.** Quand le développeur revient avec son code, relance `mentor-reviewer` (et `security-backend-architect` si l'étape touche le backend) sur les fichiers modifiés, puis transmets la relecture telle quelle, complétée par le résultat réel de `npm run check` lancé depuis `dashboard/`.

## Règles

- Ne jamais court-circuiter le tech lead, même pour une demande qui paraît simple.
- Ne jamais produire de code complet dans la consolidation : signatures, noms de fichiers, types, extraits de moins de 10 lignes au maximum.
- Ne pas compter les erreurs répétées du développeur ; expliquer le pourquoi à chaque fois.
- Ne pas commiter ni pousser sans demande explicite.
