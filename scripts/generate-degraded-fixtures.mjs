import sharp from "sharp";

const jobs = [
  { src: "fixtures/cin-valide-01.png", out: "fixtures/cin-degradee-rotation.png", transform: s => s.rotate(-6, { background: "#e5e5e5" }).modulate({ brightness: 0.92, saturation: 0.8 }) },
  { src: "fixtures/cin-valide-02.png", out: "fixtures/cin-degradee-contraste.png", transform: s => s.modulate({ brightness: 1.12 }).linear(0.7, 40) },
  { src: "fixtures/cin-valide-03.png", out: "fixtures/cin-degradee-flou.png", transform: s => s.blur(1.6).modulate({ brightness: 0.95 }) },
];

for (const job of jobs) {
  const pipeline = job.transform(sharp(job.src));
  await pipeline.png().toFile(job.out);
  console.log("generated", job.out);
}
