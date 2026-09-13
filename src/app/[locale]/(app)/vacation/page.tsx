import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeYearOvertime } from "@/server/services/overtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VacationRequestForm } from "@/components/vacation/vacation-request-form";
import { VacationCancelAction } from "@/components/vacation/vacation-cancel-action";
import { YearPicker } from "@/components/shared/year-picker";
import { formatInZone } from "@/lib/datetime";
import type { VacationStatus } from "@prisma/client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
};

const STATUS_COLORS: Record<VacationStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function VacationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("vacation");
  const session = await auth();
  if (!session?.user?.id) return null;

  const { year: yearStr } = await searchParams;
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();

  const [requests, entitlement, settings, overtimeResult] = await Promise.all([
    db.vacationRequest.findMany({
      where: { userId: session.user.id, year },
      orderBy: { from: "desc" },
    }),
    db.vacationEntitlement.findUnique({
      where: { userId_year: { userId: session.user.id, year } },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    computeYearOvertime({
      userId: session.user.id,
      year,
      timeZone: "Europe/Berlin",
    }),
  ]);

  const totalDays = entitlement?.totalDays ?? settings.defaultVacationDays;
  const carriedOverDays = entitlement?.carriedOverDays ?? 0;
  const consumedDays = entitlement?.consumedDays ?? 0;
  const availableDays = totalDays + carriedOverDays - consumedDays;
  const overtimeHours = Math.round((overtimeResult.computation.balanceMs / 3_600_000) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <YearPicker year={year} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalDays")}</CardDescription>
            <CardTitle className="text-2xl">
              {totalDays} {t("days")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("carriedOver")}</CardDescription>
            <CardTitle className="text-2xl">
              {carriedOverDays} {t("days")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("consumed")}</CardDescription>
            <CardTitle className="text-2xl">
              {consumedDays} {t("days")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("available")}</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {availableDays} {t("days")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("newRequest")}</CardTitle>
          <CardDescription>{year}</CardDescription>
        </CardHeader>
        <CardContent>
          <VacationRequestForm overtimeHours={overtimeHours} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("request")}</CardTitle>
          <CardDescription>{year}</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      {formatInZone(r.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(r.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
                      >
                        {t(`statuses.${r.status}` as never)}
                      </span>
                      {r.useOvertime && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {t("overtimeBadge")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.note ?? r.approverNote ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="pr-3">
                      {(r.status === "PENDING" || r.status === "APPROVED") && (
                        <VacationCancelAction requestId={r.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
