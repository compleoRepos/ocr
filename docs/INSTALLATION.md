# Guide d'installation développeur

Ce guide explique comment installer, lancer et comprendre la solution sur une machine de développement.

## 1. Prérequis

| Outil | Version minimale | Vérification |
|---|---|---|
| Node.js | 22.x | `node --version` |
| pnpm | 10.x | `pnpm --version` (installer avec `npm install -g pnpm`) |
| Git | 2.x | `git --version` |

Aucun GPU n'est nécessaire : l'extraction par défaut utilise l'API hébergée Gemini Flash. Le moteur de repli Tesseract fonctionne en local sur CPU.

## 2. Installation

```bash
git clone https://github.com/compleoRepos/ocr.git
cd ocr
pnpm install
```

`pnpm install` installe toutes les dépendances, y compris `sharp` (binaires précompilés) et `@google/generative-ai`.

## 3. Configuration

### 3.1 Fonctionnement immédiat (zéro configuration)

Le projet embarque une clé Gemini du palier gratuit dans `server/gemini.ts` (`DEFAULT_GEMINI_API_KEY`). L'application fonctionne donc immédiatement après `pnpm install`.

**Limites de cette approche** : la clé est publique, partagée entre tous les utilisateurs du dépôt, soumise au quota du palier gratuit, et peut être révoquée par Google à tout moment.

### 3.2 Utiliser sa propre clé (recommandé)

1. Créer une clé gratuite sur [Google AI Studio](https://aistudio.google.com/apikey) (compte Google suffisant, sans carte bancaire).
2. La définir en variable d'environnement :

```bash
# Linux / macOS
export GEMINI_API_KEY="votre-clé"

# Windows PowerShell
$env:GEMINI_API_KEY="votre-clé"
```

La variable d'environnement a **toujours la priorité** sur la clé intégrée.

### 3.3 Choisir le moteur d'extraction

| Variable | Valeur | Effet |
|---|---|---|
| `OCR_ENGINE` | `gemini` (défaut) | Appel à l'API Gemini Flash, meilleure qualité, nécessite internet |
| `OCR_ENGINE` | `tesseract` | OCR local Tesseract.js, hors-ligne, sans quota |

## 4. Lancement

```bash
pnpm dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000). Le serveur redémarre automatiquement à chaque modification du code.

## 5. Vérification de l'installation

```bash
pnpm test     # doit afficher : 3 fichiers passés, 9 tests passés
pnpm check    # vérification TypeScript sans erreur
pnpm build    # build de production dans dist/
```

Pour un test manuel rapide : déposez `fixtures/cin-valide-01.png` dans l'interface — le résultat doit afficher `BENALI / SALMA / AB123456`.

## 6. Comment fonctionne la solution

### Pipeline d'extraction

```
Image déposée (front React)
  → encodage base64
  → route tRPC ocr.extractCin (server/routers.ts)
  → moteur choisi :
      • Gemini Flash : prompt versionné + image → JSON strict (server/gemini.ts)
      • Tesseract : pré-traitement sharp → OCR → extraction par libellés
  → validation métier (format CIN, plausibilité des dates)
  → réponse JSON structurée
```

### Le prompt versionné

Le prompt d'extraction est versionné dans `server/prompts/cinExtraction.ts` (constante `CIN_EXTRACTION_PROMPT_VERSION`). Il impose :

- une sortie **JSON stricte**, sans markdown ni commentaire ;
- `null` explicite pour tout champ illisible — **jamais d'invention** ;
- `isCin: false` si l'image n'est pas le recto d'une CIN ;
- une confiance entre 0 et 1 par champ.

### La validation métier

Après la réponse du modèle, le serveur valide :

- le format du numéro de CIN : 1-2 lettres + 5-8 chiffres (`/^[A-Z]{1,2}\d{5,8}$/`) ;
- la plausibilité des dates (un 31/02 est marqué `invalid`, pas accepté) ;
- la cohérence globale (document non-CIN rejeté proprement).

### Gestion des échecs

| Situation | Comportement |
|---|---|
| Champ illisible | `value: null`, `status: "unreadable"`, `confidence: 0` |
| Pas une CIN | `isCin: false`, erreur explicite, aucun champ inventé |
| Quota Gemini dépassé (429) | Erreur claire invitant à réessayer ou à basculer sur Tesseract |
| Fichier non-image | Rejet propre avec message explicite |

## 7. Régénérer les données de test

```bash
node scripts/generate-fixtures.mjs          # 6 images nettes
node scripts/generate-degraded-fixtures.mjs # 3 images dégradées
python3 scripts/record-demo.py              # vidéo de démonstration (serveur lancé)
```

## 8. Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| `429 quota exceeded` | Palier gratuit épuisé | Utiliser sa propre clé ou `OCR_ENGINE=tesseract` |
| `sharp` ne s'installe pas | Binaire précompilé indisponible | Mettre à jour pnpm, ou `pnpm rebuild sharp` |
| Port 3000 occupé | Autre processus | `kill` le processus ou changer le port |
| Extraction vide sur image réelle | Image trop dégradée | Le périmètre est limité aux spécimens fictifs propres |
