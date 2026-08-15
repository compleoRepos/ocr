# OCR CIN App

Application web TypeScript pour lire automatiquement le recto d'une CIN marocaine fictive et retourner une sortie JSON structurée.

## Stack

- Front : React + TypeScript
- Back : Node.js + Express + tRPC
- OCR : Tesseract.js
- Pré-traitement d'image : sharp (redressement, niveaux de gris, normalisation du contraste, netteté)
- Validation : Zod
- Tests : Vitest

## Lancer le projet

```bash
pnpm install
pnpm dev
```

Puis ouvrez l'URL affichée par le serveur.

## Tester

```bash
pnpm test
```

## Jeu d'images fictives

Le dossier `fixtures/` contient des spécimens fictifs prêts pour la démonstration :

- `cin-valide-01.png`
- `cin-valide-02.png`
- `cin-valide-03.png`
- `cin-date-invalide.png`
- `cin-champ-manquant.png`
- `document-non-cin.png`

Ces images sont des spécimens fictifs générés pour les tests, sans données personnelles réelles.

## Images dégradées

Trois images dégradées permettent de tester la robustesse du pré-traitement :

- `cin-degradee-rotation.png` (rotation -6°)
- `cin-degradee-contraste.png` (faible contraste)
- `cin-degradee-flou.png` (flou léger)

Les résultats détaillés sur chaque image sont consignés dans `fixtures/RESULTATS.md`.

## Vidéo de démonstration de secours

Le fichier `demo/demo-soutenance-ocr-cin.mp4` enregistre le parcours complet de la soutenance : image nette, image dégradée et document non-CIN. Il peut être rejoué si la démonstration en direct échoue. Pour le régénérer :

```bash
pnpm dev          # dans un premier terminal
python3 scripts/record-demo.py
```

## Fonctionnement

1. L'utilisateur dépose une image.
2. Le front envoie l'image encodée en base64 au serveur.
3. Le serveur pré-traite l'image (redressement, niveaux de gris, normalisation, netteté).
4. Le serveur exécute l'OCR, extrait les champs et valide leur cohérence.
5. La réponse JSON indique pour chaque champ une valeur, un statut et un niveau de confiance.

## Champs extraits

- nom
- prénom
- date de naissance
- numéro de CIN
- date de fin de validité

## Robustesse

Le système distingue :

- un champ illisible ;
- une image qui n'est pas une CIN ;
- une erreur de format ou de cohérence.
