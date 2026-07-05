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
import { TemplateDialog } from "@/components/admin/template-dialog";
import { TemplateDelete } from "@/components/admin/template-delete";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function WorkingModelsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminWorkingModels");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const templates = await db.workingModelTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{templates.length} {t("templates")}</p>
        </div>
        <TemplateDialog mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("templateDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("templateName")}</TableHead>
                  <TableHead>{t("weeklyTarget")}</TableHead>
                  <TableHead>Mo–Fr</TableHead>
                  <TableHead>Sa/So</TableHead>
                  <TableHead>{t("default")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => {
                  const moFr = tpl.mondayMinutes + tpl.tuesdayMinutes + tpl.wednesdayMinutes + tpl.thursdayMinutes + tpl.fridayMinutes;
                  const saSo = tpl.saturdayMinutes + tpl.sundayMinutes;
                  return (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell>{(tpl.weeklyTargetMinutes / 60).toFixed(1)} h</TableCell>
                      <TableCell>{(moFr / 60).toFixed(1)} h</TableCell>
                      <TableCell>{(saSo / 60).toFixed(1)} h</TableCell>
                      <TableCell>
                        {tpl.isDefault ? <Badge>{t("default")}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TemplateDialog mode="edit" template={tpl} />
                          <TemplateDelete templateId={tpl.id} templateName={tpl.name} />
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
