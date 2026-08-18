import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractWithGemini } from "./gemini";

function imageToBase64(fileName: string): string {
  return readFileSync(`fixtures/${fileName}`).toString("base64");
}

function isQuotaError(result: { errors: string[] }): boolean {
  return result.errors.some((e) => /quota|429/i.test(e));
}

describe("gemini.extractWithGemini", () => {
  it("valide la clé API et extrait une CIN fictive valide", async () => {
    const result = await extractWithGemini({
      fileName: "cin-valide-01.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-valide-01.png"),
    });

    // Le palier gratuit Gemini impose un quota : si l'appel est rejeté (429),
    // on vérifie simplement que l'erreur est gérée proprement.
    if (isQuotaError(result)) {
      expect(result.isCin).toBe(false);
      return;
    }

    expect(result.isCin).toBe(true);
    expect(result.fields.nom.value).toBe("BENALI");
    expect(result.fields.prenom.value).toBe("SALMA");
    expect(result.fields.numeroCin.value).toBe("AB123456");
  }, 60000);

  it("rejette proprement un document qui n'est pas une CIN", async () => {
    const result = await extractWithGemini({
      fileName: "document-non-cin.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("document-non-cin.png"),
    });

    if (isQuotaError(result)) {
      expect(result.isCin).toBe(false);
      return;
    }

    expect(result.isCin).toBe(false);
  }, 60000);
});
