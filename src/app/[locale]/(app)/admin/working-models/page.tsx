import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { WorkingModelDialog } from "@/components/admin/working-model-dialog";
import { WorkingModelDelete } from "@/components/admin/working-model-delete";
import { formatInZone } from "@/lib/datetime";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ userId?: string }>;
};

export default async function AdminWorkingModelsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminWorkingModels");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const { userId } = await searchParams;
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const selectedUserId = userId ?? users[0]?.id;
  const models = selectedUserId
    ? await db.workingModel.findMany({
        where: { userId: selectedUserId },
        orderBy: { validFrom: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("user")}:</span>
        {users.map((u) => (
          <a
            key={u.id}
            href={`?userId=${u.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm hover:bg-accent ${
              selectedUserId === u.id ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {u.name}
          </a>
        ))}
      </div>

      <div className="flex justify-end">
        {selectedUserId && <WorkingModelDialog mode="create" userId={selectedUserId} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{models.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noModels")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("validFrom")}</TableHead>
                  <TableHead>{t("validTo")}</TableHead>
                  <TableHead>{t("weeklyTarget")}</TableHead>
                  <TableHead>Mo–Fr</TableHead>
                  <TableHead>Sa/So</TableHead>
                  <TableHead>{t("autoBreak6h")}</TableHead>
                  <TableHead>{t("autoBreak9h")}</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => {
                  const weekdaySum = m.mondayMinutes + m.tuesdayMinutes + m.wednesdayMinutes + m.thursdayMinutes + m.fridayMinutes;
                  const weekendSum = m.saturdayMinutes + m.sundayMinutes;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">
                        {formatInZone(m.validFrom, "Europe/Berlin", "dd.MM.yyyy", locale as "de" | "en")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {m.validTo ? formatInZone(m.validTo, "Europe/Berlin", "dd.MM.yyyy", locale as "de" | "en") : <Badge>{t("open")}</Badge>}
                      </TableCell>
                      <TableCell>{m.weeklyTargetMinutes} {t("minutes")}</TableCell>
                      <TableCell>{weekdaySum} {t("minutes")}</TableCell>
                      <TableCell>{weekendSum} {t("minutes")}</TableCell>
                      <TableCell>{m.autoBreakThreshold6h ? `${m.autoBreakMinutes6h}'` : "—"}</TableCell>
                      <TableCell>{m.autoBreakThreshold9h ? `${m.autoBreakMinutes9h}'` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <WorkingModelDialog mode="edit" userId={selectedUserId!} model={m} />
                          <WorkingModelDelete modelId={m.id} />
                        </div>
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
