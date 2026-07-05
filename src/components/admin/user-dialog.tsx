"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Pencil, Plus } from "lucide-react";

type User = {
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
};

const STATES = [
  "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
  "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
];

export function UserDialog({
  mode,
  user,
}: {
  mode: "create" | "edit";
  user?: User;
}) {
  const t = useTranslations("adminUsers");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [role, setRole] = useState(user?.role ?? "EMPLOYEE");
  const [locale, setLocale] = useState(user?.locale ?? "de");
  const [federalState, setFederalState] = useState(user?.federalState ?? "DE_NW");
  const [timezone, setTimezone] = useState(user?.timezone ?? "Europe/Berlin");
  const [breakMode, setBreakMode] = useState(user?.breakMode ?? "AUTO");
  const [active, setActive] = useState(user?.active ?? true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email, name, firstName: firstName || undefined, lastName: lastName || undefined,
        role, locale, federalState, timezone, breakMode, active,
      };
      if (password) body.password = password;
      const url = mode === "edit" ? `/api/admin/users/${user!.id}` : "/api/admin/users";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const code = (b as { code?: string }).code;
        if (code === "EMAIL_TAKEN") setError(t("emailTaken"));
        else setError((b as { error?: string }).error ?? "error");
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={mode === "create" ? "default" : "ghost"}>
          {mode === "create" ? <Plus className="mr-1 h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
          {mode === "create" ? t("newUser") : t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("newUser") : t("edit")}</DialogTitle>
          <DialogDescription>{user?.email ?? ""}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")} {mode === "edit" && "(leer = nicht ändern)"}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={mode === "create"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t("firstName")}</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">{t("lastName")}</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">{t("role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locale">{t("locale")}</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="locale"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="federalState">{t("federalState")}</Label>
              <Select value={federalState} onValueChange={setFederalState}>
                <SelectTrigger id="federalState"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">{t("timezone")}</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="breakMode">{t("breakMode")}</Label>
              <Select value={breakMode} onValueChange={setBreakMode}>
                <SelectTrigger id="breakMode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">AUTO</SelectItem>
                  <SelectItem value="MANUAL">MANUAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "edit" && (
              <div className="space-y-1.5">
                <Label htmlFor="active">{t("active")}</Label>
                <Select value={String(active)} onValueChange={(v) => setActive(v === "true")}>
                  <SelectTrigger id="active"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("active")}</SelectItem>
                    <SelectItem value="false">{t("inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>{t("cancel")}</Button>
            <Button type="submit" disabled={loading}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
