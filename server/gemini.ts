import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CinExtractionResult, CinFieldResult, OcrRequestPayload } from "@shared/types";
import { CIN_EXTRACTION_PROMPT } from "./prompts/cinExtraction";

// gemini-flash-latest pointe vers la version Flash stable courante.
// Choisie car le quota gratuit de gemini-3.6-flash (20 req/jour) est trop
// restrictif pour une démonstration ; gemini-flash-latest dispose d'un
// quota séparé plus confortable sur le palier gratuit.
const MODEL_NAME = "gemini-flash-latest";

/**
 * Clé API Gemini (palier gratuit Google AI Studio).
 * NOTE : clé intégrée au dépôt à la demande du porteur du projet pour simplifier
 * l'installation des développeurs. La variable d'environnement GEMINI_API_KEY,
 * si elle est définie, a la priorité sur cette valeur.
 */
const DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6I2segQPYHbtX9aQnAlUbBG2pgzqUcLKZ3Z9MvkbXhmvg";

function resolveApiKey(): string {
  return process.env.GEMINI_API_KEY ?? DEFAULT_GEMINI_API_KEY;
}

function field(value: string | null, confidence: number, message?: string): CinFieldResult {
  if (!value) {
    return { value: null, status: "unreadable", confidence: 0, message: message ?? "Champ non lu" };
  }
  return { value, status: confidence >= 0.65 ? "ok" : "invalid", confidence, message };
}

function isPlausibleDate(value: string | null): boolean {
  if (!value) return false;
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return false;
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

interface GeminiField {
  value: string | null;
  confidence?: number;
}

interface GeminiResponse {
  isCin?: boolean;
  fields?: {
    nom?: GeminiField;
    prenom?: GeminiField;
    dateNaissance?: GeminiField;
    numeroCin?: GeminiField;
    dateFinValidite?: GeminiField;
  };
}

function parseGeminiJson(text: string): GeminiResponse {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Réponse Gemini sans JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function extractWithGemini(payload: OcrRequestPayload): Promise<CinExtractionResult> {
  const startedAt = Date.now();
  const apiKey = resolveApiKey();

  if (!payload.mimeType.startsWith("image/")) {
    return {
      isCin: false,
      documentType: "not_cin",
      fields: {
        nom: field(null, 0, "Le fichier n'est pas une image"),
        prenom: field(null, 0, "Le fichier n'est pas une image"),
        dateNaissance: field(null, 0, "Le fichier n'est pas une image"),
        numeroCin: field(null, 0, "Le fichier n'est pas une image"),
        dateFinValidite: field(null, 0, "Le fichier n'est pas une image"),
      },
      errors: ["Le fichier envoyé n'est pas une image."],
      rawText: "",
      processingMs: Date.now() - startedAt,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent([
      CIN_EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType: payload.mimeType,
          data: payload.imageBase64,
        },
      },
    ]);

    const text = result.response.text();
    const parsed = parseGeminiJson(text);
    const errors: string[] = [];

    if (!parsed.isCin) {
      return {
        isCin: false,
        documentType: "unknown",
        fields: {
          nom: field(null, 0, "Document non reconnu comme CIN"),
          prenom: field(null, 0, "Document non reconnu comme CIN"),
          dateNaissance: field(null, 0, "Document non reconnu comme CIN"),
          numeroCin: field(null, 0, "Document non reconnu comme CIN"),
          dateFinValidite: field(null, 0, "Document non reconnu comme CIN"),
        },
        errors: ["Impossible de confirmer qu'il s'agit du recto d'une CIN."],
        rawText: text,
        processingMs: Date.now() - startedAt,
      };
    }

    const f = parsed.fields ?? {};
    const numeroCin = f.numeroCin?.value ? f.numeroCin.value.replace(/\s+/g, "").toUpperCase() : null;
    const numeroCinValid = numeroCin ? /^[A-Z]{1,3}\d{4,8}$/.test(numeroCin) : false;
    const birthValid = isPlausibleDate(f.dateNaissance?.value ?? null);
    const expiryValid = isPlausibleDate(f.dateFinValidite?.value ?? null);

    if (f.numeroCin?.value && !numeroCinValid) errors.push("Le numéro de CIN lu a un format invalide.");
    if (f.dateNaissance?.value && !birthValid) errors.push("La date de naissance lue est peu plausible.");
    if (f.dateFinValidite?.value && !expiryValid) errors.push("La date de fin de validité lue est peu plausible.");

    return {
      isCin: true,
      documentType: "cin_recto",
      fields: {
        nom: field(f.nom?.value ?? null, f.nom?.confidence ?? 0),
        prenom: field(f.prenom?.value ?? null, f.prenom?.confidence ?? 0),
        dateNaissance: field(
          f.dateNaissance?.value ?? null,
          birthValid ? f.dateNaissance?.confidence ?? 0.9 : 0,
          birthValid ? undefined : "Date illisible ou incohérente"
        ),
        numeroCin: field(
          numeroCin,
          numeroCinValid ? f.numeroCin?.confidence ?? 0.9 : 0,
          numeroCinValid ? undefined : "Format de CIN invalide"
        ),
        dateFinValidite: field(
          f.dateFinValidite?.value ?? null,
          expiryValid ? f.dateFinValidite?.confidence ?? 0.9 : 0,
          expiryValid ? undefined : "Date illisible ou incohérente"
        ),
      },
      errors,
      rawText: text,
      processingMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    const isQuota = /quota|429|rate/i.test(message);
    return {
      isCin: false,
      documentType: "unknown",
      fields: {
        nom: field(null, 0, "Erreur technique pendant l'appel au modèle"),
        prenom: field(null, 0, "Erreur technique pendant l'appel au modèle"),
        dateNaissance: field(null, 0, "Erreur technique pendant l'appel au modèle"),
        numeroCin: field(null, 0, "Erreur technique pendant l'appel au modèle"),
        dateFinValidite: field(null, 0, "Erreur technique pendant l'appel au modèle"),
      },
      errors: [
        isQuota
          ? "Le quota gratuit Gemini est dépassé. Réessayez plus tard."
          : `Le modèle de vision n'a pas pu traiter le fichier : ${message}`,
      ],
      rawText: "",
      processingMs: Date.now() - startedAt,
    };
  }
}
