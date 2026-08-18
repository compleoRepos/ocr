# Questions / réponses de soutenance

Préparation aux questions du jury pour le projet « Lecture automatisée d'une CIN marocaine ». Chaque réponse s'appuie sur ce qui a réellement été implémenté.

## Compréhension du besoin

**Q : Quel problème votre système résout-il ?**
Il supprime la ressaisie manuelle des pièces justificatives : on dépose le recto d'une CIN et le système retourne les cinq champs clés (nom, prénom, date de naissance, numéro de CIN, date de fin de validité) en JSON structuré, directement exploitable par un autre système.

**Q : Pourquoi avoir limité le périmètre au recto et aux champs latins ?**
Pour livrer quelque chose de fiable plutôt que quelque chose de large. L'arabe, le verso et les photos fortement dégradées sont des problèmes nettement plus durs ; je les ai écartés explicitement et je le dis dans la présentation. Une solution crédible sait dire ce qu'elle ne fait pas.

**Q : Quelle est votre définition du succès ?**
Trois critères : une application qui tourne réellement (pas une maquette), un JSON exploitable avec statut par champ, et une gestion honnête des échecs — le système signale ce qu'il n'a pas réussi à lire au lieu d'inventer.

## Choix techniques

**Q : Pourquoi Gemini Flash plutôt qu'un OCR classique ?**
Les deux sont implémentés. Gemini Flash est le moteur principal car sa qualité de vision sur documents réels est bien supérieure — il comprend la mise en page, pas seulement les caractères. Tesseract.js reste comme repli local hors-ligne. Le choix est configurable par la variable `OCR_ENGINE`.

**Q : Pourquoi pas un modèle hébergé chez vous, avec GPU ?**
La contrainte de l'étude de cas imposait le gratuit. Gemini Flash tourne sur l'infrastructure de Google via une API — aucun GPU local n'est nécessaire, ce qui rend l'installation développeur triviale (`pnpm install && pnpm dev`).

**Q : Pourquoi React et pas Angular ?**
Pour un front simple et rapide à faire évoluer : une seule page, un dépôt de fichier, un affichage de résultats. Angular aurait ajouté de la structure sans bénéfice à cette échelle. Le back est en Node.js/Express avec tRPC pour le typage de bout en bout.

**Q : Comment est structurée la sortie JSON ?**
Pour chaque champ : `value` (null si non lu), `status` (`ok` / `invalid` / `unreadable`), `confidence` (0 à 1) et un `message` explicite. Au niveau document : `isCin`, `documentType`, `errors[]`, `rawText` et `processingMs`. Le contrat est partagé entre front et back dans `shared/types.ts`.

## Le prompt et le modèle

**Q : Comment avez-vous conçu le prompt ?**
Le prompt est versionné dans le code (`server/prompts/cinExtraction.ts`). La version 2.0 décrit la mise en page réelle d'une CIN : photo à gauche, champs positionnels à droite, texte arabe et latin, dates au format JJ.MM.AAAA. Il impose une sortie JSON stricte, un null explicite pour tout champ illisible, et `isCin=false` si le document n'est pas une CIN.

**Q : Qu'est-ce qui a le plus influencé la qualité : le modèle ou le prompt ?**
Le prompt, de loin. Preuve : avec le même modèle, le prompt v1 échouait complètement sur une vraie CIN (tous champs « Non lu ») parce qu'il cherchait des libellés explicites (« NOM : ») qui n'existent pas sur une carte réelle. Après réécriture du prompt pour décrire la mise en page positionnelle, l'extraction est passée à 99 % de confiance sur le même spécimen.

**Q : Racontez une difficulté inattendue.**
Exactement celle-là : le test sur une vraie CIN trouvée sur Internet a révélé que mes spécimens fictifs étaient trop « aimables » — ils avaient des libellés que les vraies cartes n'ont pas. J'ai documenté ce correctif dans `docs/CORRECTIF-CIN-REELLE.md` : cause racine, correction, validation. C'est la différence entre un système qui marche sur ses propres tests et un système qui marche sur le réel.

## Robustesse et gestion des échecs

**Q : Que se passe-t-il quand la lecture rate ?**
Trois cas, tous testés : un champ illisible ressort en `unreadable` avec confiance 0 — jamais de valeur inventée ; un document qui n'est pas une CIN est rejeté avec `isCin=false` et une erreur explicite ; une erreur technique (fichier non-image, modèle indisponible) est renvoyée proprement sans faire tomber l'application.

**Q : Et si le quota gratuit de l'API est dépassé ?**
C'est le cas le plus intéressant : le système détecte le 429 et **bascule automatiquement** sur le moteur local Tesseract. L'utilisateur ne voit jamais d'erreur bloquante — juste une note discrète indiquant que l'extraction a été faite par le moteur de repli. J'ai validé ce comportement de bout en bout : quota épuisé, extraction quand même correcte.

**Q : Comment validez-vous la cohérence métier ?**
Après la réponse du modèle, le serveur vérifie le format du numéro de CIN (regex assouplie pour les formats réels : `K01234567`, `ER822545`) et la plausibilité des dates — un 31 février est marqué `invalid`, pas accepté. La validation est indépendante du modèle : même si celui-ci hallucine, la couche métier filtre.

## Tests et résultats

**Q : Comment avez-vous testé ?**
Dix tests automatisés Vitest : extraction sur CIN valide, date invalide signalée, document non-CIN rejeté, trois images dégradées (rotation, faible contraste, flou) lues grâce au pré-traitement sharp, deux cas Gemini, et un test dédié au vrai spécimen. Plus un test d'API de bout en bout pour le repli automatique.

**Q : Quels sont vos résultats ?**
Sur le jeu fictif : extraction complète sur les images nettes, comportement correct sur les cas partiels (date invalide, champ manquant), rejet propre du non-CIN. Sur le spécimen réel : les cinq champs extraits à 99 % de confiance. Les résultats image par image sont consignés dans `fixtures/RESULTATS.md`.

**Q : Quel est le temps de réponse ?**
Environ 2 secondes par image avec Gemini Flash, moins d'une seconde avec Tesseract en local.

## Limites et suite

**Q : Quelles sont les limites honnêtes de votre solution ?**
Trois : elle ne traite pas l'arabe, elle ne gère pas le verso, et elle dépend d'une clé API dont le palier gratuit a un quota journalier — même si le repli automatique masque ce quota à l'utilisateur. Sur des photos réelles très dégradées, la qualité reste à démontrer.

**Q : Avec une semaine de plus, que feriez-vous ?**
D'abord un pré-traitement plus poussé (détection et recadrage automatique de la carte dans la photo), ensuite une comparaison chiffrée Gemini / Tesseract / un autre modèle de vision sur un jeu plus large, et enfin des seuils de confiance calibrés sur davantage de spécimens réels.

**Q : Ce système pourrait-il aller en production ?**
La structure, oui : pipeline clair, contrat JSON propre, tests, repli automatique, gestion d'erreurs. Mais il faudrait avant : une clé API payante avec quota adapté, le chiffrement des images en transit et au repos (données personnelles), une politique de rétention conforme au RGPD, et une validation sur un volume représentatif de vraies cartes.

## Sécurité et conformité

**Q : Vous avez mis une clé API dans le dépôt public. C'est un problème ?**
Oui, et je le sais : c'est un choix assumé pour simplifier l'installation des évaluateurs, documenté dans le README. La clé est du palier gratuit, sans facturation possible ; la variable d'environnement `GEMINI_API_KEY` a toujours la priorité pour un usage sérieux. En production, une clé ne se commit jamais — elle va dans un gestionnaire de secrets.

**Q : Qu'en est-il des données personnelles ?**
Le jeu de test est entièrement fictif — les images sont des spécimens générés, sans donnée réelle. Pour un usage réel, une CIN est une donnée personnelle sensible : il faudrait chiffrement, minimisation de la rétention, et information de l'utilisateur conformément au RGPD.

## Retour d'expérience

**Q : Qu'avez-vous appris de ce projet ?**
Trois choses. Un : l'écart entre « ça marche sur mes tests » et « ça marche sur le réel » — le correctif du prompt v2 en est la preuve. Deux : la fiabilité vaut autant que la précision — un système qui dit honnêtement « je n'ai pas lu » est plus utile qu'un système qui devine. Trois : le prompt est un artefact d'ingénierie à part entière — il se versionne, se teste et se documente comme du code.

**Q : Si c'était à refaire ?**
Je commencerais par tester sur de vrais spécimens dès le premier jour, avant même de finaliser le jeu fictif. Cela m'aurait évité de construire un prompt sur des hypothèses trop confortables.
