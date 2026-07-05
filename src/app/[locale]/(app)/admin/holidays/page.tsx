import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
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
import { HolidaySyncButton } from "@/components/admin/holiday-sync-button";
import { formatInZone } from "@/lib/datetime";
import type { FederalState } from "@prisma/client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; state?: string }>;
};

const STATES: FederalState[] = [
  "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
  "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
];

export default async function AdminHolidaysPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("adminHolidays");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const { year: yearStr, state } = await searchParams;
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();
  const federalState = (state ?? "DE_NW") as FederalState;

  const holidays = await db.publicHoliday.findMany({
    where: {
      federalState,
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    orderBy: { date: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("year")}:</span>
        <a href={`?year=${year - 1}&state=${federalState}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">← {year - 1}</a>
        <span className="font-semibold">{year}</span>
        <a href={`?year=${year + 1}&state=${federalState}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{year + 1} →</a>
        <span className="ml-4 text-sm font-medium">{t("state")}:</span>
        {STATES.map((s) => (
          <a
            key={s}
            href={`?year=${year}&state=${s}`}
            className={`rounded-md border px-3 py-1.5 text-xs hover:bg-accent ${
              federalState === s ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <div className="flex gap-2">
        <HolidaySyncButton year={year} state={federalState} />
        <HolidaySyncButton year={year} all />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")} {year} · {federalState}</CardTitle>
          <CardDescription>{holidays.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHolidays")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">
                      {formatInZone(h.date, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>{h.type}</TableCell>
                    <TableCell>
                      <Badge variant={h.source === "MANUAL" ? "default" : "secondary"}>{h.source}</Badge>
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
