"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  Save,
  Timer,
  UserCheck,
  UserX,
  Users,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { STATE_CODES, STATE_NAMES } from "@/lib/federal-states";
import { useConfirm } from "@/components/ui/confirm-dialog";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  locale: string;
  federalState: string;
  timezone: string;
  breakMode: string;
  active: boolean;
  hireDate: string | null;
  nfcCardId: string | null;
  lastLoginAt: string | null;
  sickMailEnabled: boolean | null;
  vacationMailEnabled: boolean | null;
};

type WorkingModelRecord = {
  id: string;
  weeklyTargetMinutes: number;
  validFrom: string;
  validTo: string | null;
} | null;

type Template = {
  id: string;
  name: string;
  weeklyTargetMinutes: number;
  isDefault: boolean;
};

function hoursToMinutes(input: string): number {
  if (input.includes(":")) {
    const [h, m] = input.split(":").map(Number);
    if (Number.isNaN(h)) return 0;
    return h * 60 + (m || 0);
  }
  const decimal = parseFloat(input.replace(",", "."));
  if (Number.isNaN(decimal)) return 0;
  return Math.round(decimal * 60);
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function useSaveFeedback() {
  return {
    msg: useState<string | null>(null),
    err: useState<string | null>(null),
    busy: useState(false),
  } as const;
}

/** -------------------------------------------------------------- profile */
function ProfileSection({ user }: { user: AdminUser }) {
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user.name);
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [role, setRole] = useState(user.role);
  const [locale, setLocale] = useState(user.locale);
  const [federalState, setFederalState] = useState(user.federalState);
  const [timezone, setTimezone] = useState(user.timezone);
  const [breakMode, setBreakMode] = useState(user.breakMode);
  const [active, setActive] = useState(user.active);
  const [hireDate, setHireDate] = useState<Date | undefined>(
    user.hireDate ? new Date(user.hireDate) : undefined
  );
  const [nfcCardId, setNfcCardId] = useState(user.nfcCardId ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email,
        name,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role,
        locale,
        federalState,
        timezone,
        breakMode,
        active,
        hireDate: hireDate ? hireDate.toISOString() : null,
        nfcCardId: nfcCardId.trim() || null,
      };
      if (password) body.password = password;
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw new Error(b.code === "EMAIL_TAKEN" ? t("emailTaken") : (b.error ?? "error"));
      }
      setMsg(t("saveOk"));
      setPassword("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> {t("groupUser")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" aria-label={t("groupUser")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                placeholder={t("passwordPlaceholder")}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t("firstName")}</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">{t("lastName")}</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role">{t("role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">{t("roleEmployee")}</SelectItem>
                  <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locale">{t("locale")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v)}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="federalState">{t("federalState")}</Label>
              <Select value={federalState} onValueChange={setFederalState}>
                <SelectTrigger id="federalState">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {STATE_NAMES[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">{t("timezone")}</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="breakMode">{t("breakMode")}</Label>
              <Select value={breakMode} onValueChange={setBreakMode}>
                <SelectTrigger id="breakMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">AUTO</SelectItem>
                  <SelectItem value="MANUAL">MANUAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hireDate">{t("hireDate")}</Label>
              <DatePicker value={hireDate} onChange={(d) => d && setHireDate(d)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nfc">{t("nfcCardId")}</Label>
            <Input id="nfc" value={nfcCardId} onChange={(e) => setNfcCardId(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4"
            />
            {t("active")}
          </label>
          {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 size-4" /> {saving ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**--------------- working model */
function WorkingModelSection({
  userId,
  workingModel,
}: {
  userId: string;
  workingModel: WorkingModelRecord;
}) {
  const tWm = useTranslations("adminWorkingModels");
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/working-model-templates")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        const def = d.templates?.find((tpl: Template) => tpl.isDefault);
        setSelected(def?.id ?? d.templates?.[0]?.id ?? "");
      })
      .catch(() => {});
  }, []);

  async function onAssign() {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/working-model-templates/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", userId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "error");
      }
      setMsg(t("saveOk"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" /> {t("assignModel")}
        </CardTitle>
        {workingModel && (
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {tWm("weeklyTarget")}: {Math.round((workingModel.weeklyTargetMinutes / 60) * 10) / 10}{" "}
              h
            </span>
            <span>
              {tWm("validFrom")}: {format(new Date(workingModel.validFrom), "dd.MM.yyyy")}
            </span>
            {workingModel.validTo && (
              <span>
                {tWm("validTo")}: {format(new Date(workingModel.validTo), "dd.MM.yyyy")}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tWm("noTemplates")}</p>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-3 rounded-md border p-3">
                <RadioGroupItem value={tpl.id} id={tpl.id} />
                <div className="flex-1">
                  <Label htmlFor={tpl.id} className="font-medium">
                    {tpl.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {tWm("weeklyTarget")}: {(tpl.weeklyTargetMinutes / 60).toFixed(1)} h
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        )}
        {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" disabled={saving || !selected} onClick={onAssign}>
          <Save className="mr-2 size-4" /> {t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**--------------- vacation entitlement */
function EntitlementSection({ userId }: { userId: string }) {
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const year = new Date().getUTCFullYear();
  const [totalDays, setTotalDays] = useState("30");
  const [usedDays, setUsedDays] = useState<number | null>(null);
  const [defaultDays, setDefaultDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/vacation?userId=${userId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        const ent = d.entitlement;
        if (ent?.totalDays !== undefined) {
          setTotalDays(String(ent.totalDays));
          setUsedDays(ent.consumedDays ?? null);
        }
        if (d.defaultDays != null) setDefaultDays(d.defaultDays);
      })
      .catch(() => {});
  }, [userId, year]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust-entitlement", year, totalDays: Number(totalDays) }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "error");
      }
      setMsg(t("saveOk"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" /> {t("adjustEntitlement")} ({year})
        </CardTitle>
        {usedDays != null && (
          <p className="text-xs text-muted-foreground">
            {t("usedDays")}: {usedDays}
            {defaultDays != null && ` · ${t("defaultLabel")}: ${defaultDays}`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 max-w-32">
          <Label htmlFor="totalDays">{t("totalDays")}</Label>
          <Input
            id="totalDays"
            type="number"
            min={0}
            max={200}
            value={totalDays}
            onChange={(e) => setTotalDays(e.target.value)}
          />
        </div>
        {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" disabled={saving} onClick={onSave}>
          <Save className="mr-2 size-4" /> {saving ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**--------------- notification prefs */
function NotificationsSection({ user }: { user: AdminUser }) {
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const [sick, setSick] = useState(user.sickMailEnabled !== false);
  const [vacation, setVacation] = useState(user.vacationMailEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave(payload: { sickMailEnabled?: boolean; vacationMailEnabled?: boolean }) {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "error");
      }
      setMsg(t("saveOk"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationSection")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("notificationSectionHint")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="sickMail">{t("sickMailLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("sickMailHint")}</p>
          </div>
          <Switch id="sickMail" checked={sick} onCheckedChange={(v) => setSick(v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="vacationMail">{t("vacationMailLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("vacationMailHint")}</p>
          </div>
          <Switch id="vacationMail" checked={vacation} onCheckedChange={(v) => setVacation(v)} />
        </div>
        {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="button"
          variant="default"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sickMailEnabled: sick, vacationMailEnabled: vacation }),
              });
              if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error(b.error ?? "error");
              }
              setMsg(t("saveOk"));
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="mr-2 size-4" /> {saving ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

/*--------------- overtime */
function OvertimeSection({ userId }: { userId: string }) {
  const t = useTranslations("adminUsers");
  const router = useRouter();
  const year = new Date().getUTCFullYear();
  const [carriedOver, setCarriedOver] = useState("00:00");
  const [consumed, setConsumed] = useState("00:00");
  const [computed, setComputed] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/overtime?userId=${userId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        const comp = d.computation;
        if (comp) {
          setCarriedOver(minutesToHours(comp.carriedOverMinutes ?? 0));
          setConsumed(minutesToHours(comp.consumedOvertimeMinutes ?? 0));
          if (comp.totalDeltaMs != null) setComputed(Math.round(comp.totalDeltaMs / 60_000));
        }
      })
      .catch(() => {});
  }, [userId, year]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust-overtime",
          year,
          carriedOverMinutes: hoursToMinutes(carriedOver),
          consumedOvertimeMinutes: hoursToMinutes(consumed),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "error");
      }
      setMsg(t("saveOk"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  const net = (computed ?? 0) + hoursToMinutes(carriedOver) - hoursToMinutes(consumed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="size-4" /> {t("adjustOvertime")} ({year})
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("overtimeHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="carriedOver">{t("carriedOverLabel")}</Label>
            <Input
              id="carriedOver"
              value={carriedOver}
              onChange={(e) => setCarriedOver(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consumed">{t("consumedLabel")}</Label>
            <Input
              id="consumed"
              value={consumed}
              onChange={(e) => setConsumed(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("computedThisYear")}: {computed ?? 0} min · {t("netBalance")}: {net} min
        </p>
        {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" disabled={saving} onClick={onSave}>
          <Save className="mr-2 size-4" /> {saving ? t("saving") : t("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**--------------- account actions */
function AccountSection({
  user,
  self,
  listHref,
}: {
  user: AdminUser;
  self: boolean;
  listHref: string;
}) {
  const t = useTranslations("adminUsers");
  const confirm = useConfirm();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    if (
      user.active &&
      !(await confirm({
        title: t("confirmDeactivate"),
        variant: "destructive",
        confirmLabel: t("deactivate"),
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: user.active ? "deactivate" : "activate" }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({
          title: "Fehler",
          description:
            (b as { code?: string }).code === "SELF_DEACTIVATE"
              ? t("cannotDeactivateSelf")
              : ((b as { error?: string }).error ?? "error"),
          confirmLabel: "OK",
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (
      !(await confirm({
        title: t("confirmDelete"),
        variant: "destructive",
        confirmLabel: t("delete"),
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({
          title: "Fehler",
          description:
            (b as { code?: string }).code === "HAS_DEPENDENCIES"
              ? t("hasDependencies")
              : ((b as { error?: string }).error ?? "error"),
          confirmLabel: "OK",
        });
        return;
      }
      router.push(listHref);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("groupAccount")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || (self && user.active)}
          onClick={toggleActive}
        >
          {user.active ? (
            <>
              <UserX className="mr-2 size-4" /> {t("deactivate")}
            </>
          ) : (
            <>
              <UserCheck className="mr-2 size-4" /> {t("activate")}
            </>
          )}
        </Button>
        <Button type="button" variant="destructive" disabled={busy || self} onClick={deleteUser}>
          <Trash2 className="mr-2 size-4" /> {t("delete")}
        </Button>
        {self && <p className="text-xs text-muted-foreground">{t("cannotDeleteSelf")}</p>}
      </CardContent>
    </Card>
  );
}

/**--------------------------------------------------------------- page */
export function UserDetail({
  user,
  workingModel,
}: {
  user: AdminUser & { isSelf: boolean };
  workingModel: WorkingModelRecord;
}) {
  const locale = useLocale();
  const t = useTranslations("adminUsers");
  const listHref = `/${locale}/admin/users`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user.name} <Badge variant="outline">{user.role}</Badge>
            <Badge variant={user.active ? "secondary" : "destructive"} className="ml-2">
              {user.active ? t("active") : t("inactive")}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Link
          href={listHref}
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ChevronLeft className="size-4" /> {t("backToList")}
        </Link>
      </div>

      <div className="space-y-4">
        <ProfileSection user={user} />
        <WorkingModelSection userId={user.id} workingModel={workingModel} />
        <EntitlementSection userId={user.id} />
        <OvertimeSection userId={user.id} />
        <NotificationsSection user={user} />
        <AccountSection user={user} self={user.isSelf} listHref={listHref} />
      </div>
    </div>
  );
}
