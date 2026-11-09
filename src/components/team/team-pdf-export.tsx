"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

export function TeamPdfExport({ year, month }: { year: number; month: number }) {
  const [loading, setLoading] = useState(false);
  const tc = useTranslations("common");

  async function download() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await fetch(`/api/team/export?${params}`);
      if (!res.ok) {
        alert(tc("errorGeneric"));
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const m = String(month).padStart(2, "0");
      link.download = `team-plan-${year}-${m}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      alert(tc("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-1 h-4 w-4" />
      )}
      PDF
    </Button>
  );
}
