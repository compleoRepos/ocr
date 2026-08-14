# OCR CIN App

Application web TypeScript pour lire automatiquement le recto d'une CIN marocaine fictive et retourner une sortie JSON structurée.

## Stack

- Front : React + TypeScript
- Back : Node.js + Express + tRPC
- OCR : Tesseract.js
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

## Fonctionnement

1. L'utilisateur dépose une image.
2. Le front envoie l'image encodée en base64 au serveur.
3. Le serveur exécute l'OCR, extrait les champs et valide leur cohérence.
4. La réponse JSON indique pour chaque champ une valeur, un statut et un niveau de confiance.

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
