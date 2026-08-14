import { COOKIE_NAME } from "@shared/const";
import type { CinExtractionResult, CinFieldResult, OcrRequestPayload } from "@shared/types";
import { z } from "zod";
import { createWorker } from "tesseract.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

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

async function extractTextFromImage(payload: OcrRequestPayload): Promise<string> {
  const worker = await createWorker("fra");
  try {
    const buffer = Buffer.from(payload.imageBase64, "base64");
    const { data } = await worker.recognize(buffer);
    return data.text || "";
  } finally {
    await worker.terminate();
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

  const nom = extractAfterLabel(rawText, ["NOM", "Nom"]);
  const prenom = extractAfterLabel(rawText, ["PRENOM", "PRÉNOM", "Prenom", "Prénom"]);
  const dateNaissance = normalizeDate(extractAfterLabel(rawText, ["DATE DE NAISSANCE", "NE LE", "NÉ LE"]));
  const numeroCin = extractAfterLabel(rawText, ["CIN", "NUMERO", "NUMÉRO", "N°"]);
  const dateFinValidite = normalizeDate(extractAfterLabel(rawText, ["VALIDE JUSQU'AU", "DATE DE FIN DE VALIDITE", "FIN VALIDITE"]));

  const numeroCinValid = numeroCin ? /^[A-Z]{1,2}\d{5,8}$/i.test(numeroCin.replace(/\s+/g, "")) : false;
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
      numeroCin: field(numeroCin ? numeroCin.replace(/\s+/g, "").toUpperCase() : null, numeroCinValid ? 0.99 : 0, numeroCinValid ? undefined : "Format de CIN invalide"),
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
      .mutation(({ input }) => performOcrExtraction(input)),
  }),
});

export type AppRouter = typeof appRouter;
