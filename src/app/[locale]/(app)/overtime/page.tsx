import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOvertimeView } from "@/server/services/overtime";
import { formatSignedDuration } from "@/lib/overtime/calculate";
import { formatInZone } from "@/lib/datetime";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
};

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function OvertimePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("overtime");
  const session = await auth();
  if (!session?.user?.id) return null;

  const { year: yearStr } = await searchParams;
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();

  const view = await getOvertimeView({
    actor: { id: session.user.id, role: session.user.role },
    year: Number.isNaN(year) ? undefined : year,
  });

  const monthNames = appLocale === "en" ? MONTH_NAMES_EN : MONTH_NAMES_DE;
  const cutoffLabel = formatInZone(view.cutoff, view.timeZone, "dd.MM.yyyy", appLocale);
  const balancePositive = view.computation.balanceMs >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <a
            href={`?year=${view.year - 1}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            ← {view.year - 1}
          </a>
          <span className="font-semibold">{view.year}</span>
          <a
            href={`?year=${view.year + 1}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {view.year + 1} →
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("carriedOver")}</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatSignedDuration(view.computation.carriedOverMinutes * 60_000)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("computedThisYear")}</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatSignedDuration(view.computation.totalDeltaMs)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalBalance")}</CardDescription>
            <CardTitle
              className={`font-mono text-2xl tabular-nums ${
                balancePositive ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {view.signedBalance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={balancePositive ? "default" : "destructive"}>
              {balancePositive ? t("positive") : t("negative")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("carryoverCutoff")}</CardDescription>
            <CardTitle className="text-base">{cutoffLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t("cutoffHint", { date: cutoffLabel })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("monthlyBreakdown")}</CardTitle>
          <CardDescription>{view.year}</CardDescription>
        </CardHeader>
        <CardContent>
          {view.days.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noData", { year: view.year })}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">{t("month")}</TableHead>
                  <TableHead className="w-32 text-right">{t("delta")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.computation.byMonth.map((m) => {
                  const hasData = m.deltaMs !== 0;
                  return (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">
                        {monthNames[m.month - 1]}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {hasData ? formatSignedDuration(m.deltaMs) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
