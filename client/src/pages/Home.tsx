import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { CinExtractionResult } from "@shared/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function statusVariant(status: string) {
  if (status === "ok") return "default" as const;
  if (status === "invalid") return "secondary" as const;
  return "destructive" as const;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<CinExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const extractMutation = trpc.ocr.extractCin.useMutation();

  const jsonPreview = useMemo(() => (result ? JSON.stringify(result, null, 2) : ""), [result]);

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Veuillez sélectionner un fichier image.");
      return;
    }

    setError(null);
    try {
      const imageBase64 = await fileToBase64(selectedFile);
      const response = await extractMutation.mutateAsync({
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        imageBase64,
      });
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Erreur inattendue pendant la lecture.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Étude de cas technique</p>
          <h1 className="mt-3 text-4xl font-semibold">Lecture automatisée d'une CIN marocaine fictive</h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Déposez le recto d'une CIN fictive et obtenez une extraction structurée en JSON, avec statut par champ et erreurs explicites.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-800 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle>Dépôt de l'image</CardTitle>
              <CardDescription className="text-slate-400">
                Le système accepte un fichier image et signale proprement les fichiers non exploitables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept="image/*,.txt"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="border-slate-700 bg-slate-950 text-slate-200"
              />
              <Button onClick={handleSubmit} disabled={extractMutation.isPending}>
                {extractMutation.isPending ? "Lecture en cours..." : "Lire la CIN"}
              </Button>
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle>Résultat structuré</CardTitle>
              <CardDescription className="text-slate-400">
                Les champs non lus sont signalés au lieu d'être inventés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <p className="text-sm text-slate-400">Aucun résultat pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={result.isCin ? "default" : "destructive"}>
                      {result.isCin ? "CIN détectée" : "Document non reconnu"}
                    </Badge>
                    <span className="text-sm text-slate-400">{result.processingMs} ms</span>
                  </div>
                  <div className="grid gap-3">
                    {Object.entries(result.fields).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm uppercase tracking-wide text-slate-400">{key}</p>
                            <p className="mt-1 text-lg font-medium">{value.value ?? "Non lu"}</p>
                          </div>
                          <Badge variant={statusVariant(value.status)}>{value.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Confiance: {(value.confidence * 100).toFixed(0)}%</p>
                        {value.message ? <p className="mt-1 text-sm text-amber-300">{value.message}</p> : null}
                      </div>
                    ))}
                  </div>
                  {result.errors.length > 0 ? (
                    <Alert>
                      <AlertTitle>Points d'attention</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-5">
                          {result.errors.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-800 bg-slate-900 text-white">
          <CardHeader>
            <CardTitle>Sortie JSON</CardTitle>
            <CardDescription className="text-slate-400">
              La réponse est exploitable par un autre système.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="min-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
              {jsonPreview || "{\n  \"status\": \"en attente d'une image\"\n}"}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
