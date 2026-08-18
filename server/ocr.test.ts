import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { readFileSync } from "node:fs";
import path from "node:path";

// Ces tests valident le moteur local Tesseract : on force OCR_ENGINE=tesseract
// pour éviter les appels réseau Gemini (lents et soumis à quota).
process.env.OCR_ENGINE = "tesseract";

const createCaller = appRouter.createCaller({} as never);

function imageToBase64(fileName: string) {
  return readFileSync(path.join(process.cwd(), "fixtures", fileName)).toString("base64");
}

describe("ocr.extractCin", () => {
  it("extrait correctement une CIN fictive valide", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "cin-valide-01.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-valide-01.png"),
    });

    expect(result.isCin).toBe(true);
    expect(result.fields.nom.value).toBe("BENALI");
    expect(result.fields.prenom.value).toBe("SALMA");
    expect(result.fields.numeroCin.value).toBe("AB123456");
  });

  it("signale une date de naissance invalide", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "cin-date-invalide.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-date-invalide.png"),
    });

    expect(result.fields.dateNaissance.status).toBe("invalid");
    expect(result.errors).toContain("La date de naissance est absente ou peu plausible.");
  });

  it("rejette proprement un fichier qui n'est pas une CIN", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "document-non-cin.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("document-non-cin.png"),
    });

    expect(result.isCin).toBe(false);
    expect(result.documentType).toBe("unknown");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("lit une CIN dégradée grâce au pré-traitement d'image", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "cin-degradee-rotation.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-degradee-rotation.png"),
    });

    expect(result.isCin).toBe(true);
    expect(result.fields.nom.value).toBe("BENALI");
    expect(result.fields.numeroCin.value).toBe("AB123456");
  });

  it("lit une CIN à faible contraste grâce à la normalisation", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "cin-degradee-contraste.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-degradee-contraste.png"),
    });

    expect(result.isCin).toBe(true);
    expect(result.fields.nom.value).toBe("EL FASSI");
    expect(result.fields.numeroCin.value).toBe("B765432");
  });

  it("lit une CIN floue grâce au sharpen", async () => {
    const result = await createCaller.ocr.extractCin({
      fileName: "cin-degradee-flou.png",
      mimeType: "image/png",
      imageBase64: imageToBase64("cin-degradee-flou.png"),
    });

    expect(result.isCin).toBe(true);
    expect(result.fields.nom.value).toBe("IDRISSI");
    expect(result.fields.numeroCin.value).toBe("K456789");
  });
});
