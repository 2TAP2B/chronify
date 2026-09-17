import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
import { SickNoteForm } from "@/components/sickness/sick-note-form";
import { CertificateUpload } from "@/components/sickness/certificate-upload";
import { YearPicker } from "@/components/shared/year-picker";
import { formatInZone } from "@/lib/datetime";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function SicknessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("sickness");
  const session = await auth();
  if (!session?.user?.id) return null;

  const { year: yearStr } = await searchParams;
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();

  const notes = await db.sickNote.findMany({
    where: {
      userId: session.user.id,
      from: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    orderBy: { from: "desc" },
  });

  const totalSickDays = notes.reduce((sum, n) => sum + n.days, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <YearPicker year={year} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {t("title")} {year}
            </CardDescription>
            <CardTitle className="text-2xl">
              {totalSickDays} {t("days")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("newNote")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SickNoteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{year}</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("certificate")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono">
                      {formatInZone(n.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(n.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{n.days}</TableCell>
                    <TableCell>
                      <CertificateUpload noteId={n.id} hasCertificate={!!n.certificateUrl} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {n.note ?? <span className="text-muted-foreground">—</span>}
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
