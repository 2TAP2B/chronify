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
import { UserToggleActive } from "@/components/admin/user-toggle-active";
import { formatInZone } from "@/lib/datetime";

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
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{users.length} Benutzer</p>
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
                <TableHead>{t("federalState")}</TableHead>
                <TableHead>{t("breakMode")}</TableHead>
                <TableHead>{t("lastLogin")}</TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {(u.firstName || u.lastName) && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({u.firstName} {u.lastName})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.federalState}</TableCell>
                  <TableCell>{u.breakMode}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastLoginAt ? formatInZone(u.lastLoginAt, "Europe/Berlin", "dd.MM.yyyy HH:mm", locale as "de" | "en") : "—"}
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="default">{t("active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <UserDialog mode="edit" user={u} />
                      <UserToggleActive userId={u.id} active={u.active} isSelf={u.id === session.user.id} />
                    </div>
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
