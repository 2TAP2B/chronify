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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VacationApprovalActions } from "@/components/vacation/vacation-approval-actions";
import { formatInZone } from "@/lib/datetime";
import type { VacationStatus } from "@prisma/client";

type Props = {
  params: Promise<{ locale: string }>;
};

const STATUS_COLORS: Record<VacationStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function VacationApprovalsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("vacation");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const requests = await db.vacationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { from: "asc" },
    include: { user: { select: { name: true, email: true, federalState: true } } },
  });

  const recent = await db.vacationRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("status")}: {requests.length} {t("statuses.PENDING")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("statuses.PENDING")} ({requests.length})</CardTitle>
          <CardDescription>{t("request")}</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                  <TableHead></TableHead>
                  <TableHead className="text-right">{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.user.name}</div>
                      <div className="text-xs text-muted-foreground">{r.user.email}</div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(r.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(r.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.note ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.useOvertime && (
                        <Badge variant="secondary" className="text-xs">
                          {t("overtimeBadge")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <VacationApprovalActions requestId={r.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zuletzt entschieden</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.user.name}</TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(r.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatInZone(r.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                    </TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                        {t(`statuses.${r.status}` as never)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
