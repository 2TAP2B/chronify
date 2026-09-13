import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClosureDialog } from "@/components/admin/closure-dialog";
import { ClosureDelete } from "@/components/admin/closure-delete";
import { formatInZone } from "@/lib/datetime";
import { listClosures } from "@/server/services/business-closures";
import { requireUser } from "@/server/context";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BusinessClosuresPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("adminClosures");
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const closures = await listClosures(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <ClosureDialog mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{closures.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noClosures")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[450px] whitespace-nowrap">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("from")}</TableHead>
                    <TableHead>{t("to")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono">
                        {formatInZone(c.from, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatInZone(c.to, "Europe/Berlin", "dd.MM.yyyy", appLocale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ClosureDelete closureId={c.id} closureName={c.name} />
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
