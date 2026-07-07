"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileCheck2, AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";

type User = { id: string; name: string };

type Step = "upload" | "mapping" | "preview" | "result";

type ParsedRow = Record<string, string>;

const FIELD_KEYS = ["date", "startAt", "endAt"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const AUTO_DETECT: Record<FieldKey, string[]> = {
  date: ["datum", "date", "tag", "day"],
  startAt: ["von", "start", "begin", "beginn", "startat"],
  endAt: ["bis", "end", "ende", "endat"],
};

export function ImportDialog({ users }: { users: User[] }) {
  const t = useTranslations("import");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ?? "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    date: "",
    startAt: "",
    endAt: "",
  });
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; error: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({ date: "", startAt: "", endAt: "" });
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(file: File) {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
          alert(t("noHeaderError"));
          return;
        }
        const fields = parsed.meta.fields;
        setHeaders(fields);
        setRawRows(parsed.data.filter((r) => Object.values(r).some((v) => v?.trim())));

        const auto = { date: "", startAt: "", endAt: "" } as Record<FieldKey, string>;
        for (const key of FIELD_KEYS) {
          const found = fields.find((f) =>
            AUTO_DETECT[key].includes(f.toLowerCase().trim())
          );
          if (found) auto[key] = found;
        }
        setMapping(auto);
        setStep("mapping");
      },
      error: (err) => {
        alert(`${t("parseError")}: ${err.message}`);
      },
    });
  }

  const mappedRows = rawRows.slice(0, 10).map((r) => ({
    date: mapping.date ? r[mapping.date] ?? "" : "",
    startAt: mapping.startAt ? r[mapping.startAt] ?? "" : "",
    endAt: mapping.endAt ? r[mapping.endAt] ?? "" : "",
  }));

  const allMappedRows = rawRows.map((r) => ({
    date: mapping.date ? r[mapping.date] ?? "" : "",
    startAt: mapping.startAt ? r[mapping.startAt] ?? "" : "",
    endAt: mapping.endAt ? r[mapping.endAt] ?? "" : "",
  }));

  const canMap = mapping.date && mapping.startAt && mapping.endAt;

  async function doImport() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, rows: allMappedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "error");
        return;
      }
      setResult(data);
      setStep("result");
    } catch {
      alert("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="mr-1 h-4 w-4" />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("selectUser")}</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("dropFile")}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(FIELD_KEYS as readonly FieldKey[]).map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label>{t(`field_${key}`)}</Label>
                  <Select
                    value={mapping[key]}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("preview")}</p>
              <div className="overflow-x-auto">
                <Table className="min-w-[400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{t("field_date")}</TableHead>
                      <TableHead className="whitespace-nowrap">{t("field_startAt")}</TableHead>
                      <TableHead className="whitespace-nowrap">{t("field_endAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{r.date || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.startAt || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.endAt || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("rowsLoaded", { count: rawRows.length })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>{t("back")}</Button>
              <Button
                disabled={!canMap || !targetUserId || loading}
                onClick={doImport}
              >
                {loading ? "…" : t("confirm")}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              ) : (
                <AlertCircle className="h-12 w-12 text-amber-500" />
              )}
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {t("created")}: {result.created}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("skipped")}: {result.skipped}
                </p>
                {result.errors.length > 0 && (
                  <p className="text-sm text-destructive mt-1">
                    {t("errors")}: {result.errors.length}
                  </p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2">
                {result.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {t("row")} {e.row}: {e.error}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={reset}>
                <FileCheck2 className="mr-1 h-4 w-4" />
                {t("importAnother")}
              </Button>
              <Button onClick={() => setOpen(false)}>{t("close")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}