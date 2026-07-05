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

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function AdminHolidaysPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("adminHolidays");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const federalState = settings.defaultFederalState;

  const { year: yearStr } = await searchParams;
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();

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
        <a href={`?year=${year - 1}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">← {year - 1}</a>
        <span className="font-semibold">{year}</span>
        <a href={`?year=${year + 1}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{year + 1} →</a>
        <span className="ml-4 text-sm text-muted-foreground">{t("state")}: {federalState}</span>
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
