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
import { UserDialog } from "@/components/admin/user-dialog";
import { UserRowMenu } from "@/components/admin/user-row-menu";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminUsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminUsers");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      locale: true,
      federalState: true,
      timezone: true,
      breakMode: true,
      active: true,
      hireDate: true,
      nfcCardId: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{users.length} {t("users")}</p>
        </div>
        <UserDialog mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{users.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="default">{t("active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRowMenu user={u} isSelf={u.id === session.user.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
