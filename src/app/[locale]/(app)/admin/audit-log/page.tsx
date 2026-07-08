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
import { formatInZone } from "@/lib/datetime";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entity?: string; offset?: string }>;
};

const ENTITIES = [
  "User", "WorkingModel", "TimeEntry", "TimerSession",
  "VacationRequest", "SickNote", "OrgSettings", "PublicHoliday",
];

export default async function AdminAuditLogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("adminAuditLog");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const { entity, offset: offsetStr } = await searchParams;
  const offset = offsetStr ? Number(offsetStr) : 0;
  const limit = 50;

  const where = entity ? { entity } : {};
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { name: true, email: true } },
        target: { select: { name: true, email: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
        <span className="text-sm font-medium shrink-0">{t("filter")}:</span>
        <a
          href={`?`}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-accent ${!entity ? "bg-primary text-primary-foreground" : ""}`}
        >
          {t("allEntities")}
        </a>
        {ENTITIES.map((e) => (
          <a
            key={e}
            href={`?entity=${e}`}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-accent ${entity === e ? "bg-primary text-primary-foreground" : ""}`}
          >
            {e}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("total")}: {total}</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("at")}</TableHead>
                  <TableHead>{t("actor")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead>{t("target")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">
                      {formatInZone(e.at, "Europe/Berlin", "dd.MM.yyyy HH:mm:ss", appLocale)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.actor?.name ?? "—"}
                      <div className="text-muted-foreground">{e.actor?.email ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{e.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.entity}</TableCell>
                    <TableCell className="text-xs">
                      {e.target?.name ?? "—"}
                      <div className="text-muted-foreground">{e.target?.email ?? ""}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {offset > 0 && (
          <a href={`?entity=${entity ?? ""}&offset=${Math.max(0, offset - limit)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            ←
          </a>
        )}
        <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + limit, total)} / {total}</span>
        {offset + limit < total && (
          <a href={`?entity=${entity ?? ""}&offset=${offset + limit}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            →
          </a>
        )}
      </div>
    </div>
  );
}
