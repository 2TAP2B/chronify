"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plane, Clock } from "lucide-react";

export function ClosureChoiceCard({
  closureId,
  currentChoice,
  name,
}: {
  closureId: string;
  currentChoice: "VACATION" | "OVERTIME";
  name: string;
}) {
  const t = useTranslations("closureChoices");
  const [choice, setChoice] = useState(currentChoice);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function select(newChoice: "VACATION" | "OVERTIME") {
    if (newChoice === choice) return;
    startTransition(async () => {
      const res = await fetch(`/api/closure-choices/${closureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: newChoice }),
      });
      if (res.ok) {
        setChoice(newChoice);
        setError(null);
      } else {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => select("VACATION")}
          className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            choice === "VACATION" ? "border-primary bg-primary/5" : "hover:bg-accent"
          }`}
        >
          <Plane className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{t("vacation")}</p>
            <p className="text-sm text-muted-foreground">{t("vacationDescription")}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => select("OVERTIME")}
          className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            choice === "OVERTIME" ? "border-primary bg-primary/5" : "hover:bg-accent"
          }`}
        >
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{t("overtime")}</p>
            <p className="text-sm text-muted-foreground">{t("overtimeDescription")}</p>
          </div>
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {pending && <p className="text-sm text-muted-foreground">{t("saving")}</p>}
    </div>
  );
}
