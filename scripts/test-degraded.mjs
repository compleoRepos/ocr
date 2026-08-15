import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readFileSync } from "node:fs";

async function preprocess(input) {
  return sharp(input).rotate().resize({ width: 1600, withoutEnlargement: false }).grayscale().normalize().sharpen().png().toBuffer();
}

for (const file of ["cin-degradee-rotation.png", "cin-degradee-contraste.png", "cin-degradee-flou.png"]) {
  const worker = await createWorker("fra");
  const buf = await preprocess(readFileSync(`fixtures/${file}`));
  const { data } = await worker.recognize(buf);
  console.log("=== " + file + " ===");
  console.log(data.text.trim());
  await worker.terminate();
}
