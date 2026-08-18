import { COOKIE_NAME } from "@shared/const";
import type { CinExtractionResult, CinFieldResult, OcrRequestPayload } from "@shared/types";
import { z } from "zod";
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { extractWithGemini } from "./gemini";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

function ocrEngine(): string {
  return process.env.OCR_ENGINE ?? "gemini";
}

function field(value: string | null, confidence: number, message?: string): CinFieldResult {
  if (!value) {
    return { value: null, status: "unreadable", confidence: 0, message: message ?? "Champ non lu" };
  }

  return {
    value,
    status: confidence >= 0.65 ? "ok" : "invalid",
    confidence,
    message,
  };
}

function normalizeDate(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${dd}/${mm}/${yyyy}`;
}

function isPlausibleDate(value: string | null): boolean {
  if (!value) return false;
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return false;
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

function extractAfterLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]+)`, "i");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * Extraction positionnelle pour les VRAIES CIN marocaines.
 * Sur une carte réelle, les champs n'ont pas de libellés explicites :
 * le nom et le prénom sont des lignes latines en majuscules sous l'en-tête,
 * le numéro de CIN suit le motif N° XXX9999, les dates sont au format JJ.MM.AAAA.
 */
function extractPositional(rawText: string): {
  nom: string | null;
  prenom: string | null;
  dateNaissance: string | null;
  numeroCin: string | null;
  dateFinValidite: string | null;
} {
  // 1. Numéro de CIN : motif "N° K01234567" ou code isolé lettre(s)+chiffres
  let numeroCin: string | null = null;
  const cinMatch = rawText.match(/N[°oº]?\s*([A-Z]{1,3}\d{4,8})\b/i)
    ?? rawText.match(/\b([A-Z]{1,2}\d{6,8})\b/);
  if (cinMatch?.[1]) numeroCin = cinMatch[1].toUpperCase();

  // 2. Dates au format JJ.MM.AAAA ou JJ/MM/AAAA
  const dateMatches: string[] = [];
  const dateRegex = /(\d{2})[.\/](\d{2})[.\/](\d{4})/g;
  let dm: RegExpExecArray | null;
  while ((dm = dateRegex.exec(rawText)) !== null) {
    dateMatches.push(`${dm[1]}/${dm[2]}/${dm[3]}`);
  }
  const dateNaissance = dateMatches[0] ?? null;
  // La date de validité est celle proche de "Valable jusqu'au", sinon la dernière date trouvée
  let dateFinValidite: string | null = null;
  const validiteMatch = rawText.match(/[Vv]alable jusqu['']au\s*(\d{2})[.\/](\d{2})[.\/](\d{4})/);
  if (validiteMatch) {
    dateFinValidite = `${validiteMatch[1]}/${validiteMatch[2]}/${validiteMatch[3]}`;
  } else if (dateMatches.length > 1) {
    dateFinValidite = dateMatches[dateMatches.length - 1];
  }

  // 3. Nom et prénom : lignes latines en majuscules (hors en-tête et libellés)
  const STOP_WORDS = new Set([
    "ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "IDENTITÉ",
    "NELE", "NÉLE", "NE", "NÉE", "LE", "LA", "DE", "DU", "DES", "ET",
    "TANGER", "ASSILAH", "VALABLE", "JUSQU", "AU", "CASABLANCA", "RABAT",
    "MARRAKECH", "FES", "FÈS", "AGADIR", "ESPADNE", "ESPAGNE", "MADRID",
  ]);
  const candidates: string[] = [];
  for (const line of rawText.split("\n")) {
    const cleaned = line.replace(/[^A-Za-zÀ-ÿ\s-]/g, " ").trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    // Cherche un mot latin en majuscules dans la ligne (même si la ligne
    // contient du bruit OCR comme "nee, - MOUHCINE")
    for (const w of tokens) {
      if (
        w.length >= 3 &&
        /^[A-ZÀ-Þ][A-ZÀ-Þ-]+$/.test(w) &&
        !STOP_WORDS.has(w.toUpperCase()) &&
        !/^\d/.test(w) &&
        !/^[A-Z]{1,3}\d{4,8}$/.test(w) &&
        !candidates.includes(w.toUpperCase())
      ) {
        candidates.push(w.toUpperCase());
        break; // un seul candidat par ligne
      }
    }
  }
  // Sur une vraie CIN, l'ordre vertical OCR est souvent prénom PUIS nom
  // (le prénom apparaît au-dessus du nom sur la carte nouvelle génération).
  // Heuristique : si deux candidats, le premier est le prénom, le second le nom.
  let nom: string | null = null;
  let prenom: string | null = null;
  if (candidates.length >= 2) {
    prenom = candidates[0];
    nom = candidates[1];
  } else if (candidates.length === 1) {
    nom = candidates[0];
  }

  return { nom, prenom, dateNaissance, numeroCin, dateFinValidite };
}

async function extractTextFromImage(payload: OcrRequestPayload): Promise<string> {
  const worker = await createWorker("fra");
  try {
    const rawBuffer = Buffer.from(payload.imageBase64, "base64");
    const preprocessed = await preprocessImage(rawBuffer);
    const { data } = await worker.recognize(preprocessed);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

async function preprocessImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch {
    return input;
  }
}

async function performOcrExtraction(payload: OcrRequestPayload): Promise<CinExtractionResult> {
  const startedAt = Date.now();
  const errors: string[] = [];

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

  let rawText = "";
  try {
    rawText = await extractTextFromImage(payload);
  } catch {
    return {
      isCin: false,
      documentType: "unknown",
      fields: {
        nom: field(null, 0, "Erreur technique pendant l'OCR"),
        prenom: field(null, 0, "Erreur technique pendant l'OCR"),
        dateNaissance: field(null, 0, "Erreur technique pendant l'OCR"),
        numeroCin: field(null, 0, "Erreur technique pendant l'OCR"),
        dateFinValidite: field(null, 0, "Erreur technique pendant l'OCR"),
      },
      errors: ["Le moteur OCR n'a pas pu traiter le fichier."],
      rawText: "",
      processingMs: Date.now() - startedAt,
    };
  }

  const normalizedText = rawText.toUpperCase();
  const looksLikeCin =
    (normalizedText.includes("ROYAUME DU MAROC") || normalizedText.includes("CARTE D'IDENTIT")) &&
    normalizedText.includes("CIN");

  if (!looksLikeCin) {
    return {
      isCin: false,
      documentType: "unknown",
      fields: {
        nom: field(null, 0, "Aucun texte exploitable détecté"),
        prenom: field(null, 0, "Aucun texte exploitable détecté"),
        dateNaissance: field(null, 0, "Aucun texte exploitable détecté"),
        numeroCin: field(null, 0, "Aucun texte exploitable détecté"),
        dateFinValidite: field(null, 0, "Aucun texte exploitable détecté"),
      },
      errors: ["Impossible de confirmer qu'il s'agit du recto d'une CIN."],
      rawText,
      processingMs: Date.now() - startedAt,
    };
  }

  // Extraction par libellés (spécimens fictifs) puis repli positionnel (vraies CIN)
  const positional = extractPositional(rawText);
  const nom = extractAfterLabel(rawText, ["NOM", "Nom"]) ?? positional.nom;
  const prenom = extractAfterLabel(rawText, ["PRENOM", "PRÉNOM", "Prenom", "Prénom"]) ?? positional.prenom;
  const dateNaissance =
    normalizeDate(extractAfterLabel(rawText, ["DATE DE NAISSANCE", "NE LE", "NÉ LE"])) ??
    positional.dateNaissance;
  // Pour le numéro de CIN, on privilégie le motif positionnel (N° K01234567)
  // car le libellé "N°" seul capture le premier caractère de la ligne.
  const numeroCinLabel = extractAfterLabel(rawText, ["CIN", "NUMERO", "NUMÉRO"]);
  const numeroCin = positional.numeroCin ?? numeroCinLabel;
  const dateFinValidite =
    normalizeDate(extractAfterLabel(rawText, ["VALIDE JUSQU'AU", "DATE DE FIN DE VALIDITE", "FIN VALIDITE"])) ??
    positional.dateFinValidite;

  // Nettoyage du numéro de CIN (peut contenir du texte parasite)
  const numeroCinClean = numeroCin
    ? (numeroCin.match(/[A-Z]{1,3}\d{4,8}/i)?.[0] ?? null)
    : null;

  const numeroCinValid = numeroCinClean ? /^[A-Z]{1,3}\d{4,8}$/i.test(numeroCinClean) : false;
  const birthDateValid = isPlausibleDate(dateNaissance);
  const expiryDateValid = isPlausibleDate(dateFinValidite);

  if (!numeroCinValid) errors.push("Le numéro de CIN est absent ou invalide.");
  if (!birthDateValid) errors.push("La date de naissance est absente ou peu plausible.");
  if (!expiryDateValid) errors.push("La date de fin de validité est absente ou peu plausible.");

  return {
    isCin: true,
    documentType: "cin_recto",
    fields: {
      nom: field(nom, nom ? 0.98 : 0),
      prenom: field(prenom, prenom ? 0.97 : 0),
      dateNaissance: field(dateNaissance, birthDateValid ? 0.95 : 0, birthDateValid ? undefined : "Date illisible ou incohérente"),
      numeroCin: field(numeroCinClean ? numeroCinClean.toUpperCase() : null, numeroCinValid ? 0.99 : 0, numeroCinValid ? undefined : "Format de CIN invalide"),
      dateFinValidite: field(dateFinValidite, expiryDateValid ? 0.94 : 0, expiryDateValid ? undefined : "Date illisible ou incohérente"),
    },
    errors,
    rawText,
    processingMs: Date.now() - startedAt,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ocr: router({
    extractCin: publicProcedure
      .input(
        z.object({
          fileName: z.string().min(1),
          mimeType: z.string().min(1),
          imageBase64: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        if (ocrEngine() === "gemini") {
          const result = await extractWithGemini(input);
          // Repli automatique : si le quota Gemini est dépassé (429),
          // on bascule sur le moteur local Tesseract plutôt que de
          // retourner une erreur à l'utilisateur.
          const quotaExceeded = result.errors.some((e) => /quota|429/i.test(e));
          if (quotaExceeded) {
            const fallback = await performOcrExtraction(input);
            fallback.errors = [
              ...fallback.errors,
              "Quota Gemini dépassé : extraction réalisée avec le moteur local Tesseract.",
            ];
            return fallback;
          }
          return result;
        }
        return performOcrExtraction(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
