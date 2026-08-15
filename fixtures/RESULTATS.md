# Résultats sur le jeu de test

Neuf images fictives ont été testées avec le pipeline complet (pré-traitement + OCR + extraction + validation).

## Images nettes

| Image | Résultat | Commentaire |
|---|---|---|
| cin-valide-01.png | Succès | Tous les champs lus correctement. |
| cin-valide-02.png | Succès | Extraction stable. |
| cin-valide-03.png | Succès | Bon comportement général. |
| cin-date-invalide.png | Partiel | Date détectée mais marquée invalide (31/02). |
| cin-champ-manquant.png | Partiel | Champ absent signalé proprement, non inventé. |
| document-non-cin.png | Rejet | Document non reconnu comme CIN, erreur explicite. |

## Images dégradées (pré-traitement activé)

| Image | Dégradation | Résultat |
|---|---|---|
| cin-degradee-rotation.png | Rotation -6° + luminosité réduite | Succès : nom, prénom, CIN et validité lus ; séparateur de date parfois confondu (`/` lu `!`). |
| cin-degradee-contraste.png | Faible contraste | Succès complet après normalisation. |
| cin-degradee-flou.png | Flou léger | Succès complet après sharpen. |

## Enseignements

Le pré-traitement (redressement automatique, niveaux de gris, normalisation du contraste, netteté) améliore nettement la robustesse sur images dégradées. Le point le plus fragile reste la ponctuation des dates sur les images inclinées, ce qui justifie la normalisation tolérante des séparateurs.
