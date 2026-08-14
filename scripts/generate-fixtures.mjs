import { createCanvas } from "canvas";
import { writeFileSync } from "node:fs";

const fixtures = [
  {
    file: "fixtures/cin-valide-01.png",
    title: "ROYAUME DU MAROC",
    subtitle: "CARTE D'IDENTITÉ NATIONALE",
    rows: [
      ["NOM", "BENALI"],
      ["PRENOM", "SALMA"],
      ["DATE DE NAISSANCE", "14/03/1998"],
      ["CIN", "AB123456"],
      ["VALIDE JUSQU'AU", "22/09/2031"],
    ],
  },
  {
    file: "fixtures/cin-valide-02.png",
    title: "ROYAUME DU MAROC",
    subtitle: "CARTE D'IDENTITÉ NATIONALE",
    rows: [
      ["NOM", "EL FASSI"],
      ["PRENOM", "YASSINE"],
      ["DATE DE NAISSANCE", "02/11/1995"],
      ["CIN", "B765432"],
      ["VALIDE JUSQU'AU", "18/01/2030"],
    ],
  },
  {
    file: "fixtures/cin-valide-03.png",
    title: "ROYAUME DU MAROC",
    subtitle: "CARTE D'IDENTITÉ NATIONALE",
    rows: [
      ["NOM", "IDRISSI"],
      ["PRENOM", "KARIMA"],
      ["DATE DE NAISSANCE", "27/07/2000"],
      ["CIN", "K456789"],
      ["VALIDE JUSQU'AU", "09/05/2034"],
    ],
  },
  {
    file: "fixtures/cin-date-invalide.png",
    title: "ROYAUME DU MAROC",
    subtitle: "CARTE D'IDENTITÉ NATIONALE",
    rows: [
      ["NOM", "AMRANI"],
      ["PRENOM", "NISRINE"],
      ["DATE DE NAISSANCE", "31/02/1999"],
      ["CIN", "CZ908172"],
      ["VALIDE JUSQU'AU", "10/10/2032"],
    ],
  },
  {
    file: "fixtures/cin-champ-manquant.png",
    title: "ROYAUME DU MAROC",
    subtitle: "CARTE D'IDENTITÉ NATIONALE",
    rows: [
      ["NOM", "TAZI"],
      ["PRENOM", "OMAR"],
      ["DATE DE NAISSANCE", ""],
      ["CIN", "D445566"],
      ["VALIDE JUSQU'AU", "05/06/2033"],
    ],
  },
  {
    file: "fixtures/document-non-cin.png",
    title: "FACTURE CLIENT",
    subtitle: "DOCUMENT COMMERCIAL",
    rows: [
      ["CLIENT", "ENTREPRISE DEMO"],
      ["MONTANT", "450 MAD"],
      ["DATE", "12/08/2026"],
      ["REFERENCE", "FAC-2026-001"],
      ["SERVICE", "CONSULTING"],
    ],
  },
];

for (const fixture of fixtures) {
  const canvas = createCanvas(1400, 800);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f4ea";
  ctx.fillRect(0, 0, 1400, 800);
  ctx.strokeStyle = "#b91c1c";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 1320, 720);
  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(70, 70, 1260, 110);
  ctx.fillStyle = "white";
  ctx.font = "bold 34px Arial";
  ctx.fillText(fixture.title, 100, 115);
  ctx.font = "bold 24px Arial";
  ctx.fillText(fixture.subtitle, 100, 155);
  ctx.fillStyle = "#111827";
  fixture.rows.forEach(([label, value], index) => {
    const y = 250 + index * 85;
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${label}:`, 100, y);
    ctx.font = "26px Arial";
    ctx.fillText(value || "—", 430, y);
  });
  ctx.font = "18px Arial";
  ctx.fillStyle = "#6b7280";
  ctx.fillText("SPECIMEN FICTIF - SANS DONNEE REELLE", 100, 700);
  writeFileSync(fixture.file, canvas.toBuffer("image/png"));
}
