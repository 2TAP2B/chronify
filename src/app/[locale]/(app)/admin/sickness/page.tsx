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
import { CertificateUpload } from "@/components/sickness/certificate-upload";
import { SickNoteRowActions } from "@/components/sickness/sick-note-row-actions";
import { formatInZone } from "@/lib/datetime";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSicknessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("sickness");
  const ta = await getTranslations("adminSickness");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const notes = await db.sickNote.findMany({
    orderBy: { from: "desc" },
    include: { user: { select: { name: true, email: true } } },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{ta("title")}</h1>
        <p className="text-sm text-muted-foreground">{ta("allEmployees")} ({notes.length})</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{ta("allEmployees")}</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[700px] whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>{ta("employee")}</TableHead>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("aubUntil")}</TableHead>
                  <TableHead>{t("certificate")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="font-medium">{n.user.name}</div>
                      <div className="text-xs text-muted-foreground">{n.user.email}</div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(n.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(n.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{n.days}</TableCell>
                    <TableCell className="font-mono">
                      {n.aubUntil ? formatInZone(n.aubUntil, "Europe/Berlin", "dd.MM.yyyy", appLocale) : "—"}
                    </TableCell>
                    <TableCell>
                      <CertificateUpload noteId={n.id} hasCertificate={!!n.certificateUrl} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {n.note ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="pr-3">
                      <SickNoteRowActions
                        noteId={n.id}
                        from={n.from.toISOString()}
                        to={n.to.toISOString()}
                        aubUntil={n.aubUntil?.toISOString() ?? null}
                        note={n.note}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
