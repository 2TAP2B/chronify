"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, FileSpreadsheet, FileType, Loader2 } from "lucide-react";

export function ReportDownloader({
  defaultFrom,
  defaultTo,
  users,
  isAdmin,
}: {
  defaultFrom: string;
  defaultTo: string;
  users: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const t = useTranslations("reports");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [loading, setLoading] = useState<null | string>(null);

  async function download(format: "csv" | "excel" | "pdf") {
    if (!from || !to) return;
    setLoading(format);
    try {
      const params = new URLSearchParams({ from, to, format });
      if (isAdmin && userId) params.set("userId", userId);
      const url = `/api/reports?${params}`;
      const res = await fetch(url);
      if (!res.ok) {
        alert("error");
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const ext = format === "excel" ? "xlsx" : format;
      link.download = `stundenzettel-${from}_${to}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      alert("error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {isAdmin && users.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="user">{t("user")}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="user"><SelectValue /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => download("csv")} disabled={loading !== null}>
          {loading === "csv" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
          {t("downloadCsv")}
        </Button>
        <Button variant="outline" onClick={() => download("excel")} disabled={loading !== null}>
          {loading === "excel" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
          {t("downloadExcel")}
        </Button>
        <Button variant="outline" onClick={() => download("pdf")} disabled={loading !== null}>
          {loading === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileType className="mr-1 h-4 w-4" />}
          {t("downloadPdf")}
        </Button>
      </div>
    </div>
  );
}
