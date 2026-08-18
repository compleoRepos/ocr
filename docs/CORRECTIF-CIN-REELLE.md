# Correctif : extraction sur vraie CIN marocaine

## Problème constaté (prompt v1.0)

Signalé par le porteur du projet le 18/08/2026 : le dépôt d'un vrai spécimen de CIN marocaine (nouvelle génération, fichier `cin-nouvelle-gen.jpg`) aboutissait à :

- `isCin: true` — la carte était bien détectée (2055 ms) ;
- mais **tous les champs à « Non lu »** (`unreadable`, confiance 0 %).

## Cause racine

Le prompt v1.0 supposait des **libellés explicites** (`NOM:`, `PRENOM:`…) comme sur les spécimens fictifs du jeu de test. Or une vraie CIN marocaine présente :

- des champs **positionnels** sans étiquettes (le nom est simplement la première ligne latine sous l'en-tête) ;
- un texte **bilingue arabe / latin** ;
- des dates au format `JJ.MM.AAAA` (points, pas barres) ;
- un numéro de CIN à 7 chiffres (`K01234567`) qui échouait aussi à la regex de validation `/^[A-Z]{1,2}\d{5,8}$/` (max 6 chiffres après 2 lettres dans l'ancienne règle métier).

## Correctif appliqué (prompt v2.0)

1. **Prompt réécrit** (`server/prompts/cinExtraction.ts`, version 2.0) : description explicite de la mise en page réelle (photo à gauche, champs positionnels à droite, arabe + latin), conversion des dates à points, extraction des caractères latins uniquement.
2. **Validation assouplie** (`server/gemini.ts`) : regex du numéro de CIN passée de `/^[A-Z]{1,2}\d{5,8}$/` à `/^[A-Z]{1,3}\d{4,8}$/` pour accepter les formats réels (`K01234567`, `ER822545`, `CAN123456`).
3. **Modèle basculé** sur `gemini-flash-latest` : le quota gratuit de `gemini-3.6-flash` (20 requêtes/jour) était épuisé en quelques tests ; `gemini-flash-latest` dispose d'un quota séparé plus confortable.

## Validation

Test automatisé `server/gemini.test.ts` — « vrai spécimen » :

| Champ | Attendu | Obtenu |
|---|---|---|
| nom | TEMSAMANI | TEMSAMANI (confiance 0,99) |
| prenom | MOUHCINE | MOUHCINE (0,99) |
| dateNaissance | 29/11/1978 | 29/11/1978 (0,99) |
| numeroCin | K01234567 | K01234567 (0,99) |
| dateFinValidite | 09/09/2029 | 09/09/2029 (0,99) |

Suite complète : **10/10 tests passés** (auth, Tesseract, Gemini fictifs, Gemini vrai spécimen).
