"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type MonthBucket = {
  month: number;
  workedMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  vacationDays: number;
  sickDays: number;
};

type ApiData = {
  user: { id: string; name: string; email: string } | null;
  year: number;
  months: MonthBucket[];
  totals: MonthBucket;
  carriedOverMinutes: number;
  consumedOvertimeMinutes: number;
  balanceMs: number;
};

type User = { id: string; name: string; active: boolean };

type ApiError = { error: string };

const EMPTY_MONTHS = () =>
  Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    workedMinutes: 0,
    targetMinutes: 0,
    overtimeMinutes: 0,
    vacationDays: 0,
    sickDays: 0,
  }));

function fmtH(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

function useChartConfig() {
  const t = useTranslations("workOverview");
  return useMemo(
    () =>
      ({
        worked: { label: t("workedLabel"), color: "hsl(var(--chart-1))" },
        target: { label: t("targetLabel"), color: "hsl(var(--chart-5))" },
      }) satisfies ChartConfig,
    [t]
  );
}

export function WorkOverviewPanel({
  currentUserId,
  year: currentYear,
}: {
  currentUserId: string;
  year: number;
}) {
  const locale = useLocale();
  const t = useTranslations("workOverview");
  const tAdmin = useTranslations("adminUsers");
  const [users, setUsers] = useState<User[] | null>(null);
  const [selected, setSelected] = useState<string>(currentUserId);
  const [year, setYear] = useState<number>(currentYear);
  const [data, setData] = useState<ApiData["months"] | null>(null);
  const [carriedOver, setCarriedOver] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d: { users?: User[] }) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/admin/work-overview?userId=${selected}&year=${year}`)
      .then((r) => r.json())
      .then((raw) => {
        const d = raw as ApiData & ApiError;
        if (d.error) return;
        setData(d.months);
        setCarriedOver(d.carriedOverMinutes);
        setBalance(Math.round(d.balanceMs / 60_000));
      })
      .catch(() => {});
  }, [selected, year]);

  const chartConfig = useChartConfig();
  const months = data ?? EMPTY_MONTHS();

  const chartData = useMemo(
    () =>
      months.map((m) => ({
        month: t(`monthNames.${m.month - 1}` as never),
        worked: Math.round((m.workedMinutes / 60) * 10) / 10,
        target: Math.round((m.targetMinutes / 60) * 10) / 10,
      })),
    [months, t]
  );

  const totals = useMemo(
    () =>
      months.reduce(
        (a, m) => ({
          workedMinutes: a.workedMinutes + m.workedMinutes,
          targetMinutes: a.targetMinutes + m.targetMinutes,
          overtimeMinutes: a.overtimeMinutes + m.overtimeMinutes,
          vacationDays: a.vacationDays + m.vacationDays,
          sickDays: a.sickDays + m.sickDays,
        }),
        { workedMinutes: 0, targetMinutes: 0, overtimeMinutes: 0, vacationDays: 0, sickDays: 0 }
      ),
    [months]
  );

  const stat = (label: string, value: string, negative?: boolean) => (
    <Card className="py-3">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            negative
              ? "mt-1 font-mono text-lg font-semibold tabular-nums text-destructive"
              : "mt-1 font-mono text-lg font-semibold tabular-nums"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Top bar: user dropdown + year */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full sm:w-64" aria-label={t("selectUser")}>
            <SelectValue placeholder={t("selectUser")} />
          </SelectTrigger>
          <SelectContent>
            {(users ?? [])
              .filter((u) => u.active)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, -1, -2].map((offset) => (
              <SelectItem key={currentYear + offset} value={String(currentYear + offset)}>
                {currentYear + offset}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Link
            href={`/${locale}/admin/users/${selected}`}
            className="text-sm text-primary hover:underline"
          >
            {t("openUserPage")}
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(t("workedTotal") as string, fmtH(totals.workedMinutes))}
        {stat(t("targetTotal") as string, fmtH(totals.targetMinutes))}
        {stat(t("overtimeBalance") as string, fmtH(balance), balance < 0)}
        {stat(t("vacationSick") as string, `${totals.vacationDays} / ${totals.sickDays}`)}
      </div>

      {/* Monthly chart: grouped Soll vs. worked bars */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("monthlyChart")} · {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={chartData} accessibilityLayer barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}h`} />
              <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} />
              <Bar dataKey="worked" fill="var(--color-worked)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* vacation / sick monthly detail */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("vacationMonths")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {months.map((m) =>
              m.vacationDays > 0 ? (
                <Badge key={m.month}>
                  {t(`monthNames.${m.month - 1}` as never)}: {m.vacationDays}
                </Badge>
              ) : null
            )}
            {months.every((m) => m.vacationDays === 0) && (
              <p className="text-sm text-muted-foreground">–</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sickMonths")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {months.map((m) =>
              m.sickDays > 0 ? (
                <Badge key={m.month}>
                  {t(`monthNames.${m.month - 1}` as never)}: {m.sickDays}
                </Badge>
              ) : null
            )}
          </CardContent>
        </Card>
      </div>

      {users === null && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="size-4" /> {tAdmin("noUsers")}
        </div>
      )}
    </div>
  );
}
