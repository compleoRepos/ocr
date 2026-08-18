import { describe, expect, it } from "vitest";
process.env.OCR_ENGINE = "tesseract";
import { appRouter } from "/home/ubuntu/ocr-cin-app/server/routers";
import { readFileSync } from "node:fs";

describe("tesseract repli — vrai spécimen", () => {
  it("extrait les champs d'une vraie CIN par analyse positionnelle", async () => {
    const caller = appRouter.createCaller({} as never);
    const result = await caller.ocr.extractCin({
      fileName: "cin-reelle-specimen.jpg",
      mimeType: "image/jpeg",
      imageBase64: readFileSync("/home/ubuntu/ocr-cin-app/fixtures/cin-reelle-specimen.jpg").toString("base64"),
    });
    console.log("nom:", result.fields.nom.value);
    console.log("prenom:", result.fields.prenom.value);
    console.log("dateNaissance:", result.fields.dateNaissance.value);
    console.log("numeroCin:", result.fields.numeroCin.value);
    console.log("dateFinValidite:", result.fields.dateFinValidite.value);
    expect(result.isCin).toBe(true);
    expect(result.fields.numeroCin.value).toBe("K01234567");
  }, 60000);
});
