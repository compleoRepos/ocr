# Lecture automatisée d'une CIN marocaine fictive

Application web TypeScript qui lit le recto d'une carte d'identité nationale marocaine **fictive** et retourne les champs extraits en JSON structuré, avec statut et niveau de confiance par champ.

> **Avertissement** : ce projet est une étude de cas technique. Toutes les images de test sont des spécimens fictifs générés, sans aucune donnée personnelle réelle.

## Fonctionnalités

- Dépôt d'une image (PNG/JPEG) depuis le navigateur
- Extraction des 5 champs latins du recto : nom, prénom, date de naissance, numéro de CIN, date de fin de validité
- Sortie JSON structurée : pour chaque champ, une valeur, un statut (`ok` / `invalid` / `unreadable`) et une confiance
- Gestion explicite des échecs : champ illisible, document qui n'est pas une CIN, erreur technique, quota dépassé
- Deux moteurs d'extraction au choix : **Gemini Flash** (hébergé, sans GPU) ou **Tesseract.js** (local, repli hors-ligne)
- Prompt v2.0 adapté à la **mise en page réelle** des CIN marocaines (champs positionnels, arabe + latin, sans libellés explicites)
- Jeu de 9 images fictives de test, dont 3 volontairement dégradées, plus un spécimen réel de CIN

## Stack technique

| Couche | Technologie |
|---|---|
| Front | React 19 + TypeScript + Tailwind CSS |
| Back | Node.js + Express + tRPC |
| Vision / OCR | Gemini Flash (`gemini-flash-latest`) via `@google/generative-ai` ; repli Tesseract.js |
| Pré-traitement d'image | sharp (redressement, niveaux de gris, contraste, netteté) |
| Validation | Zod |
| Tests | Vitest (9 tests) |

## Installation sur une machine développeur

Prérequis : **Node.js 22+** et **pnpm 10+** (`npm install -g pnpm`).

```bash
git clone https://github.com/compleoRepos/ocr.git
cd ocr
pnpm install
pnpm dev
```

L'application démarre sur [http://localhost:3000](http://localhost:3000). Aucune configuration supplémentaire n'est nécessaire : la clé Gemini du palier gratuit est intégrée au code (`server/gemini.ts`) pour simplifier l'installation.

> **Note sécurité** : la clé intégrée est publique et partagée — son quota peut être épuisé ou elle peut être révoquée par Google. Pour un usage sérieux, créez votre propre clé gratuite sur [Google AI Studio](https://aistudio.google.com/apikey) et définissez la variable d'environnement `GEMINI_API_KEY`, qui a la priorité sur la clé intégrée.

### Choisir le moteur d'extraction

```bash
# Gemini Flash (défaut) — nécessite une connexion internet, aucun GPU
pnpm dev

# Tesseract local — fonctionne hors-ligne, sans clé ni quota
OCR_ENGINE=tesseract pnpm dev
```

## Utilisation

1. Ouvrir [http://localhost:3000](http://localhost:3000)
2. Déposer le recto d'une CIN fictive (exemples fournis dans `fixtures/`)
3. Cliquer sur **Lire la CIN**
4. Lire le résultat structuré et la sortie JSON

## Tests

```bash
pnpm test     # 9 tests : auth, moteur Tesseract, moteur Gemini
pnpm check    # vérification TypeScript
pnpm build    # build de production
```

Les tests Gemini sont tolérants au quota du palier gratuit : si l'API répond 429, le test vérifie que l'erreur est gérée proprement au lieu d'échouer.

## Structure du dépôt

```
client/src/pages/Home.tsx   Interface de dépôt et d'affichage des résultats
server/routers.ts           Route tRPC ocr.extractCin + moteur Tesseract (repli)
server/gemini.ts            Moteur Gemini Flash (appel API, parsing, validation)
server/prompts/             Prompt d'extraction versionné (v1.0)
shared/types.ts             Contrat JSON partagé front/back
fixtures/                   9 images fictives de test + RESULTATS.md
demo/                       Vidéo de démonstration de secours (MP4)
presentation/               PPTX de soutenance développé + étude de cas PDF
docs/INSTALLATION.md        Guide d'installation détaillé
```

## Documentation

- [Guide d'installation développeur détaillé](docs/INSTALLATION.md)
- [Résultats sur le jeu de test](fixtures/RESULTATS.md)
- [Dépôt GitHub](https://github.com/compleoRepos/ocr)
