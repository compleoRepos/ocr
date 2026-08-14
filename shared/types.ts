/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type CinFieldStatus = "ok" | "unreadable" | "invalid";

export interface CinFieldResult {
  value: string | null;
  status: CinFieldStatus;
  confidence: number;
  message?: string;
}

export interface CinExtractionResult {
  isCin: boolean;
  documentType: "cin_recto" | "not_cin" | "unknown";
  fields: {
    nom: CinFieldResult;
    prenom: CinFieldResult;
    dateNaissance: CinFieldResult;
    numeroCin: CinFieldResult;
    dateFinValidite: CinFieldResult;
  };
  errors: string[];
  rawText: string;
  processingMs: number;
}

export interface OcrRequestPayload {
  fileName: string;
  mimeType: string;
  imageBase64: string;
}
