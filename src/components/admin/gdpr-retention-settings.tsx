"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

export function GdprRetentionSettings({
  retentionYears,
  sickNoteRetentionMonths,
  auditLogRetentionMonths,
  imprintName,
  imprintAddress,
  imprintEmail,
  imprintPhone,
  privacyPolicyUrl,
}: {
  retentionYears: number;
  sickNoteRetentionMonths: number;
  auditLogRetentionMonths: number;
  imprintName: string | null;
  imprintAddress: string | null;
  imprintEmail: string | null;
  imprintPhone: string | null;
  privacyPolicyUrl: string | null;
}) {
  const t = useTranslations("gdpr");
  const [form, setForm] = useState({
    retentionYears,
    sickNoteRetentionMonths,
    auditLogRetentionMonths,
    imprintName: imprintName ?? "",
    imprintAddress: imprintAddress ?? "",
    imprintEmail: imprintEmail ?? "",
    imprintPhone: imprintPhone ?? "",
    privacyPolicyUrl: privacyPolicyUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/gdpr/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retentionYears: Number(form.retentionYears),
          sickNoteRetentionMonths: Number(form.sickNoteRetentionMonths),
          auditLogRetentionMonths: Number(form.auditLogRetentionMonths),
          imprintName: form.imprintName || null,
          imprintAddress: form.imprintAddress || null,
          imprintEmail: form.imprintEmail || null,
          imprintPhone: form.imprintPhone || null,
          privacyPolicyUrl: form.privacyPolicyUrl || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ry">{t("retentionYears")}</Label>
          <Input
            id="ry"
            type="number"
            min={1}
            max={10}
            value={form.retentionYears}
            onChange={(e) => setForm({ ...form, retentionYears: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sn">{t("sickNoteRetentionMonths")}</Label>
          <Input
            id="sn"
            type="number"
            min={1}
            max={24}
            value={form.sickNoteRetentionMonths}
            onChange={(e) => setForm({ ...form, sickNoteRetentionMonths: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="al">{t("auditLogRetentionMonths")}</Label>
          <Input
            id="al"
            type="number"
            min={1}
            max={24}
            value={form.auditLogRetentionMonths}
            onChange={(e) => setForm({ ...form, auditLogRetentionMonths: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium">{t("imprintTitle")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="in">{t("imprintName")}</Label>
            <Input id="in" value={form.imprintName} onChange={(e) => setForm({ ...form, imprintName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ia">{t("imprintAddress")}</Label>
            <Input id="ia" value={form.imprintAddress} onChange={(e) => setForm({ ...form, imprintAddress: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ie">{t("imprintEmail")}</Label>
            <Input id="ie" type="email" value={form.imprintEmail} onChange={(e) => setForm({ ...form, imprintEmail: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip">{t("imprintPhone")}</Label>
            <Input id="ip" value={form.imprintPhone} onChange={(e) => setForm({ ...form, imprintPhone: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pp">{t("privacyPolicyUrl")}</Label>
            <Input id="pp" type="url" value={form.privacyPolicyUrl} onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" /> {t("saved")}
          </span>
        )}
      </div>
    </div>
  );
}